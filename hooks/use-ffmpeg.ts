"use client";

import { useCallback, useRef, useState } from "react";
import type { FFmpeg } from "@ffmpeg/ffmpeg";

const FFMPEG_VERSION = "0.12.15";
const CORE_VERSION = "0.12.6";

type FfmpegState = "idle" | "loading" | "ready" | "error";

export function useFfmpeg() {
  const ffmpegRef = useRef<FFmpeg | null>(null);
  const loadPromiseRef = useRef<Promise<FFmpeg> | null>(null);
  const [state, setState] = useState<FfmpegState>("idle");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<FFmpeg> => {
    if (ffmpegRef.current?.loaded) {
      return ffmpegRef.current;
    }

    if (loadPromiseRef.current) {
      return loadPromiseRef.current;
    }

    setState("loading");
    setError(null);

    loadPromiseRef.current = (async () => {
      const [{ FFmpeg }, { toBlobURL }] = await Promise.all([
        import("@ffmpeg/ffmpeg"),
        import("@ffmpeg/util"),
      ]);

      const ffmpeg = new FFmpeg();
      const useMultiThread =
        typeof window !== "undefined" && window.crossOriginIsolated;

      const coreBase = useMultiThread
        ? `https://unpkg.com/@ffmpeg/core-mt@${CORE_VERSION}/dist/umd`
        : `https://unpkg.com/@ffmpeg/core@${CORE_VERSION}/dist/umd`;

      const loadConfig: {
        coreURL: string;
        wasmURL: string;
        workerURL?: string;
        classWorkerURL: string;
      } = {
        coreURL: await toBlobURL(`${coreBase}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${coreBase}/ffmpeg-core.wasm`, "application/wasm"),
        classWorkerURL: await toBlobURL(
          `https://unpkg.com/@ffmpeg/ffmpeg@${FFMPEG_VERSION}/dist/esm/worker.js`,
          "text/javascript",
        ),
      };

      if (useMultiThread) {
        loadConfig.workerURL = await toBlobURL(
          `${coreBase}/ffmpeg-core.worker.js`,
          "text/javascript",
        );
      }

      await ffmpeg.load(loadConfig);

      ffmpegRef.current = ffmpeg;
      setState("ready");
      return ffmpeg;
    })().catch((loadError) => {
      loadPromiseRef.current = null;
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Failed to load video converter.";
      setError(message);
      setState("error");
      throw loadError;
    });

    return loadPromiseRef.current;
  }, []);

  return {
    load,
    state,
    error,
    isReady: state === "ready",
    isLoading: state === "loading",
  };
}
