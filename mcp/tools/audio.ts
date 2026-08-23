import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import {
  getAudioCodec,
  normalizeAudioOutputFormat,
} from "@/lib/audio-formats";
import {
  defaultOutputPath,
  errorResult,
  resolveInputFile,
  runFfmpeg,
  textResult,
} from "../util";

export function registerAudioTools(server: McpServer): void {
  server.registerTool(
    "convert_audio",
    {
      title: "Convert audio",
      description:
        "Convert an audio file between formats (mp3, wav, m4a, ogg, flac, opus) using the system ffmpeg binary. Requires ffmpeg on PATH.",
      inputSchema: {
        inputPath: z.string().describe("Absolute or relative path to the source audio file"),
        outputFormat: z
          .enum(["mp3", "wav", "m4a", "ogg", "flac", "opus"])
          .describe("Target audio format"),
        bitrate: z
          .string()
          .optional()
          .describe('Encoding bitrate, e.g. "192k". Ignored for lossless targets (wav, flac)'),
        outputPath: z
          .string()
          .optional()
          .describe("Where to write the result. Defaults to the input path with the new extension"),
      },
    },
    async ({ inputPath, outputFormat, bitrate, outputPath }) => {
      try {
        const absolute = await resolveInputFile(inputPath);
        const target = normalizeAudioOutputFormat(outputFormat);
        const destination = outputPath ?? defaultOutputPath(absolute, target);

        const lossless = target === "wav" || target === "flac";
        await runFfmpeg([
          "-i",
          absolute,
          "-vn",
          "-c:a",
          getAudioCodec(target),
          ...(bitrate && !lossless ? ["-b:a", bitrate] : []),
          destination,
        ]);

        return textResult(
          `Converted audio ${path.basename(absolute)} → .${target}.\n` +
            `Output: ${path.resolve(destination)}`,
        );
      } catch (error) {
        return errorResult((error as Error).message);
      }
    },
  );
}
