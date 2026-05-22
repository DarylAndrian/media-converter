import JSZip from "jszip";
import type { FFmpeg } from "@ffmpeg/ffmpeg";
import {
  getVideoInputFormatFromFilename,
  getVideoMimeType,
  normalizeVideoOutputFormat,
  replaceVideoFileExtension,
  type VideoOutputFormat,
} from "@/lib/video-formats";

const REMUX_OUTPUT_FORMATS = new Set<VideoOutputFormat>(["mp4", "mov", "mkv"]);

function buildRemuxArgs(inputName: string, outputName: string): string[] {
  return ["-i", inputName, "-c", "copy", outputName];
}

function buildReencodeArgs(
  inputName: string,
  outputName: string,
  format: VideoOutputFormat,
): string[] {
  if (format === "webm") {
    return ["-i", inputName, "-c:v", "libvpx-vp9", "-c:a", "libopus", outputName];
  }

  return ["-i", inputName, "-c:v", "libx264", "-c:a", "aac", outputName];
}

async function cleanupFiles(ffmpeg: FFmpeg, ...paths: string[]) {
  for (const path of paths) {
    await ffmpeg.deleteFile(path).catch(() => undefined);
  }
}

export async function convertSingleVideo(
  ffmpeg: FFmpeg,
  file: File,
  format: string,
  onProgress?: (ratio: number) => void,
): Promise<{ blob: Blob; filename: string }> {
  const outputFormat = normalizeVideoOutputFormat(format);
  const { fetchFile } = await import("@ffmpeg/util");

  const inputExt = getVideoInputFormatFromFilename(file.name);
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const inputName = `input-${token}.${inputExt}`;
  const outputName = `output-${token}.${outputFormat}`;

  const progressHandler = ({ progress }: { progress: number }) => {
    onProgress?.(Math.min(Math.max(progress, 0), 1));
  };

  ffmpeg.on("progress", progressHandler);

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(file));

    const shouldTryRemux = REMUX_OUTPUT_FORMATS.has(outputFormat);
    let exitCode = 1;

    if (shouldTryRemux) {
      exitCode = await ffmpeg.exec(buildRemuxArgs(inputName, outputName));
    }

    if (!shouldTryRemux || exitCode !== 0) {
      exitCode = await ffmpeg.exec(
        buildReencodeArgs(inputName, outputName, outputFormat),
      );
    }

    if (exitCode !== 0) {
      throw new Error(`Failed to convert ${file.name}.`);
    }

    const data = await ffmpeg.readFile(outputName);
    const bytes =
      data instanceof Uint8Array ? data : new TextEncoder().encode(String(data));

    const blob = new Blob([bytes as BlobPart], {
      type: getVideoMimeType(outputFormat),
    });
    const filename = replaceVideoFileExtension(file.name, outputFormat);

    return { blob, filename };
  } finally {
    ffmpeg.off("progress", progressHandler);
    await cleanupFiles(ffmpeg, inputName, outputName);
  }
}

export async function convertVideosToZip(
  ffmpeg: FFmpeg,
  files: File[],
  format: string,
  onProgress?: (completed: number, total: number, fileProgress?: number) => void,
): Promise<Blob> {
  const zip = new JSZip();

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];

    const { blob, filename } = await convertSingleVideo(
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
