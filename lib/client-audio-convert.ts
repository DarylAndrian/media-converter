import JSZip from "jszip";
import type { FFmpeg } from "@ffmpeg/ffmpeg";
import {
  getAudioCodec,
  getAudioInputFormatFromFilename,
  getAudioMimeType,
  normalizeAudioOutputFormat,
  replaceAudioFileExtension,
  type AudioOutputFormat,
} from "@/lib/audio-formats";

const BITRATE_ARGS = ["-b:a", "192k"];

function buildExtractArgs(
  inputName: string,
  outputName: string,
  format: AudioOutputFormat,
): string[] {
  const codec = getAudioCodec(format);
  const args = ["-i", inputName, "-vn", "-acodec", codec];

  if (format === "mp3" || format === "m4a" || format === "ogg" || format === "opus") {
    args.push(...BITRATE_ARGS);
  }

  args.push(outputName);
  return args;
}

async function cleanupFiles(ffmpeg: FFmpeg, ...paths: string[]) {
  for (const path of paths) {
    await ffmpeg.deleteFile(path).catch(() => undefined);
  }
}

export async function convertSingleVideoToAudio(
  ffmpeg: FFmpeg,
  file: File,
  format: string,
  onProgress?: (ratio: number) => void,
): Promise<{ blob: Blob; filename: string }> {
  const outputFormat = normalizeAudioOutputFormat(format);
  const { fetchFile } = await import("@ffmpeg/util");

  const inputExt = getAudioInputFormatFromFilename(file.name);
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const inputName = `input-${token}.${inputExt}`;
  const outputName = `output-${token}.${outputFormat}`;

  const progressHandler = ({ progress }: { progress: number }) => {
    onProgress?.(Math.min(Math.max(progress, 0), 1));
  };

  ffmpeg.on("progress", progressHandler);

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file));

    const exitCode = await ffmpeg.exec(
      buildExtractArgs(inputName, outputName, outputFormat),
    );

    if (exitCode !== 0) {
      throw new Error(`Failed to extract audio from ${file.name}.`);
    }

    const data = await ffmpeg.readFile(outputName);
    const bytes =
      data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));

    const blob = new Blob([bytes as BlobPart], {
      type: getAudioMimeType(outputFormat),
    });
    const filename = replaceAudioFileExtension(file.name, outputFormat);

    return { blob, filename };
  } finally {
    ffmpeg.off("progress", progressHandler);
    await cleanupFiles(ffmpeg, inputName, outputName);
  }
}

export async function convertVideosToAudioZip(
  ffmpeg: FFmpeg,
  files: File[],
  format: string,
  onProgress?: (completed: number, total: number, fileProgress?: number) => void,
): Promise<Blob> {
  const zip = new JSZip();

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];

    const { blob, filename } = await convertSingleVideoToAudio(
      ffmpeg,
      file,
      format,
      (fileProgress) => {
        onProgress?.(index, files.length, fileProgress);
      },
    );

    zip.file(filename, blob);
    onProgress?.(index + 1, files.length);
  }

  return zip.generateAsync({ type: "blob" });
}

export const LARGE_VIDEO_WARNING_BYTES = 200 * 1024 * 1024;

export function hasLargeVideos(files: File[]): boolean {
  return files.some((file) => file.size > LARGE_VIDEO_WARNING_BYTES);
}
