// Shared browser-side image helpers used by the in-browser compressor and
// converter. Everything here runs on the client; no server round-trips.

// Formats the browser can decode natively for drawing to a canvas.
export const BROWSER_DECODABLE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "bmp",
]);

export interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
}

export function getExtension(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return ext === "jpeg" ? "jpg" : ext;
}

export function isBrowserDecodable(filename: string): boolean {
  return BROWSER_DECODABLE_EXTENSIONS.has(getExtension(filename));
}

// Browsers that do not support WebP encoding silently fall back to PNG, so we
// probe the produced MIME type rather than trusting the request.
export function browserSupportsWebpEncode(): Promise<boolean> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    canvas.toBlob(
      (blob) => resolve(Boolean(blob && blob.type === "image/webp")),
      "image/webp",
      0.5,
    );
  });
}

export async function decodeImage(file: File): Promise<DecodedImage> {
  try {
    const bitmap = await createImageBitmap(file);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      cleanup: () => bitmap.close(),
    };
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () =>
          reject(
            new Error(
              `Could not decode ${file.name}. Your browser may not support this format.`,
            ),
          );
        image.src = url;
      });

      return {
        source: img,
        width: img.naturalWidth,
        height: img.naturalHeight,
        cleanup: () => URL.revokeObjectURL(url),
      };
    } catch (decodeError) {
      URL.revokeObjectURL(url);
      throw decodeError;
    }
  }
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Image encoding failed."));
      }
    }, mime, quality);
  });
}
