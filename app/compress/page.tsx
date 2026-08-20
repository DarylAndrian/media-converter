"use client";

import { useMemo, useState } from "react";
import { Alert } from "@/components/Alert";
import { Button } from "@/components/Button";
import { DropZone } from "@/components/DropZone";
import { ProgressBar } from "@/components/ProgressBar";
import { ToolShell } from "@/components/ToolShell";
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

const FIELD_CLASSES =
  "w-full rounded-xl border border-line-strong bg-surface px-4 py-3 font-mono text-sm font-medium text-ink outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft";

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
    )} MB. Very large images can use a lot of browser memory and may take a while to process.`;
  }, [files]);

  const canConvert = files.length > 0 && !loading;

  const summary = useMemo(() => {
    if (files.length === 0) {
      return "Add one or more images to get started. Compression runs in your browser.";
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
    <ToolShell
      eyebrow="Image Compressor"
      title="Compress images to a*target size*"
      description="Upload images, pick a budget, and download. An iterative quality + resize loop runs in your browser — no upload limits for JPG, PNG, WebP, GIF, and BMP. HEIC and TIFF are processed server-side."
      features={[
        {
          title: "Iterative quality loop",
          body: "Reduces quality from 85 → 30 in steps of 5, then resizes by 0.9x and repeats until the target size is met.",
        },
        {
          title: "Runs in your browser",
          body: "JPG, PNG, WebP, GIF, and BMP are compressed locally and never uploaded.",
        },
        {
          title: "Smart format fallbacks",
          body: "GIF and TIFF targets fall back to PNG in the browser, and oversized PNGs drop to JPEG to hit your budget.",
        },
      ]}
    >
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
        <div className="mb-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="compress-output-format"
              className="mb-1.5 block text-sm font-medium text-ink"
            >
              Output format
            </label>
            <select
              id="compress-output-format"
              value={format}
              onChange={(event) =>
                setFormat(event.target.value as CompressFormatPreference)
              }
              className={FIELD_CLASSES}
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
              className="mb-1.5 block text-sm font-medium text-ink"
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
                className={FIELD_CLASSES}
              />
              <select
                aria-label="Size unit"
                value={sizeUnit}
                onChange={(event) => {
                  const nextUnit = event.target.value as SizeUnit;
                  setSizeUnit(nextUnit);
                  setSizeValue(inputValueForBytes(targetBytes, nextUnit));
                }}
                className={FIELD_CLASSES.replace("w-full", "w-24")}
              >
                <option value="kb">KB</option>
                <option value="mb">MB</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="mr-1 font-mono text-xs font-medium tracking-wider text-mut uppercase">
            Presets
          </span>
          {SIZE_PRESETS.map((preset) => {
            const isActive = currentPresetMatch?.label === preset.label;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => handlePresetClick(preset.kilobytes)}
                className={`rounded-full px-3 py-1.5 font-mono text-xs font-semibold transition ${
                  isActive
                    ? "bg-accent text-on-accent"
                    : "border border-line-strong bg-surface text-mut hover:bg-surface-2 hover:text-ink"
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>

        <div className="space-y-4">
          <DropZone
            files={files}
            onFilesChange={setFiles}
            accept={IMAGE_ACCEPT}
            dropLabel="Drag and drop images here"
            activeDropLabel="Drop your images here"
            hintLabel="Click to browse — JPG, PNG, WEBP, TIFF, BMP, GIF, HEIC, HEIF."
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm leading-6 text-mut">{summary}</p>
            <Button onClick={handleConvert} disabled={!canConvert} loading={loading}>
              {buttonLabel}
            </Button>
          </div>

          {progress && (
            <ProgressBar
              value={(progress.completed / progress.total) * 100}
              label={`Compressing ${progress.completed} of ${progress.total}`}
            />
          )}

          {sizeWarning && <Alert tone="warning">{sizeWarning}</Alert>}

          {error && <Alert tone="error">{error}</Alert>}

          {successMessage && <Alert tone="success">{successMessage}</Alert>}
        </div>
      </section>
    </ToolShell>
  );
}