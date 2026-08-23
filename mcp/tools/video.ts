import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod/v4";
import {
  getAudioCodec,
  normalizeAudioOutputFormat,
} from "@/lib/audio-formats";
import {
  normalizeVideoOutputFormat,
  type VideoOutputFormat,
} from "@/lib/video-formats";
import {
  defaultOutputPath,
  errorResult,
  resolveInputFile,
  runFfmpeg,
  textResult,
} from "../util";

interface VideoCodecPair {
  video: string;
  audio: string;
}

const VIDEO_CODECS: Record<VideoOutputFormat, VideoCodecPair> = {
  mp4: { video: "libx264", audio: "aac" },
  mov: { video: "libx264", audio: "aac" },
  avi: { video: "mpeg4", audio: "mp3" },
  mkv: { video: "libx264", audio: "aac" },
  webm: { video: "libvpx-vp9", audio: "libopus" },
};

export function registerVideoTools(server: McpServer): void {
  server.registerTool(
    "convert_video",
    {
      title: "Convert video",
      description:
        "Convert a video file between containers/codecs (mp4, mov, avi, mkv, webm) using the system ffmpeg binary. Requires ffmpeg on PATH.",
      inputSchema: {
        inputPath: z.string().describe("Absolute or relative path to the source video"),
        outputFormat: z
          .enum(["mp4", "mov", "avi", "mkv", "webm"])
          .describe("Target video container format"),
        copyStreams: z
          .boolean()
          .optional()
          .describe("Remux without re-encoding (stream copy). Fast, but only works when codecs are compatible with the target container"),
        crf: z
          .number()
          .int()
          .min(0)
          .max(51)
          .optional()
          .describe("Constant rate factor for x264 encoding quality (lower = better, 18-28 typical)"),
        outputPath: z
          .string()
          .optional()
          .describe("Where to write the result. Defaults to the input path with the new extension"),
      },
    },
    async ({ inputPath, outputFormat, copyStreams, crf, outputPath }) => {
      try {
        const absolute = await resolveInputFile(inputPath);
        const target = normalizeVideoOutputFormat(outputFormat);
        const destination = outputPath ?? defaultOutputPath(absolute, target);

        const args = copyStreams
          ? ["-i", absolute, "-c", "copy"]
          : [
              "-i",
              absolute,
              "-c:v",
              VIDEO_CODECS[target].video,
              "-c:a",
              VIDEO_CODECS[target].audio,
              ...(crf !== undefined && VIDEO_CODECS[target].video === "libx264"
                ? ["-crf", String(crf)]
                : []),
            ];

        if (target === "mp4") {
          args.push("-movflags", "+faststart");
        }

        args.push(destination);
        await runFfmpeg(args);

        return textResult(
          `Converted video ${path.basename(absolute)} → .${target}` +
            `${copyStreams ? " (stream copy)" : ""}.\nOutput: ${path.resolve(destination)}`,
        );
      } catch (error) {
        return errorResult((error as Error).message);
      }
    },
  );

  server.registerTool(
    "video_to_audio",
    {
      title: "Extract audio from video",
      description:
        "Extract the audio track from a video file into a standalone audio file (mp3, wav, m4a, ogg, flac, opus) using the system ffmpeg binary.",
      inputSchema: {
        inputPath: z.string().describe("Absolute or relative path to the source video"),
        outputFormat: z
          .enum(["mp3", "wav", "m4a", "ogg", "flac", "opus"])
          .describe("Target audio format"),
        outputPath: z
          .string()
          .optional()
          .describe("Where to write the result. Defaults to the input path with the new extension"),
      },
    },
    async ({ inputPath, outputFormat, outputPath }) => {
      try {
        const absolute = await resolveInputFile(inputPath);
        const target = normalizeAudioOutputFormat(outputFormat);
        const destination = outputPath ?? defaultOutputPath(absolute, target);

        await runFfmpeg([
          "-i",
          absolute,
          "-vn",
          "-c:a",
          getAudioCodec(target),
          destination,
        ]);

        return textResult(
          `Extracted audio from ${path.basename(absolute)} → .${target}.\n` +
            `Output: ${path.resolve(destination)}`,
        );
      } catch (error) {
        return errorResult((error as Error).message);
      }
    },
  );
}
