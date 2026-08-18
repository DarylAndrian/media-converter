import JSZip from "jszip";
import { replaceFileExtension } from "@/lib/formats";
import { COMPRESS_DEFAULT_TARGET_BYTES } from "@/lib/compress-defaults";
import {
  browserSupportsWebpEncode,
  canvasToBlob,
  decodeImage,
  isBrowserDecodable,
  getExtension,
  type DecodedImage,
} from "@/lib/browser-image";

export type CompressFormatPreference = "keep" | "jpg" | "png" | "webp" | "gif" | "tiff";

export interface CompressRequestOptions {
  targetBytes: number;
  format: CompressFormatPreference;
}

// Mirrors the server-side quality/resize loop, but expressed in canvas
// quality units (0..1) instead of sharp's 0..100 scale.
const MIN_QUALITY = 0.3;
const QUALITY_STEP = 0.05;
const START_QUALITY = 0.85;
const RESET_QUALITY = 0.8;
const SCALE_FACTOR = 0.9;
const MIN_DIMENSION = 16;

// Inputs that can be returned as-is when already under the target size.
const KEEPABLE_AS_IS = new Set(["jpg", "jpeg", "png", "webp"]);

type ClientOutputFormat = "jpg" | "png" | "webp";

// Canvas cannot encode GIF or TIFF, so those requests fall back to a format the
// browser can produce. PNG is preferred for GIF because it preserves
// transparency and palette-style graphics.
function resolveClientOutput(
  inputExt: string,
  preference: CompressFormatPreference,
): ClientOutputFormat {
  if (preference === "keep") {
    if (inputExt === "png") return "png";
    if (inputExt === "webp") return "webp";
    if (inputExt === "gif") return "png";
    return "jpg";
  }

  switch (preference) {
    case "png":
      return "png";
    case "webp":
      return "webp";
    case "gif":
    case "tiff":
      return "png";
    default:
      return "jpg";
  }
}

function mimeTypeFor(format: ClientOutputFormat): string {
  switch (format) {
    case "webp":
      return "image/webp";
    case "png":
      return "image/png";
    default:
      return "image/jpeg";
  }
}

async function encodeFrame(
  canvas: HTMLCanvasElement,
  source: CanvasImageSource,
  width: number,
  height: number,
  mime: string,
  quality?: number,
): Promise<Blob> {
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas 2D context is unavailable in this browser.");
  }

  context.drawImage(source, 0, 0, width, height);
  return canvasToBlob(canvas, mime, quality);
}

async function lossyCompressToTarget(
  canvas: HTMLCanvasElement,
  image: DecodedImage,
  mime: string,
  targetBytes: number,
): Promise<Blob> {
  let width = image.width;
  let height = image.height;
  let startQuality = START_QUALITY;
  let lastBlob: Blob | null = null;

  while (true) {
    let quality = startQuality;
    let matched: Blob | null = null;

    while (quality >= MIN_QUALITY) {
      const blob = await encodeFrame(canvas, image.source, width, height, mime, quality);
      lastBlob = blob;

      if (blob.size < targetBytes) {
        matched = blob;
        break;
      }

      quality -= QUALITY_STEP;
    }

    if (matched) {
      return matched;
    }

    const nextWidth = Math.max(MIN_DIMENSION, Math.floor(width * SCALE_FACTOR));
    const nextHeight = Math.max(MIN_DIMENSION, Math.floor(height * SCALE_FACTOR));

    if (nextWidth === width && nextHeight === height) {
      return lastBlob ?? (await encodeFrame(canvas, image.source, width, height, mime, MIN_QUALITY));
    }

    width = nextWidth;
    height = nextHeight;
    startQuality = RESET_QUALITY;
  }
}

