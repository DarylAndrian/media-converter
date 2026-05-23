const fs = require("fs");
const path = require("path");

const coreDir = path.join(__dirname, "..", "node_modules", "@ffmpeg", "core", "dist", "umd");
const destDir = path.join(__dirname, "..", "public", "ffmpeg");

const files = ["ffmpeg-core.js", "ffmpeg-core.wasm"];

fs.mkdirSync(destDir, { recursive: true });

for (const file of files) {
  fs.copyFileSync(path.join(coreDir, file), path.join(destDir, file));
}

console.log(`Copied ${files.length} ffmpeg core files to public/ffmpeg/`);
