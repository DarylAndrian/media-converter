import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import { OUTPUT_FORMATS, SUPPORTED_INPUT_EXTENSIONS } from "@/lib/formats";
import { AUDIO_OUTPUT_FORMATS } from "@/lib/audio-formats";
import { VIDEO_INPUT_EXTENSIONS, VIDEO_OUTPUT_FORMATS } from "@/lib/video-formats";
import { errorResult, resolveInputFile, runFfprobe, textResult } from "../util";

interface FfprobeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  duration?: string;
  bit_rate?: string;
}

interface FfprobeOutput {
  format?: {
    format_name?: string;
    duration?: string;
    size?: string;
    bit_rate?: string;
  };
  streams?: FfprobeStream[];
}

export function registerInfoTools(server: McpServer): void {
  server.registerTool(
    "list_formats",
    {
      title: "List supported formats",
      description:
        "List the image, video, and audio formats supported by the media conversion tools.",
      inputSchema: {
        mediaType: z
          .enum(["image", "video", "audio", "all"])
          .optional()
          .describe("Which media type to list formats for. Defaults to all"),
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
          `Video — input: ${VIDEO_INPUT_EXTENSIONS.join(", ")} | output: ${VIDEO_OUTPUT_FORMATS.join(", ")}`,
        );
      }
      if (type === "audio" || type === "all") {
        sections.push(`Audio — output: ${AUDIO_OUTPUT_FORMATS.join(", ")}`);
      }

      return textResult(sections.join("\n"));
    },
  );

  server.registerTool(
    "get_media_info",
    {
      title: "Get media file info",
      description:
        "Inspect a media file (image, video, or audio) and return format, duration, dimensions, and stream details via ffprobe. Requires ffmpeg/ffprobe on PATH.",
      inputSchema: {
        inputPath: z.string().describe("Absolute or relative path to the media file"),
      },
    },
    async ({ inputPath }) => {
      try {
        const absolute = await resolveInputFile(inputPath);
        const probe = (await runFfprobe(absolute)) as FfprobeOutput;

        const lines: string[] = [`File: ${absolute}`];

        if (probe.format) {
          const { format_name, duration, size, bit_rate } = probe.format;
          if (format_name) lines.push(`Format: ${format_name}`);
          if (duration) lines.push(`Duration: ${Number(duration).toFixed(2)}s`);
          if (size) lines.push(`Size: ${Number(size)} bytes`);
          if (bit_rate) lines.push(`Bitrate: ${bit_rate} b/s`);
        }

        for (const stream of probe.streams ?? []) {
          if (stream.codec_type === "video") {
            lines.push(
              `Video stream: ${stream.codec_name} ${stream.width}x${stream.height}`,
            );
          } else if (stream.codec_type === "audio") {
            lines.push(`Audio stream: ${stream.codec_name}`);
          }
        }

        return textResult(lines.join("\n"));
      } catch (error) {
        return errorResult((error as Error).message);
      }
    },
  );
}
