import sharp from "sharp";
import type { OutputFormat } from "@/lib/formats";
import { COMPRESS_DEFAULT_TARGET_BYTES } from "@/lib/compress-defaults";

export { COMPRESS_DEFAULT_TARGET_BYTES };

const MIN_QUALITY = 30;
const QUALITY_STEP = 5;
const START_QUALITY = 85;
const RESET_QUALITY = 80;
const SCALE_FACTOR = 0.9;
const MIN_DIMENSION = 16;
const PALETTE_STEPS = [256, 128, 64, 32, 16];
const HEIC_QUALITY = 1;

const DEFAULT_TARGET_BYTES = COMPRESS_DEFAULT_TARGET_BYTES;

export type CompressFormatPreference = "keep" | OutputFormat;

export interface CompressOptions {
  targetBytes: number;
  formatPreference: CompressFormatPreference;
}

export interface CompressResult {
  buffer: Buffer;
  extension: OutputFormat;
  mimeType: string;
  originalSize: number;
  finalSize: number;
  wasCompressed: boolean;
  formatChanged: boolean;
}

function isHeicFormat(format: string): boolean {
  const normalized = format.toLowerCase().replace(/^\./, "");
  return normalized === "heic" || normalized === "heif";
}

async function decodeHeic(inputBuffer: Buffer): Promise<Buffer> {
  const heicConvert = (await import("heic-convert")).default;
  const decoded = await heicConvert({
    buffer: inputBuffer.buffer.slice(
      inputBuffer.byteOffset,
      inputBuffer.byteOffset + inputBuffer.byteLength,
    ),
    format: "PNG",
    quality: HEIC_QUALITY,
  });

  return Buffer.from(decoded);
}

function buildMimeType(extension: OutputFormat): string {
  switch (extension) {
    case "jpg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "tiff":
      return "image/tiff";
    case "gif":
      return "image/gif";
    default:
      return "application/octet-stream";
  }
}

function normalizeInputFormat(inputFormat: string): string {
  const normalized = inputFormat.toLowerCase().replace(/^\./, "");
  if (normalized === "jpeg") return "jpg";
  if (normalized === "tif") return "tiff";
  return normalized;
}

function pickFormatForInput(inputFormat: string): OutputFormat {
  switch (inputFormat) {
    case "jpg":
    case "png":
    case "webp":
    case "gif":
      return inputFormat;
    case "tiff":
    case "bmp":
    case "heic":
    case "heif":
    default:
      return "jpg";
  }
}

