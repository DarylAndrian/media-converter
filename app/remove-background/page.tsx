"use client";

import { useState, useCallback, useRef } from "react";
import { DropZone } from "@/components/DropZone";
import { removeBackground } from "@imgly/background-removal";

type QualityMode = "fast" | "high";

/**
 * Apply a Gaussian-like blur to the alpha channel edges on the client side.
 * Uses canvas to soften jagged segmentation edges.
 */
function smoothAlphaEdges(
  sourceCanvas: HTMLCanvasElement,
  blurRadius: number,
): HTMLCanvasElement {
  const { width, height } = sourceCanvas;
  const ctx = sourceCanvas.getContext("2d")!;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Extract alpha channel
  const alpha = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    alpha[i] = data[i * 4 + 3];
  }

  // Box blur on alpha channel (approximates Gaussian with multiple passes)
  const passes = Math.max(1, Math.round(blurRadius));
  let current = alpha;
  let next = new Float32Array(width * height);

  for (let pass = 0; pass < passes; pass++) {
    const radius = Math.ceil(blurRadius / passes);

    // Horizontal pass
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let count = 0;
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          if (nx >= 0 && nx < width) {
            sum += current[y * width + nx];
            count++;
          }
        }
        next[y * width + x] = sum / count;
      }
    }

    // Vertical pass
    const temp = new Float32Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let count = 0;
        for (let dy = -radius; dy <= radius; dy++) {
          const ny = y + dy;
          if (ny >= 0 && ny < height) {
            sum += next[ny * width + x];
            count++;
          }
        }
        temp[y * width + x] = sum / count;
      }
    }
    current = temp;
    next = new Float32Array(width * height);
  }

  // Apply refined alpha: keep fully opaque/transparent pixels, blur only edges
  const refinedAlpha = current;
  for (let i = 0; i < width * height; i++) {
    const original = alpha[i];
    if (original === 0) {
      refinedAlpha[i] = 0;
    } else if (original === 255) {
      refinedAlpha[i] = 255;
    }
    // Otherwise keep the blurred value (edge zone)
  }

  // Create output canvas with refined alpha
  const outCanvas = document.createElement("canvas");
  outCanvas.width = width;
  outCanvas.height = height;
  const outCtx = outCanvas.getContext("2d")!;
  const outImageData = outCtx.createImageData(width, height);
  const outData = outImageData.data;

  for (let i = 0; i < width * height; i++) {
    outData[i * 4 + 0] = data[i * 4 + 0];
    outData[i * 4 + 1] = data[i * 4 + 1];
    outData[i * 4 + 2] = data[i * 4 + 2];
    outData[i * 4 + 3] = Math.round(refinedAlpha[i]);
  }

  outCtx.putImageData(outImageData, 0, 0);
  return outCanvas;
}

/**
 * Client-side background removal with optional edge smoothing.
 */
async function removeBackgroundClient(
  file: File,
  onProgress?: (message: string) => void,
): Promise<Blob> {
  onProgress?.("Initializing model (this may take a moment on first run)...");

  const config = {
    model: "isnet" as const,
    progress: (key: string, current: number, total: number) => {
      if (key.includes("fetch")) {
        onProgress?.(
          `Downloading AI models... ${Math.round((current / total) * 100)}%`,
        );
      } else if (key === "compute:inference") {
        onProgress?.("Processing image...");
      }
    },
  };

  const imageBlob = await removeBackground(file, config);

  // Apply client-side edge smoothing
  onProgress?.("Smoothing edges...");

  const img = new Image();
  const url = URL.createObjectURL(imageBlob);

  return new Promise((resolve, reject) => {
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);

      // Apply edge smoothing (2-pass box blur with radius ~1.5)
      const smoothed = smoothAlphaEdges(canvas, 2);

      smoothed.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to generate output image."));
          }
        },
        "image/png",
        1.0,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load processed image."));
    };
    img.src = url;
  });
}

/**
 * Server-side background removal via API.
 */
async function removeBackgroundServerSide(
  file: File,
  quality: "fast" | "high",
  onProgress?: (message: string) => void,
): Promise<{ blob: Blob; filename: string }> {
  onProgress?.("Sending image to server...");

  const formData = new FormData();
  formData.append("image", file);
  formData.append("quality", quality);

  const response = await fetch("/api/remove-background", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;

    if (response.status === 413) {
      throw new Error(
        payload?.error ??
        "Image is too large for server-side processing. Try Fast mode instead.",
      );
    }

    throw new Error(payload?.error ?? "Server-side background removal failed.");
  }

  const blob = await response.blob();

  // Extract filename from Content-Disposition header
  const disposition = response.headers.get("Content-Disposition");
  const match = disposition?.match(/filename="([^"]+)"/i);
  const nameWithoutExt =
    file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
  const filename = match?.[1] ?? `${nameWithoutExt}-nobg.png`;

  return { blob, filename };
}

