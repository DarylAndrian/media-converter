const DB_NAME = "media-converter-ffmpeg";
const DB_VERSION = 1;
const STORE_NAME = "assets";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(request.error ?? new Error("Failed to open ffmpeg cache."));
    };

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

async function readCachedAsset(key: string): Promise<ArrayBuffer | null> {
  if (typeof indexedDB === "undefined") {
    return null;
  }

  try {
    const database = await openDatabase();

    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(key);

      request.onerror = () => {
        reject(request.error ?? new Error("Failed to read ffmpeg cache."));
      };

      request.onsuccess = () => {
        const value = request.result;
        resolve(value instanceof ArrayBuffer ? value : null);
      };
    });
  } catch {
    return null;
  }
}

async function writeCachedAsset(key: string, data: ArrayBuffer): Promise<void> {
  if (typeof indexedDB === "undefined") {
    return;
  }

  try {
    const database = await openDatabase();

    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const request = transaction.objectStore(STORE_NAME).put(data, key);

      request.onerror = () => {
        reject(request.error ?? new Error("Failed to write ffmpeg cache."));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  } catch {
    // Cache is best-effort; ignore write failures.
  }
}

export async function fetchAssetWithCache(
  url: string,
  cacheKey: string,
  onProgress?: (loadedRatio: number) => void,
): Promise<ArrayBuffer> {
  const cached = await readCachedAsset(cacheKey);

  if (cached) {
    onProgress?.(1);
    return cached;
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url} (${response.status}).`);
  }

  const contentLength = Number(response.headers.get("Content-Length") ?? "0");
  const reader = response.body?.getReader();

  if (!reader) {
    const data = await response.arrayBuffer();
    await writeCachedAsset(cacheKey, data);
    onProgress?.(1);
    return data;
  }

  const chunks: Uint8Array[] = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    if (value) {
      chunks.push(value);
      received += value.length;

      if (contentLength > 0) {
        onProgress?.(received / contentLength);
      }
    }
  }

  const data = new Uint8Array(received);
  let position = 0;

  for (const chunk of chunks) {
    data.set(chunk, position);
    position += chunk.length;
  }

  await writeCachedAsset(cacheKey, data.buffer);
  onProgress?.(1);

  return data.buffer;
}

export async function warmupFfmpegAssets(
  assetBase: string,
  version: string,
  onProgress?: (progress: number) => void,
): Promise<void> {
  await fetchAssetWithCache(
    `${assetBase}/ffmpeg-core.js`,
    `ffmpeg-core.js@${version}`,
    (ratio) => {
      onProgress?.(5 + ratio * 15);
    },
  );

  await fetchAssetWithCache(
    `${assetBase}/ffmpeg-core.wasm`,
    `ffmpeg-core.wasm@${version}`,
    (ratio) => {
      onProgress?.(20 + ratio * 70);
    },
  );
}
