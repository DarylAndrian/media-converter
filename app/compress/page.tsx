"use client";

import { useMemo, useState } from "react";
import { DropZone } from "@/components/DropZone";
import {
  COMPRESS_LARGE_FILE_BYTES,
  compressFilesToZip,
  compressSingleFile,
  hasLargeFiles,
  type CompressFormatPreference,
} from "@/lib/client-compress";
import { downloadBlob } from "@/lib/download";
import { IMAGE_ACCEPT } from "@/lib/media-accept";
import { COMPRESS_DEFAULT_TARGET_BYTES } from "@/lib/compress-defaults";

type SizeUnit = "kb" | "mb";

const FORMAT_OPTIONS: { value: CompressFormatPreference; label: string }[] = [
  { value: "keep", label: "Keep original" },
  { value: "jpg", label: "JPG" },
  { value: "png", label: "PNG" },
  { value: "webp", label: "WebP" },
  { value: "gif", label: "GIF" },
];

const SIZE_PRESETS: { label: string; kilobytes: number }[] = [
  { label: "500 KB", kilobytes: 500 },
  { label: "1 MB", kilobytes: 1024 },
  { label: "1.5 MB", kilobytes: 1536 },
  { label: "2 MB", kilobytes: 2048 },
  { label: "5 MB", kilobytes: 5120 },
];

function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function bytesForInput(value: number, unit: SizeUnit): number {
  if (!Number.isFinite(value) || value <= 0) {
    return COMPRESS_DEFAULT_TARGET_BYTES;
  }
  return Math.floor(value * (unit === "mb" ? 1024 * 1024 : 1024));
}

function inputValueForBytes(bytes: number, unit: SizeUnit): number {
  return unit === "mb"
    ? Math.round((bytes / (1024 * 1024)) * 100) / 100
    : Math.round(bytes / 1024);
}

