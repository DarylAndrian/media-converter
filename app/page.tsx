"use client";

import { useMemo, useState } from "react";
import { DropZone } from "@/components/DropZone";
import { OUTPUT_FORMATS } from "@/lib/formats";

const FORMAT_OPTIONS = OUTPUT_FORMATS.map((format) => ({
  value: format,
  label: format.toUpperCase(),
}));

function getFilenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) {
    return fallback;
  }

  const match = header.match(/filename="([^"]+)"/i);
  return match?.[1] ?? fallback;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [format, setFormat] = useState<string>("png");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const canConvert = files.length > 0 && !loading;

  const summary = useMemo(() => {
    if (files.length === 0) {
      return "Upload one or more images to get started.";
    }

    if (files.length === 1) {
      return `Ready to convert ${files[0].name} to ${format.toUpperCase()}.`;
    }

    return `Ready to convert ${files.length} images to ${format.toUpperCase()} and download as a ZIP file.`;
  }, [files, format]);

  const handleConvert = async () => {
    if (!canConvert) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));
      formData.append("format", format);

      const response = await fetch("/api/convert", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "Conversion failed.");
      }

      const blob = await response.blob();
      const fallbackName =
        files.length === 1
          ? `${files[0].name.replace(/\.[^/.]+$/, "")}.${format === "jpg" ? "jpg" : format}`
          : "converted-images.zip";
      const filename = getFilenameFromDisposition(
        response.headers.get("Content-Disposition"),
        fallbackName,
      );

      downloadBlob(blob, filename);
      setSuccessMessage(
        files.length === 1
          ? `Downloaded ${filename}.`
          : `Downloaded ${filename} with ${files.length} converted images.`,
      );
    } catch (convertError) {
      setError(
        convertError instanceof Error
          ? convertError.message
          : "Something went wrong during conversion.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-full overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.25),_transparent_45%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.18),_transparent_35%)]" />

      <main className="relative mx-auto flex min-h-full w-full max-w-4xl flex-col px-6 py-12 sm:px-8 sm:py-16">
        <header className="mb-10 text-center sm:text-left">
          <p className="mb-3 inline-flex rounded-full border border-indigo-400/30 bg-indigo-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200">
            Image Converter
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Convert images to any common format
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
            Upload a single image or a batch, choose your output format, and download
            instantly. Supports JPG, PNG, WEBP, TIFF, BMP, GIF, and HEIC/HEIF input.
          </p>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/95 p-6 text-slate-900 shadow-2xl shadow-indigo-950/30 backdrop-blur sm:p-8">
          <div className="mb-6 grid gap-4 sm:grid-cols-[1fr_220px] sm:items-end">
            <div>
              <label
                htmlFor="output-format"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Output format
              </label>
              <select
                id="output-format"
                value={format}
                onChange={(event) => setFormat(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              >
                {FORMAT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleConvert}
              disabled={!canConvert}
              className="inline-flex h-12 items-center justify-center rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {loading ? "Converting..." : "Convert and download"}
            </button>
          </div>

          <DropZone files={files} onFilesChange={setFiles} />

          <div className="mt-6 space-y-3">
            <p className="text-sm text-slate-600">{summary}</p>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {successMessage}
              </div>
            )}
          </div>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            {
              title: "Single or batch",
              body: "Convert one image or upload many files and receive a ZIP archive.",
            },
            {
              title: "HEIC friendly",
              body: "Import iPhone HEIC/HEIF photos and export them as JPG, PNG, WEBP, and more.",
            },
            {
              title: "Netlify ready",
              body: "Built for deployment on Netlify with server-side conversion powered by sharp.",
            },
          ].map((item) => (
            <article
              key={item.title}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur"
            >
              <h2 className="text-sm font-semibold text-white">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">{item.body}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
