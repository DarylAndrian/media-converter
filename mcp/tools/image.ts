import { promises as fs } from "node:fs";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import { convertImage } from "@/lib/converter";
import {
  getInputFormatFromFilename,
  normalizeOutputFormat,
} from "@/lib/formats";
import {
  compressImageToTarget,
  COMPRESS_DEFAULT_TARGET_BYTES,
  type CompressFormatPreference,
} from "@/lib/compress";
import { removeBackgroundServer } from "@/lib/remove-bg";
import {
  defaultOutputPath,
  errorResult,
  formatBytes,
  resolveInputFile,
  textResult,
  writeOutputFile,
} from "../util";

export function registerImageTools(server: McpServer): void {
  server.registerTool(
    "convert_image",
    {
      title: "Convert image",
      description:
        "Convert an image file between formats (jpg, png, webp, tiff, gif; heic/heif input supported). Writes the converted file to disk and reports the output path.",
      inputSchema: {
        inputPath: z.string().describe("Absolute or relative path to the source image"),
        outputFormat: z
          .enum(["jpg", "jpeg", "png", "webp", "tiff", "gif"])
          .describe("Target image format"),
        outputPath: z
          .string()
          .optional()
          .describe("Where to write the result. Defaults to the input path with the new extension"),
      },
    },
    async ({ inputPath, outputFormat, outputPath }) => {
      try {
        const absolute = await resolveInputFile(inputPath);
        const buffer = await fs.readFile(absolute);
        const inputFormat = getInputFormatFromFilename(path.basename(absolute));
        const target = normalizeOutputFormat(outputFormat);

        const { buffer: converted, extension } = await convertImage(
          buffer,
          inputFormat,
          target,
        );

        const destination = await writeOutputFile(
          outputPath ?? defaultOutputPath(absolute, extension),
          converted,
        );

        return textResult(
          `Converted ${path.basename(absolute)} (${inputFormat} → ${extension}).\n` +
            `Output: ${destination} (${formatBytes(converted.length)})`,
        );
      } catch (error) {
        return errorResult((error as Error).message);
      }
    },
  );

  server.registerTool(
    "compress_image",
    {
      title: "Compress image",
      description:
        "Compress an image to a target file size using an adaptive quality/resolution search (sharp-based). May change the format if that produces a smaller result.",
      inputSchema: {
        inputPath: z.string().describe("Absolute or relative path to the source image"),
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
        outputPath: z
          .string()
          .optional()
          .describe("Where to write the result. Defaults to the input path with the result extension"),
      },
    },
    async ({ inputPath, targetKB, formatPreference, outputPath }) => {
      try {
        const absolute = await resolveInputFile(inputPath);
        const buffer = await fs.readFile(absolute);
        const inputFormat = getInputFormatFromFilename(path.basename(absolute));
        const targetBytes = targetKB ? targetKB * 1024 : COMPRESS_DEFAULT_TARGET_BYTES;

        const result = await compressImageToTarget(buffer, inputFormat, {
          targetBytes,
          formatPreference: (formatPreference ?? "keep") as CompressFormatPreference,
        });

        const destination = await writeOutputFile(
          outputPath ?? defaultOutputPath(absolute, result.extension),
          result.buffer,
        );

        return textResult(
          result.wasCompressed
            ? `Compressed ${path.basename(absolute)}: ${formatBytes(result.originalSize)} → ` +
              `${formatBytes(result.finalSize)} (.${result.extension}).\nOutput: ${destination}`
            : `Image already under target (${formatBytes(result.originalSize)}); written unchanged.\n` +
              `Output: ${destination}`,
        );
      } catch (error) {
        return errorResult((error as Error).message);
      }
    },
  );

  server.registerTool(
    "remove_background",
    {
      title: "Remove image background",
      description:
        "Remove the background from an image using AI segmentation (@imgly/background-removal) plus alpha-edge refinement. Outputs a transparent PNG. First run downloads the ONNX model.",
      inputSchema: {
        inputPath: z.string().describe("Absolute or relative path to the source image"),
        quality: z
          .enum(["fast", "high"])
          .optional()
          .describe('"high" (default) uses the full model + edge refinement; "fast" uses the quantized model'),
        outputPath: z
          .string()
          .optional()
          .describe("Where to write the result. Defaults to the input path with a .png extension"),
      },
    },
    async ({ inputPath, quality, outputPath }) => {
      try {
        const absolute = await resolveInputFile(inputPath);
        const buffer = await fs.readFile(absolute);

        const resultBuffer = await removeBackgroundServer(buffer, {
          quality: quality ?? "high",
        });

        const destination = await writeOutputFile(
          outputPath ?? defaultOutputPath(absolute, "png"),
          resultBuffer,
        );

        return textResult(
          `Removed background from ${path.basename(absolute)} (quality: ${quality ?? "high"}).\n` +
            `Output: ${destination} (${formatBytes(resultBuffer.length)})`,
        );
      } catch (error) {
        return errorResult((error as Error).message);
      }
    },
  );
}
