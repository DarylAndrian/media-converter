"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert } from "@/components/Alert";
import { Button } from "@/components/Button";
import { DropZone } from "@/components/DropZone";
import { ProgressBar } from "@/components/ProgressBar";
import { ToolShell } from "@/components/ToolShell";
import {
  convertSingleVideoToAudio,
  convertVideosToAudioZip,
  hasLargeVideos,
} from "@/lib/client-audio-convert";
import { downloadBlob } from "@/lib/download";
import { AUDIO_INPUT_ACCEPT } from "@/lib/media-accept";
import { AUDIO_OUTPUT_FORMATS } from "@/lib/audio-formats";
import { useFfmpeg } from "@/hooks/use-ffmpeg";

const FORMAT_OPTIONS = AUDIO_OUTPUT_FORMATS.map((format) => ({
  value: format,
  label: format.toUpperCase(),
}));

export default function VideoToAudioPage() {
  const {
    load,
    state,
    error: ffmpegError,
    isReady,
    isLoading,
    loadProgress,
  } = useFfmpeg();
  const [files, setFiles] = useState<File[]>([]);
  const [format, setFormat] = useState<string>("mp3");
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

    return "One or more videos exceed 200 MB. Large files may use significant browser memory and take longer to process.";
  }, [files]);

  const canConvert = files.length > 0 && !loading && isReady;

  const summary = useMemo(() => {
    if (!isReady && !isLoading && state === "error") {
      return "The audio extractor failed to load. Refresh the page to try again.";
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
      return "Preparing the audio extractor...";
    }

    if (files.length === 0) {
      return "Add one or more videos to get started. Files are processed locally and never uploaded.";
    }

    if (files.length === 1) {
      return `Ready to extract audio from ${files[0].name} as ${format.toUpperCase()}.`;
    }

    return `Ready to extract audio from ${files.length} videos as ${format.toUpperCase()} and download as a ZIP file. Each video is processed one at a time in your browser.`;
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
        const { blob, filename } = await convertSingleVideoToAudio(
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
        const zipBlob = await convertVideosToAudioZip(
          ffmpeg,
          files,
          format,
          (completed, total, fileProgress) => {
            setProgress({ completed, total, fileProgress });
          },
        );
        const filename = "converted-audio.zip";
        downloadBlob(zipBlob, filename);
        setSuccessMessage(`Downloaded ${filename} with ${files.length} audio files.`);
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
          return `Extracting ${Math.round(progress.fileProgress * 100)}%...`;
        }

        return `Extracting ${progress.completed}/${progress.total}...`;
      }

      return "Extracting...";
    }

    return "Extract and download";
  })();

  return (
    <ToolShell
      eyebrow="Video to Audio"
      title="Extract audio from*any video*"
      description="Upload a single video or a batch, choose your output audio format, and download instantly. Exports to MP3, WAV, M4A, OGG, FLAC, and OPUS. All processing happens in your browser."
      features={[
        {
          title: "Single or batch",
          body: "Extract audio from one video or upload many files and receive a ZIP archive.",
        },
        {
          title: "Six audio formats",
          body: "Export to MP3, WAV, M4A, OGG, FLAC, or OPUS at 192 kbps for lossy formats.",
        },
        {
          title: "Private by design",
          body: "Videos never leave your device. Extraction runs entirely in your browser.",
        },
      ]}
    >
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
        <div className="mb-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="sm:max-w-sm">
            <label
              htmlFor="audio-output-format"
              className="mb-1.5 block text-sm font-medium text-ink"
            >
              Output format
            </label>
            <select
              id="audio-output-format"
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
            accept={AUDIO_INPUT_ACCEPT}
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
                label={`Extracting from ${files[0]?.name ?? "video"}`}
              />
            ) : (
              <ProgressBar
                value={(progress.completed / progress.total) * 100}
                label={`Extracting ${progress.completed} of ${progress.total}`}
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