async function encodeJpeg(
  buffer: Buffer,
  width: number,
  height: number,
  quality: number,
): Promise<Buffer> {
  return sharp(buffer, { failOn: "none" })
    .resize(width, height, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();
}

async function encodeWebp(
  buffer: Buffer,
  width: number,
  height: number,
  quality: number,
): Promise<Buffer> {
  return sharp(buffer, { failOn: "none" })
    .resize(width, height, { fit: "inside", withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();
}

async function encodePngPalette(
  buffer: Buffer,
  width: number,
  height: number,
  colours: number,
): Promise<Buffer> {
  const usePalette = colours < 256;
  return sharp(buffer, { failOn: "none" })
    .resize(width, height, { fit: "inside", withoutEnlargement: true })
    .png({
      compressionLevel: 9,
      palette: usePalette,
      colours: usePalette ? colours : undefined,
      effort: 10,
    })
    .toBuffer();
}

async function encodeGifPalette(
  buffer: Buffer,
  width: number,
  height: number,
  colours: number,
): Promise<Buffer> {
  const usePalette = colours < 256;
  return sharp(buffer, { failOn: "none", animated: true })
    .resize(width, height, { fit: "inside", withoutEnlargement: true })
    .gif({
      colours: usePalette ? colours : 256,
      effort: 10,
    })
    .toBuffer();
}

async function tryAllQualityLevels(
  encoder: (width: number, height: number, quality: number) => Promise<Buffer>,
  width: number,
  height: number,
  startQuality: number,
  targetBytes: number,
): Promise<{ buffer: Buffer; quality: number } | null> {
  let quality = startQuality;
  let lastBuffer: Buffer | null = null;

  while (quality >= MIN_QUALITY) {
    const buffer = await encoder(width, height, quality);
    lastBuffer = buffer;

    if (buffer.length < targetBytes) {
      return { buffer, quality };
    }

    quality -= QUALITY_STEP;
  }

  return lastBuffer ? { buffer: lastBuffer, quality: MIN_QUALITY } : null;
}

async function lossyCompressToJpeg(
  buffer: Buffer,
  startWidth: number,
  startHeight: number,
  targetBytes: number,
): Promise<Buffer> {
  let width = startWidth;
  let height = startHeight;
  let startQuality = START_QUALITY;

  while (true) {
    const attempt = await tryAllQualityLevels(
      (w, h, q) => encodeJpeg(buffer, w, h, q),
      width,
      height,
      startQuality,
      targetBytes,
    );

    if (attempt && attempt.buffer.length < targetBytes) {
      return attempt.buffer;
    }

    const nextWidth = Math.max(MIN_DIMENSION, Math.floor(width * SCALE_FACTOR));
    const nextHeight = Math.max(MIN_DIMENSION, Math.floor(height * SCALE_FACTOR));

    if (nextWidth === width && nextHeight === height) {
      return attempt?.buffer ?? (await encodeJpeg(buffer, width, height, MIN_QUALITY));
    }

    width = nextWidth;
    height = nextHeight;
    startQuality = RESET_QUALITY;
  }
}

async function lossyCompressToWebp(
  buffer: Buffer,
  startWidth: number,
  startHeight: number,
  targetBytes: number,
): Promise<Buffer> {
  let width = startWidth;
  let height = startHeight;
  let startQuality = START_QUALITY;

  while (true) {
    const attempt = await tryAllQualityLevels(
      (w, h, q) => encodeWebp(buffer, w, h, q),
      width,
      height,
      startQuality,
      targetBytes,
    );

    if (attempt && attempt.buffer.length < targetBytes) {
      return attempt.buffer;
    }

    const nextWidth = Math.max(MIN_DIMENSION, Math.floor(width * SCALE_FACTOR));
    const nextHeight = Math.max(MIN_DIMENSION, Math.floor(height * SCALE_FACTOR));

    if (nextWidth === width && nextHeight === height) {
      return attempt?.buffer ?? (await encodeWebp(buffer, width, height, MIN_QUALITY));
    }

    width = nextWidth;
    height = nextHeight;
    startQuality = RESET_QUALITY;
  }
}

async function compressAsPng(
  buffer: Buffer,
  startWidth: number,
  startHeight: number,
  targetBytes: number,
): Promise<{ buffer: Buffer; extension: "png" | "jpg" }> {
  let width = startWidth;
  let height = startHeight;
  let lastPng: Buffer | null = null;

  while (width >= MIN_DIMENSION && height >= MIN_DIMENSION) {
    for (const colours of PALETTE_STEPS) {
      const encoded = await encodePngPalette(buffer, width, height, colours);
      lastPng = encoded;

      if (encoded.length < targetBytes) {
        return { buffer: encoded, extension: "png" };
      }
    }

    const nextWidth = Math.max(MIN_DIMENSION, Math.floor(width * SCALE_FACTOR));
    const nextHeight = Math.max(MIN_DIMENSION, Math.floor(height * SCALE_FACTOR));

    if (nextWidth === width && nextHeight === height) {
      break;
    }

    width = nextWidth;
    height = nextHeight;
  }

  const jpegBuffer = await lossyCompressToJpeg(
    buffer,
    startWidth,
    startHeight,
    targetBytes,
  );

  if (lastPng && jpegBuffer.length >= lastPng.length) {
    return { buffer: lastPng, extension: "png" };
  }

  return { buffer: jpegBuffer, extension: "jpg" };
}

async function compressAsGif(
  buffer: Buffer,
  startWidth: number,
  startHeight: number,
  targetBytes: number,
): Promise<{ buffer: Buffer; extension: "gif" | "jpg" }> {
  let width = startWidth;
  let height = startHeight;
  let lastGif: Buffer | null = null;

  while (width >= MIN_DIMENSION && height >= MIN_DIMENSION) {
    for (const colours of PALETTE_STEPS) {
      const encoded = await encodeGifPalette(buffer, width, height, colours);
      lastGif = encoded;

      if (encoded.length < targetBytes) {
        return { buffer: encoded, extension: "gif" };
      }
    }

    const nextWidth = Math.max(MIN_DIMENSION, Math.floor(width * SCALE_FACTOR));
    const nextHeight = Math.max(MIN_DIMENSION, Math.floor(height * SCALE_FACTOR));

    if (nextWidth === width && nextHeight === height) {
      break;
    }

    width = nextWidth;
    height = nextHeight;
  }

  const jpegBuffer = await lossyCompressToJpeg(
    buffer,
    startWidth,
    startHeight,
    targetBytes,
  );

  if (lastGif && jpegBuffer.length >= lastGif.length) {
    return { buffer: lastGif, extension: "gif" };
  }

  return { buffer: jpegBuffer, extension: "jpg" };
}

export async function compressImageToTarget(
  inputBuffer: Buffer,
  inputFormat: string,
  options: CompressOptions,
): Promise<CompressResult> {
  const targetBytes = options.targetBytes > 0 ? options.targetBytes : DEFAULT_TARGET_BYTES;
  const originalSize = inputBuffer.length;
  const normalizedInput = normalizeInputFormat(inputFormat);

  let workingBuffer = inputBuffer;
  if (isHeicFormat(normalizedInput)) {
    workingBuffer = await decodeHeic(inputBuffer);
  }

  const metadata = await sharp(workingBuffer, { failOn: "none" }).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  if (width === 0 || height === 0) {
    throw new Error(
      `Could not read dimensions for ${normalizedInput || "input"} file.`,
    );
  }

  const chosenFormat: OutputFormat =
    options.formatPreference === "keep"
      ? pickFormatForInput(normalizedInput)
      : options.formatPreference;

  const formatChanged =
    chosenFormat !== normalizedInput &&
    !(normalizedInput === "jpg" && chosenFormat === "jpg");

  const alreadyUnderTarget = originalSize < targetBytes;
  const noFormatChange = !formatChanged;

  if (alreadyUnderTarget && noFormatChange) {
    return {
      buffer: inputBuffer,
      extension: chosenFormat,
      mimeType: buildMimeType(chosenFormat),
      originalSize,
      finalSize: originalSize,
      wasCompressed: false,
      formatChanged: false,
    };
  }

  let resultBuffer: Buffer;
  let resultExtension: OutputFormat;

  switch (chosenFormat) {
    case "png":
    case "tiff": {
      const { buffer, extension } = await compressAsPng(
        workingBuffer,
        width,
        height,
        targetBytes,
      );
      resultBuffer = buffer;
      resultExtension = extension;
      break;
    }
    case "gif": {
      const { buffer, extension } = await compressAsGif(
        workingBuffer,
        width,
        height,
        targetBytes,
      );
      resultBuffer = buffer;
      resultExtension = extension;
      break;
    }
    case "webp": {
      resultBuffer = await lossyCompressToWebp(
        workingBuffer,
        width,
        height,
        targetBytes,
      );
      resultExtension = "webp";
      break;
    }
    case "jpg":
    default: {
      resultBuffer = await lossyCompressToJpeg(
        workingBuffer,
        width,
        height,
        targetBytes,
      );
      resultExtension = "jpg";
      break;
    }
  }

  return {
    buffer: resultBuffer,
    extension: resultExtension,
    mimeType: buildMimeType(resultExtension),
    originalSize,
    finalSize: resultBuffer.length,
    wasCompressed: true,
    formatChanged,
  };
}
