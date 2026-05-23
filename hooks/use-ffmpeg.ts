"use client";

import { useCallback, useEffect, useState } from "react";
import type { FFmpeg } from "@ffmpeg/ffmpeg";
import { toCachedBlobURL } from "@/lib/ffmpeg-cache";

const CORE_VERSION = "0.12.9";
const LOAD_TIMEOUT_MS = 120_000;

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

async function createFfmpegInstance(): Promise<FFmpeg> {
  const [{ FFmpeg }] = await Promise.all([import("@ffmpeg/ffmpeg")]);

  const ffmpeg = new FFmpeg();
  const assetBase = getAssetBaseUrl();

  notifyProgress(5);

  const coreURL = await toCachedBlobURL(
    `${assetBase}/ffmpeg-core.js`,
    "text/javascript",
    `ffmpeg-core.js@${CORE_VERSION}`,
    (ratio) => {
      notifyProgress(5 + ratio * 15);
    },
  );

  const wasmURL = await toCachedBlobURL(
    `${assetBase}/ffmpeg-core.wasm`,
    "application/wasm",
    `ffmpeg-core.wasm@${CORE_VERSION}`,
    (ratio) => {
      notifyProgress(20 + ratio * 70);
    },
  );

  notifyProgress(92);

  // Serve worker from /public to bypass Turbopack's worker bootstrap.
  await ffmpeg.load({
    coreURL,
    wasmURL,
    classWorkerURL: `${assetBase}/worker/worker.js`,
  });

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

  notifyProgress(0);

  loadPromise = withTimeout(
    createFfmpegInstance(),
    "Video converter timed out while loading. Refresh and try again.",
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
