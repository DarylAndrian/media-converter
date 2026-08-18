import JSZip from "jszip";
import { convertImage } from "@/lib/converter";
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

// Server-side fallback only (common formats convert in the browser). The cap
// matches the Netlify request-body ceiling — see lib/server-upload-limit.ts.

function getOutputFormat(value: FormDataEntryValue | null): OutputFormat {
  return normalizeOutputFormat(String(value ?? "png"));
}

function buildContentDisposition(filename: string): string {
  return `attachment; filename="${filename.replace(/"/g, "")}"`;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const outputFormat = getOutputFormat(formData.get("format"));
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
          error: `Upload must be under ${serverUploadLimitMB()} MB for server-side conversion.`,
        },
        { status: 413 },
      );
    }

    if (files.length === 1) {
      const file = files[0];
      const inputFormat = getInputFormatFromFilename(file.name);
      const inputBuffer = Buffer.from(await file.arrayBuffer());
      const converted = await convertImage(inputBuffer, inputFormat, outputFormat);
      const filename = replaceFileExtension(file.name, converted.extension);

      return new Response(new Uint8Array(converted.buffer), {
        headers: {
          "Content-Type": converted.mimeType,
          "Content-Disposition": buildContentDisposition(filename),
        },
      });
    }

    const zip = new JSZip();

    for (const file of files) {
      const inputFormat = getInputFormatFromFilename(file.name);
      const inputBuffer = Buffer.from(await file.arrayBuffer());
      const converted = await convertImage(inputBuffer, inputFormat, outputFormat);
      const filename = replaceFileExtension(file.name, converted.extension);

      zip.file(filename, converted.buffer);
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });

    return new Response(new Uint8Array(zipBuffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": buildContentDisposition("converted-images.zip"),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Image conversion failed.";

    return Response.json({ error: message }, { status: 400 });
  }
}
