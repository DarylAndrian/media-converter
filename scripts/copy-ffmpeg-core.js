const fs = require("fs");
const path = require("path");

const projectRoot = path.join(__dirname, "..");
const destDir = path.join(projectRoot, "public", "ffmpeg");
const workerDestDir = path.join(destDir, "worker");

const esmCoreDir = path.join(
  projectRoot,
  "node_modules",
  "@ffmpeg",
  "core",
  "dist",
  "esm",
);
const ffmpegEsmDir = path.join(
  projectRoot,
  "node_modules",
  "@ffmpeg",
  "ffmpeg",
  "dist",
  "esm",
);

function copyFile(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

fs.mkdirSync(workerDestDir, { recursive: true });

for (const file of ["ffmpeg-core.js", "ffmpeg-core.wasm"]) {
  copyFile(path.join(esmCoreDir, file), path.join(destDir, file));
}

for (const entry of fs.readdirSync(ffmpegEsmDir)) {
  if (!entry.endsWith(".js")) {
    continue;
  }

  copyFile(path.join(ffmpegEsmDir, entry), path.join(workerDestDir, entry));
}

console.log("Copied ffmpeg ESM core and worker files to public/ffmpeg/");
