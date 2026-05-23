"use client";

import { useCallback, useEffect, useState } from "react";
import type { FFmpeg } from "@ffmpeg/ffmpeg";
import { warmupFfmpegAssets } from "@/lib/ffmpeg-cache";

const CORE_VERSION = "0.12.9";
const LOAD_TIMEOUT_MS = 180_000;

type FfmpegState = "idle" | "loading" | "ready" | "error";

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;
const progressListeners = new Set<(progress: number) => void>();

function notifyProgress(progress: number) {
  for (const listener of progressListeners) {
    listener(progress);
  }
}

function getAssetBaseUrl(): string {
  return `${window.location.origin}/ffmpeg`;
}

function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(message));
    }, LOAD_TIMEOUT_MS);

    promise
      .then((value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error: unknown) => {
        window.clearTimeout(timeoutId);
        reject(error);
      });
  });
}

async function verifyWorkerAsset(url: string): Promise<void> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Missing ffmpeg asset at ${url} (${response.status}).`);
  }

  await response.text();
}

async function createFfmpegInstance(): Promise<FFmpeg> {
  const [{ FFmpeg }] = await Promise.all([import("@ffmpeg/ffmpeg")]);

  const ffmpeg = new FFmpeg();
  const assetBase = getAssetBaseUrl();
  const coreURL = `${assetBase}/ffmpeg-core.js`;
  const wasmURL = `${assetBase}/ffmpeg-core.wasm`;
  const classWorkerURL = `${assetBase}/worker/worker.js`;

  const loadLogs: string[] = [];
  ffmpeg.on("log", ({ message }) => {
    loadLogs.push(message);
  });

  notifyProgress(0);

  await verifyWorkerAsset(classWorkerURL);
  await warmupFfmpegAssets(assetBase, CORE_VERSION, notifyProgress);

  notifyProgress(92);

  // Use same-origin HTTP URLs (not blob URLs) so the module worker can load them.
  try {
    await ffmpeg.load({
      coreURL,
      wasmURL,
      classWorkerURL,
    });
  } catch (loadError) {
    const recentLogs = loadLogs.slice(-5).join("\n");
    const baseMessage =
      loadError instanceof Error ? loadError.message : "ffmpeg.load() failed.";

    throw new Error(
      recentLogs ? `${baseMessage}\n${recentLogs}` : baseMessage,
    );
  }

  notifyProgress(100);

  return ffmpeg;
}

async function loadFfmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance?.loaded) {
    notifyProgress(100);
    return ffmpegInstance;
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = withTimeout(
    createFfmpegInstance(),
    "Video converter timed out while initializing. Large WASM files can take up to 3 minutes on first load — refresh and try again.",
  )
    .then((ffmpeg) => {
      ffmpegInstance = ffmpeg;
      return ffmpeg;
    })
    .catch((error) => {
      loadPromise = null;
      ffmpegInstance = null;
      throw error;
    });

  return loadPromise;
}

export function useFfmpeg() {
  const [state, setState] = useState<FfmpegState>(() =>
    ffmpegInstance?.loaded ? "ready" : "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState<number | null>(() =>
    ffmpegInstance?.loaded ? 100 : null,
  );

  const load = useCallback(async (): Promise<FFmpeg> => {
    if (ffmpegInstance?.loaded) {
      setState("ready");
      setLoadProgress(100);
      return ffmpegInstance;
    }

    setState("loading");
    setError(null);

    try {
      const ffmpeg = await loadFfmpeg();
      setLoadProgress(100);
      setState("ready");
      return ffmpeg;
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Failed to load video converter.";
      setError(message);
      setState("error");
      setLoadProgress(null);
      throw loadError;
    }
  }, []);

  useEffect(() => {
    const listener = (progress: number) => {
      setLoadProgress(Math.round(progress));
    };

    progressListeners.add(listener);

    return () => {
      progressListeners.delete(listener);
    };
  }, []);

  return {
    load,
    state,
    error,
    loadProgress,
    isReady: state === "ready",
    isLoading: state === "loading",
  };
}