async function losslessCompressToTarget(
  canvas: HTMLCanvasElement,
  image: DecodedImage,
  targetBytes: number,
): Promise<{ blob: Blob; extension: "png" | "jpg" }> {
  let width = image.width;
  let height = image.height;
  let lastPng: Blob | null = null;

  while (width >= MIN_DIMENSION && height >= MIN_DIMENSION) {
    const encoded = await encodeFrame(canvas, image.source, width, height, "image/png");
    lastPng = encoded;

    if (encoded.size < targetBytes) {
      return { blob: encoded, extension: "png" };
    }

    const nextWidth = Math.max(MIN_DIMENSION, Math.floor(width * SCALE_FACTOR));
    const nextHeight = Math.max(MIN_DIMENSION, Math.floor(height * SCALE_FACTOR));

    if (nextWidth === width && nextHeight === height) {
      break;
    }

    width = nextWidth;
    height = nextHeight;
  }

  // PNG is lossless, so fall back to JPEG when it cannot fit and is larger.
  const jpeg = await lossyCompressToTarget(canvas, image, "image/jpeg", targetBytes);

  if (lastPng && jpeg.size >= lastPng.size) {
    return { blob: lastPng, extension: "png" };
  }

  return { blob: jpeg, extension: "jpg" };
}

async function compressInBrowser(
  file: File,
  options: CompressRequestOptions,
): Promise<{ blob: Blob; filename: string }> {
  const inputExt = getExtension(file.name);
  const targetBytes =
    options.targetBytes > 0 ? options.targetBytes : COMPRESS_DEFAULT_TARGET_BYTES;

  if (
    options.format === "keep" &&
    KEEPABLE_AS_IS.has(inputExt) &&
    file.size <= targetBytes
  ) {
    return { blob: file, filename: file.name };
  }

  const image = await decodeImage(file);

  try {
    let outputFormat = resolveClientOutput(inputExt, options.format);

    if (outputFormat === "webp" && !(await browserSupportsWebpEncode())) {
      outputFormat = "jpg";
    }

    const canvas = document.createElement("canvas");
    let blob: Blob;
    let extension: ClientOutputFormat;

    if (outputFormat === "png") {
      const result = await losslessCompressToTarget(canvas, image, targetBytes);
      blob = result.blob;
      extension = result.extension;
    } else {
      blob = await lossyCompressToTarget(
        canvas,
        image,
        mimeTypeFor(outputFormat),
        targetBytes,
      );
      extension = outputFormat;
    }

    return { blob, filename: replaceFileExtension(file.name, extension) };
  } finally {
    image.cleanup();
  }
}

function getFilenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) {
    return fallback;
  }

  const match = header.match(/filename="([^"]+)"/i);
  return match?.[1] ?? fallback;
}

function fallbackFilename(file: File, format: CompressFormatPreference): string {
  if (format === "keep") {
    return file.name;
  }

  const extension = format === "jpg" ? "jpg" : format;
  return `${file.name.replace(/\.[^/.]+$/, "")}.${extension}`;
}

// Server fallback for formats the browser cannot decode (HEIC/TIFF). These are
// still subject to the hosting request-body limit.
async function compressViaServer(
  file: File,
  options: CompressRequestOptions,
): Promise<{ blob: Blob; filename: string }> {
  const formData = new FormData();
  formData.append("files", file);
  formData.append("targetBytes", String(options.targetBytes));
  formData.append("format", options.format);

  const response = await fetch("/api/compress", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;

    throw new Error(
      payload?.error ??
        `Failed to compress ${file.name}. This format is processed server-side, which has a smaller size limit.`,
    );
  }

  const blob = await response.blob();
  const filename = getFilenameFromDisposition(
    response.headers.get("Content-Disposition"),
    fallbackFilename(file, options.format),
  );

  return { blob, filename };
}

export async function compressSingleFile(
  file: File,
  options: CompressRequestOptions,
): Promise<{ blob: Blob; filename: string }> {
  if (!isBrowserDecodable(file.name)) {
    return compressViaServer(file, options);
  }

  return compressInBrowser(file, options);
}

export async function compressFilesToZip(
  files: File[],
  options: CompressRequestOptions,
  onProgress?: (completed: number, total: number) => void,
): Promise<Blob> {
  const zip = new JSZip();

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const { blob, filename } = await compressSingleFile(file, options);
    zip.file(filename, blob);
    onProgress?.(index + 1, files.length);
  }

  return zip.generateAsync({ type: "blob" });
}

// Now a soft, browser-memory warning rather than a hard upload cap.
export const COMPRESS_LARGE_FILE_BYTES = 100 * 1024 * 1024;

export function hasLargeFiles(files: File[]): boolean {
  return files.some((file) => file.size > COMPRESS_LARGE_FILE_BYTES);
}
