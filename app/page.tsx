"use client";

import { useMemo, useState } from "react";
import { DropZone } from "@/components/DropZone";
import { convertFilesToZip, convertSingleFile } from "@/lib/client-convert";
import { downloadBlob } from "@/lib/download";
import { OUTPUT_FORMATS } from "@/lib/formats";
import { IMAGE_ACCEPT } from "@/lib/media-accept";

const FORMAT_OPTIONS = OUTPUT_FORMATS.map((format) => ({
  value: format,
  label: format.toUpperCase(),
}));

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [format, setFormat] = useState<string>("png");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const canConvert = files.length > 0 && !loading;

  const summary = useMemo(() => {
    if (files.length === 0) {
      return "Upload one or more images to get started. Conversion runs in your browser.";
    }

    if (files.length === 1) {
      return `Ready to convert ${files[0].name} to ${format.toUpperCase()}.`;
    }

    return `Ready to convert ${files.length} images to ${format.toUpperCase()} and download as a ZIP file. Each image is converted individually for reliable batch uploads.`;
  }, [files, format]);

  const handleConvert = async () => {
    if (!canConvert) {
      return;
    }

    setLoading(true);
    setProgress(null);
    setError(null);
    setSuccessMessage(null);

    try {
      if (files.length === 1) {
        const { blob, filename } = await convertSingleFile(files[0], format);
        downloadBlob(blob, filename);
        setSuccessMessage(`Downloaded ${filename}.`);
      } else {
        setProgress({ completed: 0, total: files.length });
        const zipBlob = await convertFilesToZip(files, format, (completed, total) => {
          setProgress({ completed, total });
        });
        const filename = "converted-images.zip";
        downloadBlob(zipBlob, filename);
        setSuccessMessage(`Downloaded ${filename} with ${files.length} converted images.`);
      }
    } catch (convertError) {
      setError(
        convertError instanceof Error
          ? convertError.message
          : "Something went wrong during conversion.",
      );
    } finally {
      setLoading(false);
      setProgress(null);
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
            instantly. Conversion runs in your browser with no upload limits for JPG,
            PNG, WebP, GIF, and BMP — HEIC/HEIF and TIFF are processed server-side.
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
              {loading
                ? progress
                  ? `Converting ${progress.completed}/${progress.total}...`
                  : "Converting..."
                : "Convert and download"}
            </button>
          </div>

          <DropZone
            files={files}
            onFilesChange={setFiles}
            accept={IMAGE_ACCEPT}
            dropLabel="Drag and drop images here"
            activeDropLabel="Drop your images here"
            hintLabel="or click to browse. Supports JPG, PNG, WEBP, TIFF, BMP, GIF, HEIC, and HEIF."
          />

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
              body: "Import iPhone HEIC/HEIF photos and export them as JPG, PNG, WEBP, and more (handled server-side).",
            },
            {
              title: "Runs in your browser",
              body: "JPG, PNG, and WebP conversions happen locally and never leave your device, so there are no server size limits.",
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
