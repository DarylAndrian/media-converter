import JSZip from "jszip";
import { compressImageToTarget, COMPRESS_DEFAULT_TARGET_BYTES } from "@/lib/compress";
import {
  getInputFormatFromFilename,
  normalizeOutputFormat,
  replaceFileExtension,
  type OutputFormat,
} from "@/lib/formats";
import {
  SERVER_MAX_UPLOAD_BYTES,
  serverUploadLimitMB,
} from "@/lib/server-upload-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

// Server-side fallback only (common formats compress in the browser). The cap
// matches the Netlify request-body ceiling — see lib/server-upload-limit.ts.

function getTargetBytes(value: FormDataEntryValue | null): number {
  const raw = Number(value);
  if (!Number.isFinite(raw) || raw <= 0) {
    return COMPRESS_DEFAULT_TARGET_BYTES;
  }
  return Math.floor(raw);
}

function getFormatPreference(
  value: FormDataEntryValue | null,
): "keep" | OutputFormat {
  const raw = String(value ?? "keep").toLowerCase();
  if (raw === "keep" || raw === "") {
    return "keep";
  }
  return normalizeOutputFormat(raw);
}

function buildContentDisposition(filename: string): string {
  return `attachment; filename="${filename.replace(/"/g, "")}"`;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const targetBytes = getTargetBytes(formData.get("targetBytes"));
    const formatPreference = getFormatPreference(formData.get("format"));
    const entries = formData.getAll("files");

    const files = entries.filter(
      (entry): entry is File => entry instanceof File && entry.size > 0,
    );

    if (files.length === 0) {
      return Response.json({ error: "No files uploaded." }, { status: 400 });
    }

    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);

    if (totalBytes > SERVER_MAX_UPLOAD_BYTES) {
      return Response.json(
        {
          error: `Upload must be under ${serverUploadLimitMB()} MB for server-side compression.`,
        },
        { status: 413 },
      );
    }

    if (files.length === 1) {
      const file = files[0];
      const inputFormat = getInputFormatFromFilename(file.name);
      const inputBuffer = Buffer.from(await file.arrayBuffer());
      const result = await compressImageToTarget(inputBuffer, inputFormat, {
        targetBytes,
        formatPreference,
      });
      const filename = replaceFileExtension(file.name, result.extension);

      return new Response(new Uint8Array(result.buffer), {
        headers: {
          "Content-Type": result.mimeType,
          "Content-Disposition": buildContentDisposition(filename),
        },
      });
    }

    const zip = new JSZip();

    for (const file of files) {
      const inputFormat = getInputFormatFromFilename(file.name);
      const inputBuffer = Buffer.from(await file.arrayBuffer());
      const result = await compressImageToTarget(inputBuffer, inputFormat, {
        targetBytes,
        formatPreference,
      });
      const filename = replaceFileExtension(file.name, result.extension);

      zip.file(filename, result.buffer);
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

    return new Response(new Uint8Array(zipBuffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": buildContentDisposition("compressed-images.zip"),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Image compression failed.";

    return Response.json({ error: message }, { status: 400 });
  }
}
