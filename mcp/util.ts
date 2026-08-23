import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

export interface ToolTextResult {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export function textResult(text: string): ToolTextResult {
  return { content: [{ type: "text", text }] };
}

export function errorResult(text: string): ToolTextResult {
  return { isError: true, content: [{ type: "text", text }] };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** Resolve an input path and verify the file exists. */
export async function resolveInputFile(inputPath: string): Promise<string> {
  const absolute = path.resolve(inputPath);

  try {
    const stats = await fs.stat(absolute);
    if (!stats.isFile()) {
      throw new Error(`Not a file: ${absolute}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Input file not found: ${absolute}`);
    }
    throw error;
  }

  return absolute;
}

/** Write a buffer, creating parent directories as needed. */
export async function writeOutputFile(
  outputPath: string,
  buffer: Buffer,
): Promise<string> {
  const absolute = path.resolve(outputPath);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, buffer);
  return absolute;
}

/** Default output path: same directory/name as input with a new extension. */
export function defaultOutputPath(inputPath: string, extension: string): string {
  const base = inputPath.replace(/\.[^/.]+$/, "");
  return `${base}.${extension}`;
}

function runCommand(
  command: string,
  args: string[],
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      reject(error);
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const tail = stderr.trim().split("\n").slice(-5).join("\n");
        reject(new Error(`${command} exited with code ${code}:\n${tail}`));
      }
    });
  });
}

const FFMPEG_INSTALL_HINT =
  "ffmpeg was not found on PATH. Install it (https://ffmpeg.org/download.html, " +
  "or `winget install ffmpeg` on Windows) and restart the MCP server.";

/** Verify that ffmpeg is available, throwing a friendly error otherwise. */
export async function ensureFfmpeg(): Promise<void> {
  try {
    await runCommand("ffmpeg", ["-version"]);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(FFMPEG_INSTALL_HINT);
    }
    throw error;
  }
}

/** Run ffmpeg with the given arguments (-y is prepended automatically). */
export async function runFfmpeg(args: string[]): Promise<string> {
  await ensureFfmpeg();
  const { stderr } = await runCommand("ffmpeg", ["-y", ...args]);
  return stderr;
}

/** Run ffprobe and return parsed JSON metadata for a media file. */
export async function runFfprobe(inputPath: string): Promise<unknown> {
  try {
    const { stdout } = await runCommand("ffprobe", [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      inputPath,
    ]);
    return JSON.parse(stdout);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        "ffprobe was not found on PATH. It ships with ffmpeg — install ffmpeg first.",
      );
    }
    throw error;
  }
}
