"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/Alert";
import { Button } from "@/components/Button";
import { DropZone } from "@/components/DropZone";
import { ProgressBar } from "@/components/ProgressBar";
import { ToolShell } from "@/components/ToolShell";
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
  const {
    load,
    state,
    error: ffmpegError,
    isReady,
    isLoading,
    loadProgress,
  } = useFfmpeg();
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
      return "The converter engine failed to load. Refresh the page to try again.";
    }

    if (isLoading) {
      if (loadProgress !== null && loadProgress < 92) {
        return `Downloading the converter engine — one-time, ~31 MB, cached for future visits.`;
      }

      if (loadProgress !== null && loadProgress >= 92 && loadProgress < 100) {
        return `Initializing the converter engine. Compiling WASM can take up to a minute on first load.`;
      }

      return "Loading the converter engine...";
    }

    if (state === "idle") {
      return "Preparing the video converter...";
    }

    if (files.length === 0) {
      return "Add one or more videos to get started. Files are converted locally and never uploaded.";
    }

    if (files.length === 1) {
      return `Ready to convert ${files[0].name} to ${format.toUpperCase()}.`;
    }

    return `Ready to convert ${files.length} videos to ${format.toUpperCase()} and download as a ZIP file. Each video is converted one at a time in your browser.`;
  }, [files, format, isLoading, isReady, loadProgress, state]);

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
    if (isLoading || state === "idle") {
      return loadProgress !== null && loadProgress < 100
        ? `Loading converter... ${loadProgress}%`
        : "Loading converter...";
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
    <ToolShell
      eyebrow="Video Converter"
      title="Convert videos to*any common format*"
      description="Upload a single video or a batch, choose your output format, and download instantly. Supports MP4, MOV, AVI, MKV, and WEBM. All processing happens in your browser."
      features={[
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
      ]}
    >
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
        <div className="mb-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="sm:max-w-sm">
            <label
              htmlFor="video-output-format"
              className="mb-1.5 block text-sm font-medium text-ink"
            >
              Output format
            </label>
            <select
              id="video-output-format"
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

          <Button onClick={handleConvert} disabled={!canConvert} loading={loading && isReady}>
            {buttonLabel}
          </Button>
        </div>

        <div className="space-y-4">
          <DropZone
            files={files}
            onFilesChange={setFiles}
            accept={VIDEO_ACCEPT}
            dropLabel="Drag and drop videos here"
            activeDropLabel="Drop your videos here"
            hintLabel="Click to browse — MP4, MOV, AVI, MKV, WEBM."
          />

          {isLoading && loadProgress !== null && loadProgress < 100 && (
            <ProgressBar value={loadProgress} label="Loading converter engine" />
          )}

          {progress &&
            (progress.fileProgress !== undefined && progress.total === 1 ? (
              <ProgressBar
                value={progress.fileProgress * 100}
                label={`Converting ${files[0]?.name ?? "video"}`}
              />
            ) : (
              <ProgressBar
                value={(progress.completed / progress.total) * 100}
                label={`Converting ${progress.completed} of ${progress.total}`}
              />
            ))}

          <p className="text-sm leading-6 text-mut">{summary}</p>

          {sizeWarning && <Alert tone="warning">{sizeWarning}</Alert>}

          {(error || ffmpegError) && (
            <Alert tone="error">{error ?? ffmpegError}</Alert>
          )}

          {successMessage && <Alert tone="success">{successMessage}</Alert>}
        </div>
      </section>
    </ToolShell>
  );
}