export default function RemoveBackgroundPage() {
  const [file, setFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultFilename, setResultFilename] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [quality, setQuality] = useState<QualityMode>("high");
  const [error, setError] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const handleFilesChange = useCallback((files: File[]) => {
    if (files.length > 0) {
      const selectedFile = files[0];
      setFile(selectedFile);
      setOriginalUrl(URL.createObjectURL(selectedFile));
      setResultUrl(null);
      setResultFilename(null);
      setProgress("");
      setError(null);
    } else {
      setFile(null);
      setOriginalUrl(null);
      setResultUrl(null);
      setResultFilename(null);
      setProgress("");
      setError(null);
    }
  }, []);

  const processImage = async () => {
    if (!file) return;

    try {
      setIsProcessing(true);
      setProgress("");
      setError(null);

      if (quality === "fast") {
        // Client-side processing with edge smoothing
        const resultBlob = await removeBackgroundClient(
          file,
          setProgress,
        );

        // Clean up previous object URL
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
        }

        const url = URL.createObjectURL(resultBlob);
        objectUrlRef.current = url;
        setResultUrl(url);

        const nameWithoutExt =
          file.name.substring(0, file.name.lastIndexOf(".")) ||
          file.name;
        setResultFilename(`${nameWithoutExt}-nobg.png`);
        setProgress("Done!");
      } else {
        // Server-side processing with edge refinement
        setProgress("Processing on server (this may take a moment)...");

        const { blob, filename } = await removeBackgroundServerSide(
          file,
          "high",
          setProgress,
        );

        // Clean up previous object URL
        if (objectUrlRef.current) {
          URL.revokeObjectURL(objectUrlRef.current);
        }

        const url = URL.createObjectURL(blob);
        objectUrlRef.current = url;
        setResultUrl(url);
        setResultFilename(filename);
        setProgress("Done!");
      }
    } catch (err) {
      console.error("Error removing background:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred during processing.",
      );
      setProgress("");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!resultUrl) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = resultFilename ?? "image-nobg.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="relative min-h-full overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.25),_transparent_45%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.18),_transparent_35%)]" />

      <main className="relative mx-auto flex min-h-full w-full max-w-4xl flex-col px-6 py-12 sm:px-8 sm:py-16">
        <header className="mb-10 text-center sm:text-left">
          <p className="mb-3 inline-flex rounded-full border border-indigo-400/30 bg-indigo-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200">
            Background Remover
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Background Remover
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
            Remove backgrounds from images with AI-powered edge
            refinement. Choose between fast browser-based processing
            or high-quality server-side processing.
          </p>
        </header>

        <section className="rounded-3xl border border-white/10 bg-white/95 p-6 text-slate-900 shadow-2xl shadow-indigo-950/30 backdrop-blur sm:p-8">
          <div className="space-y-8">
            {/* Quality Mode Toggle */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Quality mode
              </label>
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => setQuality("fast")}
                  disabled={isProcessing}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${quality === "fast"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                    }`}
                >
                  ⚡ Fast
                </button>
                <button
                  type="button"
                  onClick={() => setQuality("high")}
                  disabled={isProcessing}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${quality === "high"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                    }`}
                >
                  ✨ High Quality
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {quality === "fast"
                  ? "Runs in your browser — instant but basic edge quality."
                  : "Server-side processing with AI edge refinement for smoother results."}
              </p>
            </div>

            {!file && (
              <DropZone
                files={[]}
                onFilesChange={handleFilesChange}
                accept={{
                  "image/*": [".jpg", ".jpeg", ".png", ".webp"],
                }}
                dropLabel="Drag & drop an image here"
                activeDropLabel="Drop to start"
                hintLabel="Supports JPG, PNG, and WebP"
              />
            )}

            {file && originalUrl && (
              <div>
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-slate-900">
                      {file.name}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {(
                        file.size /
                        (1024 * 1024)
                      ).toFixed(2)}{" "}
                      MB
                    </p>
                  </div>
                  <button
                    onClick={() => handleFilesChange([])}
                    className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
                    disabled={isProcessing}
                  >
                    Clear
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-700">
                      Original
                    </p>
                    <div className="relative aspect-video overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                      <img
                        src={originalUrl}
                        alt="Original"
                        className="h-full w-full object-contain"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-700">
                      Result
                    </p>
                    <div className="relative aspect-video overflow-hidden rounded-xl border border-slate-200 bg-slate-100 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxyZWN0IHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iI2ZmZiIgZmlsbC1vcGFjaXR5PSIwLjEiLz4KPHJlY3QgeD0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iIzAwMCIgZmlsbC1vcGFjaXR5PSIwLjEiLz4KPHJlY3QgeT0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iIzAwMCIgZmlsbC1vcGFjaXR5PSIwLjEiLz4KPHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIi8+Cjwvc3ZnPg==')]">
                      {resultUrl ? (
                        <img
                          src={resultUrl}
                          alt="Result"
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <span className="text-sm text-slate-500">
                            {isProcessing
                              ? progress ||
                              "Processing..."
                              : "Not processed yet"}
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
                      {isProcessing
                        ? "Processing..."
                        : "Remove Background"}
                    </button>
                  ) : (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleDownload}
                        className="rounded-lg bg-green-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600"
                      >
                        Download Transparent PNG
                      </button>
                      <button
                        onClick={() => {
                          setResultUrl(null);
                          setResultFilename(null);
                          setProgress("");
                          setError(null);
                          if (objectUrlRef.current) {
                            URL.revokeObjectURL(
                              objectUrlRef.current,
                            );
                            objectUrlRef.current =
                              null;
                          }
                        }}
                        className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        Re-process
                      </button>
                    </div>
                  )}
                </div>

                {isProcessing && (
                  <p className="mt-4 text-center text-sm text-slate-500">
                    {progress}
                  </p>
                )}

                {error && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                {resultUrl && !isProcessing && (
                  <p className="mt-4 text-center text-xs text-slate-400">
                    {quality === "fast"
                      ? "Processed in your browser with edge smoothing."
                      : "Processed on server with AI edge refinement."}
                  </p>
                )}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}