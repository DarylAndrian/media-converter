# MCP Server Setup — media-converter

This repo ships a local **MCP (Model Context Protocol) server** so AI agents/clients can
convert, compress, and inspect media files by calling tools directly.

## Overview

- **Entry point:** [`mcp/server.ts`](../mcp/server.ts)
- **Transport:** stdio (local only — not deployed to Netlify)
- **SDK:** `@modelcontextprotocol/sdk` + `zod` v4 schemas
- **Runner:** `tsx` (no build step needed)

The server reuses the app's existing Node-side pipelines:

| Tool | Backed by |
|---|---|
| `convert_image` | `lib/converter.ts` (sharp, HEIC input via heic-convert) |
| `compress_image` | `lib/compress.ts` (adaptive quality/size search) |
| `remove_background` | `lib/remove-bg.ts` (@imgly/background-removal + edge refinement) |
| `convert_video` | system `ffmpeg` binary |
| `video_to_audio` | system `ffmpeg` binary |
| `convert_audio` | system `ffmpeg` binary |
| `get_media_info` | system `ffprobe` binary |
| `list_formats` | format registries in `lib/` |

> Video/audio tools require **ffmpeg on PATH** (`winget install ffmpeg` on Windows).
> Image tools need nothing extra. `remove_background` downloads its ONNX model on first run.

## Running

```bash
npm run mcp
```

The server speaks JSON-RPC over stdio — it is meant to be launched by an MCP client,
not used interactively.

## Registering with an MCP client

A project-level [`.mcp.json`](../.mcp.json) is included for clients that support it
(Claude Code, Qoder, etc.):

```json
{
  "mcpServers": {
    "media-converter": {
      "command": "npx",
      "args": ["tsx", "mcp/server.ts"]
    }
  }
}
```

Run the command from the repo root so `tsx` can resolve the TypeScript sources.
For clients using a global config (e.g. Claude Desktop `claude_desktop_config.json`),
copy the same server entry and use absolute paths in `args`.

## Tool reference

### `convert_image`
Convert an image between formats (jpg, png, webp, tiff, gif; heic/heif input).
Args: `inputPath`, `outputFormat`, `outputPath?`

### `compress_image`
Compress to a target size with adaptive quality/resolution/palette search.
Args: `inputPath`, `targetKB?` (default 1536), `formatPreference?` (`keep` | format), `outputPath?`

### `remove_background`
AI background removal → transparent PNG.
Args: `inputPath`, `quality?` (`fast` | `high`, default `high`), `outputPath?`

### `convert_video`
Re-encode or remux between mp4/mov/avi/mkv/webm.
Args: `inputPath`, `outputFormat`, `copyStreams?` (remux only), `crf?`, `outputPath?`

### `video_to_audio`
Extract the audio track from a video.
Args: `inputPath`, `outputFormat` (mp3/wav/m4a/ogg/flac/opus), `outputPath?`

### `convert_audio`
Convert audio between mp3/wav/m4a/ogg/flac/opus.
Args: `inputPath`, `outputFormat`, `bitrate?` (e.g. `"192k"`), `outputPath?`

### `get_media_info`
Format/duration/dimensions/streams via ffprobe.
Args: `inputPath`

### `list_formats`
Supported input/output formats per media type.
Args: `mediaType?` (`image` | `video` | `audio` | `all`)

All tools return the absolute output path on success, or an `isError` result with a
human-readable message on failure. When `outputPath` is omitted, the result is written
next to the input with the appropriate extension.

## Testing

Interactive testing with the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector npx tsx mcp/server.ts
```

Quick smoke test (lists tools over stdio):

```bash
node ./node_modules/tsx/dist/cli.mjs mcp/server.ts < mcp-stdin.jsonl
```

## Project layout

```
mcp/
├── server.ts        # entry point, registers all tools
├── util.ts          # file helpers + ffmpeg/ffprobe runners
└── tools/
    ├── image.ts     # convert_image, compress_image, remove_background
    ├── video.ts     # convert_video, video_to_audio
    ├── audio.ts     # convert_audio
    └── info.ts      # list_formats, get_media_info
```

## Notes

- stdout is reserved for JSON-RPC; all logging goes to stderr.
- Browser-only paths (`lib/client-*.ts`, ffmpeg.wasm) are intentionally not exposed —
  video/audio tools shell out to system ffmpeg instead.
- The Next.js app itself is unchanged; the MCP server is an additive entry point.