export default function CompressPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [format, setFormat] = useState<CompressFormatPreference>("keep");
  const [sizeValue, setSizeValue] = useState<number>(() =>
    inputValueForBytes(COMPRESS_DEFAULT_TARGET_BYTES, "mb"),
  );
  const [sizeUnit, setSizeUnit] = useState<SizeUnit>("mb");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ completed: number; total: number } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const targetBytes = useMemo(
    () => bytesForInput(sizeValue, sizeUnit),
    [sizeValue, sizeUnit],
  );

  const clientOptions = useMemo(
    () => ({ targetBytes, format }),
    [targetBytes, format],
  );

  const sizeWarning = useMemo(() => {
    if (files.length === 0 || !hasLargeFiles(files)) {
      return null;
    }
    return `One or more files exceed ${Math.floor(
      COMPRESS_LARGE_FILE_BYTES / (1024 * 1024),
    )} MB. Large files may use significant server time and could hit upload limits.`;
  }, [files]);

  const canConvert = files.length > 0 && !loading;

  const summary = useMemo(() => {
    if (files.length === 0) {
      return "Upload one or more images to get started.";
    }

    const formatLabel =
      format === "keep"
        ? "their original format"
        : format.toUpperCase();

    if (files.length === 1) {
      return `Ready to compress ${files[0].name} (${formatSize(
        files[0].size,
      )}) to under ${formatSize(targetBytes)} as ${formatLabel}.`;
    }

    return `Ready to compress ${files.length} images (${formatSize(
      files.reduce((sum, file) => sum + file.size, 0),
    )} total) to under ${formatSize(targetBytes)} each as ${formatLabel} and download as a ZIP. Each image is processed one at a time.`;
  }, [files, format, targetBytes]);

  const handlePresetClick = (kilobytes: number) => {
    if (kilobytes >= 1024) {
      setSizeUnit("mb");
      setSizeValue(Math.round((kilobytes / 1024) * 100) / 100);
    } else {
      setSizeUnit("kb");
      setSizeValue(kilobytes);
    }
  };

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
        const { blob, filename } = await compressSingleFile(
          files[0],
          clientOptions,
        );
        downloadBlob(blob, filename);
        const ratio = Math.max(
          0,
          Math.round(((files[0].size - blob.size) / files[0].size) * 100),
        );
        setSuccessMessage(
          `Downloaded ${filename} (${formatSize(files[0].size)} → ${formatSize(
            blob.size,
          )}, ${ratio}% smaller).`,
        );
      } else {
        setProgress({ completed: 0, total: files.length });
        const zipBlob = await compressFilesToZip(
          files,
          clientOptions,
          (completed, total) => {
            setProgress({ completed, total });
          },
        );
        const filename = "compressed-images.zip";
        downloadBlob(zipBlob, filename);
        setSuccessMessage(
          `Downloaded ${filename} with ${files.length} compressed images.`,
        );
      }
    } catch (convertError) {
      setError(
        convertError instanceof Error
          ? convertError.message
          : "Something went wrong during compression.",
      );
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const buttonLabel = (() => {
    if (loading) {
      if (progress) {
        return `Compressing ${progress.completed}/${progress.total}...`;
      }
      return "Compressing...";
    }
    return "Compress and download";
  })();

  const currentPresetMatch = SIZE_PRESETS.find((preset) => {
    const presetBytes = preset.kilobytes * 1024;
    return Math.abs(presetBytes - targetBytes) < 1024;
  });

  return (
    <div className="relative min-h-full overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.25),_transparent_45%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.18),_transparent_35%)]" />

      <main className="relative mx-auto flex min-h-full w-full max-w-4xl flex-col px-6 py-12 sm:px-8 sm:py-16">
        <header className="mb-10 text-center sm:text-left">
          <p className="mb-3 inline-flex rounded-full border border-indigo-400/30 bg-indigo-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200">
            Image Compressor
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Compress images to any target size
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
            Upload images, pick a target size, and download. Uses an iterative
            quality + resize loop to fit any byte budget. Supports JPG, PNG, WEBP,
            GIF, BMP, TIFF, and HEIC input.
          </p>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/95 p-6 text-slate-900 shadow-2xl shadow-indigo-950/30 backdrop-blur sm:p-8">
          <div className="mb-6 grid gap-4 sm:grid-cols-2 sm:items-end">
            <div>
              <label
                htmlFor="compress-output-format"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Output format
              </label>
              <select
                id="compress-output-format"
                value={format}
                onChange={(event) =>
                  setFormat(event.target.value as CompressFormatPreference)
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
              >
                {FORMAT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="compress-target-size"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Target size
              </label>
              <div className="flex gap-2">
                <input
                  id="compress-target-size"
                  type="number"
                  min={1}
                  step={sizeUnit === "mb" ? 0.1 : 10}
                  value={sizeValue}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    if (Number.isFinite(next) && next > 0) {
                      setSizeValue(next);
                    }
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                />
                <select
                  aria-label="Size unit"
                  value={sizeUnit}
                  onChange={(event) => {
                    const nextUnit = event.target.value as SizeUnit;
                    setSizeUnit(nextUnit);
                    setSizeValue(inputValueForBytes(targetBytes, nextUnit));
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                >
                  <option value="kb">KB</option>
                  <option value="mb">MB</option>
                </select>
              </div>
            </div>
          </div>

          <div className="mb-6 flex flex-wrap gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Presets:
            </span>
            {SIZE_PRESETS.map((preset) => {
              const isActive = currentPresetMatch?.label === preset.label;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handlePresetClick(preset.kilobytes)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    isActive
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <div className="mb-6 flex justify-end">
            <button
              type="button"
              onClick={handleConvert}
              disabled={!canConvert}
              className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
            >
              {buttonLabel}
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

            {sizeWarning && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {sizeWarning}
              </div>
            )}

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
              title: "Iterative quality loop",
              body: "Reduces quality from 85 → 30 in steps of 5, then resizes by 0.9x and repeats until the target size is met.",
            },
            {
              title: "Smart format fallbacks",
              body: "PNG and GIF fall back to JPG when lossless can't fit. BMP, TIFF, and HEIC are converted to JPG.",
            },
            {
              title: "PDF compression",
              body: (
                <>
                  For PDFs, use the companion Python CLI at{" "}
                  <code className="rounded bg-slate-800/60 px-1.5 py-0.5 text-xs text-slate-100">
                    D:\ai-and-code\image-compressor
                  </code>{" "}
                  — server-side PDF compression needs Ghostscript which
                  isn't available on Netlify functions.
                </>
              ),
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
