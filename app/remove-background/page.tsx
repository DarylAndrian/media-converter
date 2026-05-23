"use client";

import { useState, useCallback } from "react";
import { DropZone } from "@/components/DropZone";
import { removeBackground } from "@imgly/background-removal";

export default function RemoveBackgroundPage() {
  const [file, setFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<string>("");

  const handleFilesChange = useCallback((files: File[]) => {
    if (files.length > 0) {
      const selectedFile = files[0];
      setFile(selectedFile);
      setOriginalUrl(URL.createObjectURL(selectedFile));
      setResultUrl(null);
      setProgress("");
    } else {
      setFile(null);
      setOriginalUrl(null);
      setResultUrl(null);
      setProgress("");
    }
  }, []);

  const processImage = async () => {
    if (!file) return;

    try {
      setIsProcessing(true);
      setProgress("Initializing model (this may take a moment on first run)...");

      const config = {
        progress: (key: string, current: number, total: number) => {
          if (key.includes("fetch")) {
            setProgress(`Downloading AI models... ${Math.round((current / total) * 100)}%`);
          } else if (key === "compute:inference") {
            setProgress("Processing image...");
          }
        },
      };

      const imageBlob = await removeBackground(file, config);
      const url = URL.createObjectURL(imageBlob);
      setResultUrl(url);
      setProgress("Done!");
    } catch (error) {
      console.error("Error removing background:", error);
      setProgress("An error occurred during processing.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!resultUrl || !file) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    // Original filename might be image.jpg, we want image-nobg.png
    const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
    a.download = `${nameWithoutExt}-nobg.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <main className="mx-auto max-w-4xl px-6 py-12 sm:px-8">
      <div className="mb-12">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Background Remover
        </h1>
        <p className="mt-4 text-lg text-slate-400">
          Remove backgrounds from images instantly. Runs entirely in your browser using AI.
        </p>
      </div>

      <div className="space-y-8">
        {!file && (
          <DropZone
            files={[]}
            onFilesChange={handleFilesChange}
            accept={{ "image/*": [".jpg", ".jpeg", ".png", ".webp"] }}
            dropLabel="Drag & drop an image here"
            activeDropLabel="Drop to start"
            hintLabel="Supports JPG, PNG, and WebP"
          />
        )}

        {file && originalUrl && (
          <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-6 backdrop-blur">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-white">{file.name}</h3>
                <p className="text-sm text-slate-400">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
              <button
                onClick={() => handleFilesChange([])}
                className="text-sm font-medium text-slate-400 hover:text-white transition-colors"
                disabled={isProcessing}
              >
                Clear
              </button>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-400">Original</p>
                <div className="relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-black/50">
                  <img
                    src={originalUrl}
                    alt="Original"
                    className="h-full w-full object-contain"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-400">Result</p>
                <div className="relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-slate-800/50 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxyZWN0IHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iI2ZmZiIgZmlsbC1vcGFjaXR5PSIwLjEiLz4KPHJlY3QgeD0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iIzAwMCIgZmlsbC1vcGFjaXR5PSIwLjEiLz4KPHJlY3QgeT0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iIzAwMCIgZmlsbC1vcGFjaXR5PSIwLjEiLz4KPHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIi8+Cjwvc3ZnPg==')]">
                  {resultUrl ? (
                    <img
                      src={resultUrl}
                      alt="Result"
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <span className="text-sm text-slate-500">
                        {isProcessing ? progress || "Processing..." : "Not processed yet"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-center gap-4">
              {!resultUrl ? (
                <button
                  onClick={processImage}
                  disabled={isProcessing}
                  className="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
                >
                  {isProcessing ? "Processing..." : "Remove Background"}
                </button>
              ) : (
                <button
                  onClick={handleDownload}
                  className="rounded-lg bg-green-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600"
                >
                  Download Transparent PNG
                </button>
              )}
            </div>
            {isProcessing && (
              <p className="mt-4 text-center text-sm text-slate-400">{progress}</p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
