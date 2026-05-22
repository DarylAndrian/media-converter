import sharp from "sharp";
import {
  getMimeType,
  normalizeOutputFormat,
  type OutputFormat,
} from "@/lib/formats";

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
    quality: 1,
  });

  return Buffer.from(decoded);
}

export async function convertImage(
  inputBuffer: Buffer,
  inputFormat: string,
  outputFormat: string,
): Promise<{ buffer: Buffer; extension: OutputFormat; mimeType: string }> {
  const targetFormat = normalizeOutputFormat(outputFormat);
  let workingBuffer = inputBuffer;

  if (isHeicFormat(inputFormat)) {
    workingBuffer = await decodeHeic(inputBuffer);
  }

  let pipeline = sharp(workingBuffer, { failOn: "none" });

  switch (targetFormat) {
    case "jpg":
      pipeline = pipeline.jpeg({ quality: 90, mozjpeg: true });
      break;
    case "png":
      pipeline = pipeline.png({ compressionLevel: 9 });
      break;
    case "webp":
      pipeline = pipeline.webp({ quality: 90 });
      break;
    case "tiff":
      pipeline = pipeline.tiff({ compression: "lzw" });
      break;
    case "gif":
      pipeline = pipeline.gif();
      break;
    default:
      throw new Error(`Unsupported output format: ${outputFormat}`);
  }

  const buffer = await pipeline.toBuffer();

  return {
    buffer,
    extension: targetFormat,
    mimeType: getMimeType(targetFormat),
  };
}
