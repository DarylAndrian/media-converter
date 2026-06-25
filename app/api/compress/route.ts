import JSZip from "jszip";
import { compressImageToTarget, COMPRESS_DEFAULT_TARGET_BYTES } from "@/lib/compress";
import {
  getInputFormatFromFilename,
  normalizeOutputFormat,
  replaceFileExtension,
  type OutputFormat,
} from "@/lib/formats";

export const runtime = "nodejs";
export const maxDuration = 60;

// Netlify synchronous functions reject request/response bodies above ~6 MB.
// Compress endpoint accepts larger single uploads because compression is the
// primary use case (large file → smaller output), but we still cap to keep
// serverless execution predictable.
const MAX_SINGLE_UPLOAD_BYTES = 25 * 1024 * 1024;
const MAX_BATCH_UPLOAD_BYTES = 25 * 1024 * 1024;

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

    if (files.some((file) => file.size > MAX_SINGLE_UPLOAD_BYTES)) {
      return Response.json(
        {
          error: `Each file must be under ${Math.floor(
            MAX_SINGLE_UPLOAD_BYTES / (1024 * 1024),
          )} MB. Compress larger files locally or in smaller batches.`,
        },
        { status: 413 },
      );
    }

    if (files.length > 1) {
      const totalBytes = files.reduce((sum, file) => sum + file.size, 0);

      if (totalBytes > MAX_BATCH_UPLOAD_BYTES) {
        return Response.json(
          {
            error:
              "Batch upload is too large for server-side processing. Compress files one at a time instead.",
          },
          { status: 413 },
        );
      }
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
