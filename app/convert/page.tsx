"use client";

import { useMemo, useState } from "react";
import { Alert } from "@/components/Alert";
import { Button } from "@/components/Button";
import { DropZone } from "@/components/DropZone";
import { ProgressBar } from "@/components/ProgressBar";
import { ToolShell } from "@/components/ToolShell";
import { convertFilesToZip, convertSingleFile } from "@/lib/client-convert";
import { downloadBlob } from "@/lib/download";
import { OUTPUT_FORMATS } from "@/lib/formats";
import { IMAGE_ACCEPT } from "@/lib/media-accept";

const FORMAT_OPTIONS = OUTPUT_FORMATS.map((format) => ({
  value: format,
  label: format.toUpperCase(),
}));

export default function ConvertPage() {
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
      return "Add one or more images to get started. Conversion runs in your browser.";
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
    <ToolShell
      eyebrow="Image Converter"
      title="Convert images to*any common format*"
      description="Upload a single image or a batch, choose your output format, and download instantly. JPG, PNG, WebP, GIF, and BMP are processed in your browser — HEIC/HEIF and TIFF are handled server-side."
      features={[
        {
          title: "Single or batch",
          body: "Convert one image or upload many files and receive a ZIP archive.",
        },
        {
          title: "HEIC friendly",
          body: "Import iPhone HEIC/HEIF photos and export them as JPG, PNG, WEBP, and more.",
        },
        {
          title: "Runs in your browser",
          body: "JPG, PNG, and WebP conversions happen locally and never leave your device.",
        },
      ]}
    >
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
        <div className="mb-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="sm:max-w-sm">
            <label
              htmlFor="output-format"
              className="mb-1.5 block text-sm font-medium text-ink"
            >
              Output format
            </label>
            <select
              id="output-format"
              value={format}
              onChange={(event) => setFormat(event.target.value)}
              className="w-full rounded-xl border border-line-strong bg-surface px-4 py-3 font-mono text-sm font-medium text-ink outline-none transition focus:border-accent focus:ring-4 focus:ring-accent-soft"
            >
              {FORMAT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <Button onClick={handleConvert} disabled={!canConvert} loading={loading}>
            {loading
              ? progress
                ? `Converting ${progress.completed}/${progress.total}...`
                : "Converting..."
              : "Convert and download"}
          </Button>
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

          {progress && (
            <ProgressBar
              value={(progress.completed / progress.total) * 100}
              label={`Converting ${progress.completed} of ${progress.total}`}
            />
          )}

          <p className="text-sm leading-6 text-mut">{summary}</p>

          {error && (
            <Alert tone="error">{error}</Alert>
          )}

          {successMessage && <Alert tone="success">{successMessage}</Alert>}
        </div>
      </section>
    </ToolShell>
  );
}