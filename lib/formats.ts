export const OUTPUT_FORMATS = [
  "jpg",
  "png",
  "webp",
  "tiff",
  "gif",
] as const;

export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

export const SUPPORTED_INPUT_EXTENSIONS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "tiff",
  "tif",
  "bmp",
  "gif",
  "heic",
  "heif",
] as const;

const MIME_TYPES: Record<OutputFormat, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  tiff: "image/tiff",
  gif: "image/gif",
};

export function normalizeOutputFormat(format: string): OutputFormat {
  const normalized = format.toLowerCase().replace(/^\./, "");

  if (normalized === "jpeg") {
    return "jpg";
  }

  if (!OUTPUT_FORMATS.includes(normalized as OutputFormat)) {
    throw new Error(`Unsupported output format: ${format}`);
  }

  return normalized as OutputFormat;
}

export function getInputFormatFromFilename(filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase();

  if (!extension) {
    throw new Error(`Could not detect format for file: ${filename}`);
  }

  if (extension === "tif") {
    return "tiff";
  }

  if (
    !SUPPORTED_INPUT_EXTENSIONS.includes(
      extension as (typeof SUPPORTED_INPUT_EXTENSIONS)[number],
    )
  ) {
    throw new Error(`Unsupported input format: .${extension}`);
  }

  return extension === "jpeg" ? "jpg" : extension;
}

export function replaceFileExtension(filename: string, extension: string): string {
  const baseName = filename.replace(/\.[^/.]+$/, "");
  return `${baseName}.${extension}`;
}

export function getMimeType(format: OutputFormat): string {
  return MIME_TYPES[format];
}
