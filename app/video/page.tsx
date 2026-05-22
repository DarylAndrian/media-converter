"use client";

import { useEffect, useMemo, useState } from "react";
import { DropZone } from "@/components/DropZone";
import {
  convertSingleVideo,
  convertVideosToZip,
  hasLargeVideos,
} from "@/lib/client-video-convert";
import { downloadBlob } from "@/lib/download";
import { VIDEO_ACCEPT } from "@/lib/media-accept";
import { VIDEO_OUTPUT_FORMATS } from "@/lib/video-formats";
import { useFfmpeg } from "@/hooks/use-ffmpeg";

const FORMAT_OPTIONS = VIDEO_OUTPUT_FORMATS.map((format) => ({
  value: format,
  label: format.toUpperCase(),
}));

export default function VideoPage() {
  const { load, state, error: ffmpegError, isReady, isLoading } = useFfmpeg();
  const [files, setFiles] = useState<File[]>([]);
  const [format, setFormat] = useState<string>("mp4");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{
    completed: number;
    total: number;
    fileProgress?: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    void load().catch(() => undefined);
  }, [load]);

  const sizeWarning = useMemo(() => {
    if (files.length === 0 || !hasLargeVideos(files)) {
      return null;
    }

    return "One or more videos exceed 200 MB. Large files may use significant browser memory and take longer to convert.";
  }, [files]);

  const canConvert = files.length > 0 && !loading && isReady;

  const summary = useMemo(() => {
    if (!isReady && !isLoading && state === "error") {
      return "Video converter failed to load. Refresh the page to try again.";
    }

    if (isLoading || state === "idle") {
      return "Loading converter engine... This is a one-time download (~31 MB) and will be cached by your browser.";
    }

    if (files.length === 0) {
      return "Upload one or more videos to get started. Files are converted locally and never uploaded.";
    }

    if (files.length === 1) {
      return `Ready to convert ${files[0].name} to ${format.toUpperCase()}.`;
    }

    return `Ready to convert ${files.length} videos to ${format.toUpperCase()} and download as a ZIP file. Each video is converted one at a time in your browser.`;
  }, [files, format, isLoading, isReady, state]);

  const handleConvert = async () => {
    if (!canConvert) {
      return;
    }

    setLoading(true);
    setProgress(null);
    setError(null);
    setSuccessMessage(null);

    try {
      const ffmpeg = await load();

      if (files.length === 1) {
        setProgress({ completed: 0, total: 1, fileProgress: 0 });
        const { blob, filename } = await convertSingleVideo(
          ffmpeg,
          files[0],
          format,
          (fileProgress) => {
            setProgress({ completed: 0, total: 1, fileProgress });
          },
        );
        downloadBlob(blob, filename);
        setSuccessMessage(`Downloaded ${filename}.`);
      } else {
        setProgress({ completed: 0, total: files.length });
        const zipBlob = await convertVideosToZip(
          ffmpeg,
          files,
          format,
          (completed, total, fileProgress) => {
            setProgress({ completed, total, fileProgress });
          },
        );
        const filename = "converted-videos.zip";
        downloadBlob(zipBlob, filename);
        setSuccessMessage(`Downloaded ${filename} with ${files.length} converted videos.`);
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

  const buttonLabel = (() => {
    if (isLoading || (state === "idle" && !isReady)) {
      return "Loading converter...";
    }

    if (loading) {
      if (progress) {
        if (progress.fileProgress !== undefined && progress.total === 1) {
          return `Converting ${Math.round(progress.fileProgress * 100)}%...`;
        }

        return `Converting ${progress.completed}/${progress.total}...`;
      }

      return "Converting...";
    }

    return "Convert and download";
  })();

  return (
    <div className="relative min-h-full overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.25),_transparent_45%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.18),_transparent_35%)]" />

      <main className="relative mx-auto flex min-h-full w-full max-w-4xl flex-col px-6 py-12 sm:px-8 sm:py-16">
        <header className="mb-10 text-center sm:text-left">
          <p className="mb-3 inline-flex rounded-full border border-indigo-400/30 bg-indigo-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200">
            Video Converter
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Convert videos to any common format
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
            Upload a single video or a batch, choose your output format, and download
            instantly. Supports MP4, MOV, AVI, MKV, and WEBM. All processing happens in
            your browser.
          </p>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/95 p-6 text-slate-900 shadow-2xl shadow-indigo-950/30 backdrop-blur sm:p-8">
          <div className="mb-6 grid gap-4 sm:grid-cols-[1fr_220px] sm:items-end">
            <div>
              <label
                htmlFor="video-output-format"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Output format
              </label>
              <select
                id="video-output-format"
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
              {buttonLabel}
            </button>
          </div>

          <DropZone
            files={files}
            onFilesChange={setFiles}
            accept={VIDEO_ACCEPT}
            dropLabel="Drag and drop videos here"
            activeDropLabel="Drop your videos here"
            hintLabel="or click to browse. Supports MP4, MOV, AVI, MKV, and WEBM."
          />

          <div className="mt-6 space-y-3">
            <p className="text-sm text-slate-600">{summary}</p>

            {sizeWarning && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {sizeWarning}
              </div>
            )}

            {(error || ffmpegError) && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error ?? ffmpegError}
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
              body: "Convert one video or upload many files and receive a ZIP archive.",
            },
            {
              title: "Private by design",
              body: "Videos never leave your device. Conversion runs entirely in your browser.",
            },
            {
              title: "No upload limits",
              body: "No server size caps. Browser memory is the only practical constraint.",
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
