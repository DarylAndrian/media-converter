"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";

interface DropZoneProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
}

const ACCEPTED_TYPES = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/tiff": [".tiff", ".tif"],
  "image/bmp": [".bmp"],
  "image/gif": [".gif"],
  "image/heic": [".heic"],
  "image/heif": [".heif"],
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DropZone({ files, onFilesChange }: DropZoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      onFilesChange([...files, ...acceptedFiles]);
    },
    [files, onFilesChange],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    multiple: true,
  });

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, fileIndex) => fileIndex !== index));
  };

  const clearFiles = () => {
    onFilesChange([]);
  };

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
          isDragActive
            ? "border-indigo-400 bg-indigo-50/80"
            : "border-slate-300 bg-white/70 hover:border-indigo-300 hover:bg-indigo-50/40"
        }`}
      >
        <input {...getInputProps()} />
        <div className="mx-auto flex max-w-md flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-2xl text-indigo-600">
            +
          </div>
          <div>
            <p className="text-lg font-medium text-slate-900">
              {isDragActive ? "Drop your images here" : "Drag and drop images here"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              or click to browse. Supports JPG, PNG, WEBP, TIFF, BMP, GIF, HEIC, and HEIF.
            </p>
          </div>
        </div>
      </div>

      {files.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium text-slate-700">
              {files.length} file{files.length === 1 ? "" : "s"} selected
            </p>
            <button
              type="button"
              onClick={clearFiles}
              className="text-sm font-medium text-slate-500 transition-colors hover:text-red-600"
            >
              Clear all
            </button>
          </div>

          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {files.map((file, index) => (
              <li
                key={`${file.name}-${file.size}-${index}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{file.name}</p>
                  <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-white hover:text-red-600"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
