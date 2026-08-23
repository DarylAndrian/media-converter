import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod/v4";
import { convertImage } from "@/lib/converter";
import {
  compressImageToTarget,
  COMPRESS_DEFAULT_TARGET_BYTES,
  type CompressFormatPreference,
} from "@/lib/compress";
import { AUDIO_OUTPUT_FORMATS } from "@/lib/audio-formats";
import {
  normalizeOutputFormat,
  OUTPUT_FORMATS,
  SUPPORTED_INPUT_EXTENSIONS,
} from "@/lib/formats";
import { VIDEO_INPUT_EXTENSIONS, VIDEO_OUTPUT_FORMATS } from "@/lib/video-formats";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Website-hosted MCP endpoint (Streamable HTTP, stateless mode).
 *
 * Serverless constraints shape the design:
 * - No persistent process → stateless transport, fresh server per request
 * - No filesystem → tools take/return base64 image data instead of paths
 * - Only the sharp-based image pipelines are exposed (video/audio tools need
 *   system ffmpeg; background removal downloads a large ONNX model per cold
 *   start). For the full toolset use the standalone server (mcp/).
 *
 * Auth: static bearer token from the MCP_TOKEN env var (set it in Netlify).
 * Swap authorize() for JWT verification if per-user/expiring tokens are needed.
 */

function stripDataUrl(value: string): string {
  return value.replace(/^data:[^;]+;base64,/, "");
}

function decodeBase64(value: string): Buffer {
  const buffer = Buffer.from(stripDataUrl(value), "base64");
  if (buffer.length === 0) {
    throw new Error("imageBase64 decoded to zero bytes — is it valid base64?");
  }
  return buffer;
}

function authorize(request: Request): Response | null {
  const expected = process.env.MCP_TOKEN;

  if (!expected) {
    return Response.json(
      { error: "MCP endpoint not configured: set the MCP_TOKEN env var." },
      { status: 503 },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${expected}`) {
    return Response.json(
      { error: "Missing or invalid bearer token" },
      { status: 401 },
    );
  }

  return null;
}

function createWebMcpServer(): McpServer {
  const server = new McpServer({
    name: "media-converter-web",
    version: "0.1.0",
  });

  server.registerTool(
    "convert_image",
    {
      title: "Convert image",
      description:
        "Convert a base64-encoded image between formats (jpg, png, webp, tiff, gif; heic/heif input). Returns the result as base64.",
      inputSchema: {
        imageBase64: z.string().describe("Source image as base64 (data URLs accepted)"),
        inputFormat: z
          .enum(["jpg", "jpeg", "png", "webp", "tiff", "tif", "bmp", "gif", "heic", "heif"])
          .describe("Format of the input image"),
        outputFormat: z
          .enum(["jpg", "jpeg", "png", "webp", "tiff", "gif"])
          .describe("Target image format"),
      },
    },
    async ({ imageBase64, inputFormat, outputFormat }) => {
      try {
        const { buffer, extension, mimeType } = await convertImage(
          decodeBase64(imageBase64),
          inputFormat,
          normalizeOutputFormat(outputFormat),
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                extension,
                mimeType,
                sizeBytes: buffer.length,
                imageBase64: buffer.toString("base64"),
              }),
            },
          ],
        };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: (error as Error).message }] };
      }
    },
  );

  server.registerTool(
    "compress_image",
    {
      title: "Compress image",
      description:
        "Compress a base64-encoded image toward a target file size. Returns the result as base64.",
      inputSchema: {
        imageBase64: z.string().describe("Source image as base64 (data URLs accepted)"),
        inputFormat: z
          .enum(["jpg", "jpeg", "png", "webp", "tiff", "tif", "bmp", "gif", "heic", "heif"])
          .describe("Format of the input image"),
        targetKB: z
          .number()
          .int()
          .positive()
          .optional()
          .describe(
            `Target size in kilobytes. Defaults to ${Math.round(COMPRESS_DEFAULT_TARGET_BYTES / 1024)} KB`,
          ),
        formatPreference: z
          .enum(["keep", "jpg", "png", "webp", "tiff", "gif"])
          .optional()
          .describe('Output format strategy. "keep" preserves the input format when sensible'),
      },
    },
    async ({ imageBase64, inputFormat, targetKB, formatPreference }) => {
      try {
        const result = await compressImageToTarget(
          decodeBase64(imageBase64),
          inputFormat,
          {
            targetBytes: targetKB ? targetKB * 1024 : COMPRESS_DEFAULT_TARGET_BYTES,
            formatPreference: (formatPreference ?? "keep") as CompressFormatPreference,
          },
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                extension: result.extension,
                originalBytes: result.originalSize,
                finalBytes: result.finalSize,
                wasCompressed: result.wasCompressed,
                imageBase64: result.buffer.toString("base64"),
              }),
            },
          ],
        };
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: (error as Error).message }] };
      }
    },
  );

  server.registerTool(
    "list_formats",
    {
      title: "List supported formats",
      description: "List the image, video, and audio formats supported by this service.",
      inputSchema: {
        mediaType: z.enum(["image", "video", "audio", "all"]).optional(),
      },
    },
    async ({ mediaType }) => {
      const type = mediaType ?? "all";
      const sections: string[] = [];

      if (type === "image" || type === "all") {
        sections.push(
          `Image — input: ${SUPPORTED_INPUT_EXTENSIONS.join(", ")} | output: ${OUTPUT_FORMATS.join(", ")}`,
        );
      }
      if (type === "video" || type === "all") {
        sections.push(
          `Video — input: ${VIDEO_INPUT_EXTENSIONS.join(", ")} | output: ${VIDEO_OUTPUT_FORMATS.join(", ")} (standalone MCP server only)`,
        );
      }
      if (type === "audio" || type === "all") {
        sections.push(
          `Audio — output: ${AUDIO_OUTPUT_FORMATS.join(", ")} (standalone MCP server only)`,
        );
      }

      return { content: [{ type: "text", text: sections.join("\n") }] };
    },
  );

  return server;
}

export async function POST(request: Request): Promise<Response> {
  const denied = authorize(request);
  if (denied) return denied;

  // Stateless mode: a fresh transport per request (serverless has no
  // in-memory session store between requests).
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await createWebMcpServer().connect(transport);
  return transport.handleRequest(request);
}
