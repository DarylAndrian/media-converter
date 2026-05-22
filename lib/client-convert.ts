import JSZip from "jszip";

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

export async function convertSingleFile(
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

    if (response.status >= 500) {
      throw new Error(
        payload?.error ??
          `Server error while converting ${file.name}. The file may be too large for the hosting limit.`,
      );
    }

    throw new Error(payload?.error ?? `Failed to convert ${file.name}.`);
  }

  const blob = await response.blob();
  const filename = getFilenameFromDisposition(
    response.headers.get("Content-Disposition"),
    fallbackFilename(file, format),
  );

  return { blob, filename };
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
