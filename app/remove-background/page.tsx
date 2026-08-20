"use client";

import { useState, useCallback, useRef } from "react";
import { Alert } from "@/components/Alert";
import { Button } from "@/components/Button";
import { DropZone } from "@/components/DropZone";
import { ProgressBar } from "@/components/ProgressBar";
import { ToolShell } from "@/components/ToolShell";
import { removeBackground } from "@imgly/background-removal";

type QualityMode = "fast" | "high";

/** Client-side edge smoothing config per quality mode. */
const EDGE_CONFIG = {
  fast: { blurRadius: 1, passes: 1 },
  high: { blurRadius: 2, passes: 2 },
} as const;

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
  quality: QualityMode,
  onProgress?: (message: string) => void,
): Promise<Blob> {
  onProgress?.("Initializing model (this may take a moment on first run)...");

  const edgeCfg = EDGE_CONFIG[quality];

  const config = {
    model: (quality === "fast" ? "isnet_quint8" : "isnet") as
      | "isnet_quint8"
      | "isnet",
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

      // Apply edge smoothing with quality-specific config
      const smoothed = smoothAlphaEdges(
        canvas,
        edgeCfg.blurRadius,
      );

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

const CHECKERBOARD =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CjxyZWN0IHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iI2ZmZiIgZmlsbC1vcGFjaXR5PSIwLjEiLz4KPHJlY3QgeD0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iIzAwMCIgZmlsbC1vcGFjaXR5PSIwLjEiLz4KPHJlY3QgeT0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iIzAwMCIgZmlsbC1vcGFjaXR5PSIwLjEiLz4KPHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIi8+Cjwvc3ZnPg==";

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

      // Both modes run client-side — fast uses quantized model, high uses full model + stronger smoothing
      const resultBlob = await removeBackgroundClient(
        file,
        quality,
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
    <ToolShell
      eyebrow="Background Remover"
      title="Remove backgrounds*in seconds*"
      description="Cut the subject out of any photo with AI segmentation and edge refinement — right in your browser. Choose between fast processing or high-quality mode with stronger smoothing."
      features={[
        {
          title: "Two quality modes",
          body: "Fast uses a quantized model with basic smoothing; High uses full precision with stronger edge refinement.",
        },
        {
          title: "Transparent PNG output",
          body: "Download the result as a PNG with a clean alpha channel, ready for compositing.",
        },
        {
          title: "Stays in the browser",
          body: "Your images never leave this device. The AI model runs locally on first use and is then cached.",
        },
      ]}
    >
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
        <div className="space-y-6">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">
              Quality mode
            </label>
            <div className="inline-flex gap-1 rounded-xl border border-line bg-surface-2 p-1">
              <button
                type="button"
                onClick={() => setQuality("fast")}
                disabled={isProcessing}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                  quality === "fast"
                    ? "bg-accent text-on-accent"
                    : "text-mut hover:text-ink"
                }`}
              >
                Fast
              </button>
              <button
                type="button"
                onClick={() => setQuality("high")}
                disabled={isProcessing}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
                  quality === "high"
                    ? "bg-accent text-on-accent"
                    : "text-mut hover:text-ink"
                }`}
              >
                High quality
              </button>
            </div>
            <p className="mt-2 text-xs text-mut">
              {quality === "fast"
                ? "Quantized model for faster processing with basic edge smoothing."
                : "Full-precision model with stronger edge smoothing for cleaner results."}
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
              hintLabel="Click to browse — JPG, PNG, WebP."
            />
          )}

          {file && originalUrl && (
            <div>
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-semibold text-ink">
                    {file.name}
                  </h3>
                  <p className="font-mono text-xs text-mut">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleFilesChange([])}
                  disabled={isProcessing}
                >
                  Clear
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-ink">Original</p>
                  <div className="relative aspect-video overflow-hidden rounded-xl border border-line bg-surface-2">
                    <img
                      src={originalUrl}
                      alt="Original"
                      className="h-full w-full object-contain"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-ink">Result</p>
                  <div
                    className={`relative aspect-video overflow-hidden rounded-xl border border-line ${resultUrl ? "" : "bg-surface-2"}`}
                    style={
                      resultUrl
                        ? { backgroundImage: `url(${CHECKERBOARD})` }
                        : undefined
                    }
                  >
                    {resultUrl ? (
                      <img
                        src={resultUrl}
                        alt="Result"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <span className="text-sm text-mut">
                          {isProcessing ? progress || "Processing..." : "Not processed yet"}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                {!resultUrl ? (
                  <Button
                    onClick={processImage}
                    disabled={isProcessing}
                    loading={isProcessing}
                  >
                    {isProcessing
                      ? "Processing..."
                      : "Remove background"}
                  </Button>
                ) : (
                  <>
                    <Button onClick={handleDownload}>
                      Download transparent PNG
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setResultUrl(null);
                        setResultFilename(null);
                        setProgress("");
                        setError(null);
                        if (objectUrlRef.current) {
                          URL.revokeObjectURL(objectUrlRef.current);
                          objectUrlRef.current = null;
                        }
                      }}
                    >
                      Re-process
                    </Button>
                  </>
                )}
              </div>

              {isProcessing && (
                <div className="mt-5">
                  <ProgressBar label={progress || "Processing..."} />
                </div>
              )}

              {error && (
                <div className="mt-4">
                  <Alert tone="error">{error}</Alert>
                </div>
              )}

              {resultUrl && !isProcessing && (
                <p className="mt-4 text-center font-mono text-xs text-mut">
                  Processed in your browser with
                  {quality === "fast"
                    ? " basic edge smoothing"
                    : " AI-powered edge refinement"}
                  .
                </p>
              )}
            </div>
          )}
        </div>
      </section>
    </ToolShell>
  );
}