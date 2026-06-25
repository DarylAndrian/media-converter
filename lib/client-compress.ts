import JSZip from "jszip";

export type CompressFormatPreference = "keep" | "jpg" | "png" | "webp" | "gif" | "tiff";

export interface CompressRequestOptions {
  targetBytes: number;
  format: CompressFormatPreference;
}

function getFilenameFromDisposition(
  header: string | null,
  fallback: string,
): string {
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

export async function compressSingleFile(
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

    if (response.status >= 500) {
      throw new Error(
        payload?.error ??
          `Server error while compressing ${file.name}. The file may be too large for the hosting limit.`,
      );
    }

    throw new Error(payload?.error ?? `Failed to compress ${file.name}.`);
  }

  const blob = await response.blob();
  const filename = getFilenameFromDisposition(
    response.headers.get("Content-Disposition"),
    fallbackFilename(file, options.format),
  );

  return { blob, filename };
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

export const COMPRESS_LARGE_FILE_BYTES = 25 * 1024 * 1024;

export function hasLargeFiles(files: File[]): boolean {
  return files.some((file) => file.size > COMPRESS_LARGE_FILE_BYTES);
}
