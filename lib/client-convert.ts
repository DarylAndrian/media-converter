import JSZip from "jszip";
import { replaceFileExtension } from "@/lib/formats";
import {
  browserSupportsWebpEncode,
  canvasToBlob,
  decodeImage,
  isBrowserDecodable,
} from "@/lib/browser-image";

// Canvas can encode these formats. GIF/TIFF outputs (and HEIC/TIFF inputs,
// which the browser cannot decode) fall back to the server route.
const BROWSER_ENCODABLE = new Set(["jpg", "png", "webp"]);

// High-quality single-pass encode. Unlike the compressor there is no byte
// target, so we use a fixed quality instead of an iterative loop.
const ENCODE_QUALITY = 0.9;

function mimeTypeFor(format: string): string {
  if (format === "webp") return "image/webp";
  if (format === "png") return "image/png";
  return "image/jpeg";
}

function getFilenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) {
    return fallback;
  }

  const match = header.match(/filename="([^"]+)"/i);
  return match?.[1] ?? fallback;
}

function fallbackFilename(file: File, format: string): string {
  const extension = format === "jpg" ? "jpg" : format;
  return `${file.name.replace(/\.[^/.]+$/, "")}.${extension}`;
}

async function convertInBrowser(
  file: File,
  format: string,
): Promise<{ blob: Blob; filename: string }> {
  const image = await decodeImage(file);

  try {
    let outputFormat = format;

    if (outputFormat === "webp" && !(await browserSupportsWebpEncode())) {
      outputFormat = "jpg";
    }

    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Canvas 2D context is unavailable in this browser.");
    }

    // JPEG has no alpha channel; paint white so transparency doesn't turn black.
    if (outputFormat === "jpg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }

    context.drawImage(image.source, 0, 0);

    const quality = outputFormat === "png" ? undefined : ENCODE_QUALITY;
    const blob = await canvasToBlob(canvas, mimeTypeFor(outputFormat), quality);

    return { blob, filename: replaceFileExtension(file.name, outputFormat) };
  } finally {
    image.cleanup();
  }
}

async function convertViaServer(
  file: File,
  format: string,
): Promise<{ blob: Blob; filename: string }> {
  const formData = new FormData();
  formData.append("files", file);
  formData.append("format", format);

  const response = await fetch("/api/convert", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;

    throw new Error(
      payload?.error ??
        `Failed to convert ${file.name}. This combination is processed server-side, which has a smaller size limit.`,
    );
  }

  const blob = await response.blob();
  const filename = getFilenameFromDisposition(
    response.headers.get("Content-Disposition"),
    fallbackFilename(file, format),
  );

  return { blob, filename };
}

export async function convertSingleFile(
  file: File,
  format: string,
): Promise<{ blob: Blob; filename: string }> {
  if (isBrowserDecodable(file.name) && BROWSER_ENCODABLE.has(format)) {
    return convertInBrowser(file, format);
  }

  return convertViaServer(file, format);
}

export async function convertFilesToZip(
  files: File[],
  format: string,
  onProgress?: (completed: number, total: number) => void,
): Promise<Blob> {
  const zip = new JSZip();

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const { blob, filename } = await convertSingleFile(file, format);
    zip.file(filename, blob);
    onProgress?.(index + 1, files.length);
  }

  return zip.generateAsync({ type: "blob" });
}
