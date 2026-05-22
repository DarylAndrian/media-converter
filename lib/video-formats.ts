export const VIDEO_OUTPUT_FORMATS = ["mp4", "mov", "avi", "mkv", "webm"] as const;

export type VideoOutputFormat = (typeof VIDEO_OUTPUT_FORMATS)[number];

export const VIDEO_INPUT_EXTENSIONS = ["mp4", "mov", "avi", "mkv", "webm"] as const;

const MIME_TYPES: Record<VideoOutputFormat, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  mkv: "video/x-matroska",
  webm: "video/webm",
};

export function normalizeVideoOutputFormat(format: string): VideoOutputFormat {
  const normalized = format.toLowerCase().replace(/^\./, "");

  if (!VIDEO_OUTPUT_FORMATS.includes(normalized as VideoOutputFormat)) {
    throw new Error(`Unsupported output format: ${format}`);
  }

  return normalized as VideoOutputFormat;
}

export function getVideoInputFormatFromFilename(filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase();

  if (!extension) {
    throw new Error(`Could not detect format for file: ${filename}`);
  }

  if (
    !VIDEO_INPUT_EXTENSIONS.includes(
      extension as (typeof VIDEO_INPUT_EXTENSIONS)[number],
    )
  ) {
    throw new Error(`Unsupported input format: .${extension}`);
  }

  return extension;
}

export function replaceVideoFileExtension(
  filename: string,
  extension: string,
): string {
  const baseName = filename.replace(/\.[^/.]+$/, "");
  return `${baseName}.${extension}`;
}

export function getVideoMimeType(format: VideoOutputFormat): string {
  return MIME_TYPES[format];
}

export function getVideoOutputExtension(format: VideoOutputFormat): string {
  return format;
}
