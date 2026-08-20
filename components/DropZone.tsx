"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDropzone, type Accept } from "react-dropzone";
import { FileIcon, UploadIcon } from "@/components/icons";

interface DropZoneProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  accept: Accept;
  dropLabel?: string;
  activeDropLabel?: string;
  hintLabel?: string;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const PREVIEWABLE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/bmp",
  "image/avif",
  "image/svg+xml",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
  "video/x-msvideo",
]);

function isPreviewable(file: File): boolean {
  return PREVIEWABLE_TYPES.has(file.type);
}

export function DropZone({
  files,
  onFilesChange,
  accept,
  dropLabel = "Drag and drop files here",
  activeDropLabel = "Drop your files here",
  hintLabel = "or click to browse.",
}: DropZoneProps) {
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  useEffect(() => {
    const urls = files.map((file) =>
      isPreviewable(file) ? URL.createObjectURL(file) : null,
    );
    setPreviewUrls(urls);

    return () => {
      urls.forEach((url) => {
        if (url) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [files]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      onFilesChange([...files, ...acceptedFiles]);
    },
    [files, onFilesChange],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    multiple: true,
  });

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, fileIndex) => fileIndex !== index));
  };

  const clearFiles = () => {
    onFilesChange([]);
  };

  const totalBytes = useMemo(
    () => files.reduce((sum, file) => sum + file.size, 0),
    [files],
  );

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          isDragActive
            ? "border-accent bg-accent-soft"
            : "border-line-strong bg-surface-2/60 hover:border-accent/60 hover:bg-accent-soft/40"
        }`}
      >
        <input {...getInputProps()} />
        <div className="mx-auto flex max-w-md flex-col items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-on-accent">
            <UploadIcon className="h-5 w-5" strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-base font-semibold text-ink">
              {isDragActive ? activeDropLabel : dropLabel}
            </p>
            <p className="mt-0.5 text-sm text-mut">{hintLabel}</p>
          </div>
        </div>
      </div>

      {files.length > 0 && (
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-ink">
              {files.length} file{files.length === 1 ? "" : "s"}
              <span className="ml-2 font-mono text-xs font-normal text-mut">
                {formatFileSize(totalBytes)}
              </span>
            </p>
            <button
              type="button"
              onClick={clearFiles}
              className="text-sm font-medium text-mut transition-colors hover:text-accent"
            >
              Clear all
            </button>
          </div>

          <ul className="grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">
            {files.map((file, index) => {
              const url = previewUrls[index] ?? null;
              const previewable = url !== null;

              return (
                <li
                  key={`${file.name}-${file.size}-${index}`}
                  className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/60 p-2"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-surface">
                    {previewable ? (
                      file.type.startsWith("video/") ? (
                        <video
                          src={url}
                          muted
                          preload="metadata"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <img
                          src={url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      )
                    ) : (
                      <FileIcon className="h-5 w-5 text-mut" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {file.name}
                    </p>
                    <p className="font-mono text-xs text-mut">
                      {formatFileSize(file.size)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-mut transition-colors hover:bg-surface hover:text-accent"
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}