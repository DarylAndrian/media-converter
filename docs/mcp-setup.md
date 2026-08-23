# MCP Server Setup — media-converter

This repo ships a local **MCP (Model Context Protocol) server** so AI agents/clients can
convert, compress, and inspect media files by calling tools directly.

## Overview

- **Entry point:** [`mcp/server.ts`](../mcp/server.ts) (stdio) and [`mcp/server-http.ts`](../mcp/server-http.ts) (HTTP, for remote agents)
- **Transport:** stdio for local clients; Streamable HTTP for remote clients (e.g. an agent on a VPS)
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
npm run mcp        # stdio (local clients launch this themselves)
npm run mcp:http   # HTTP endpoint at http://0.0.0.0:3100/mcp (remote agents)
```

The stdio server speaks JSON-RPC over stdio — it is meant to be launched by an MCP client,
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

## Connecting a remote agent (HTTP transport)

Agents that don't run on your machine (e.g. a Hermes agent on a VPS) cannot launch the
stdio server — they need a URL. Use the HTTP entry point instead:

1. **Start the server** (keep it running; a service manager like pm2/systemd is
   recommended for long-term use):

   ```powershell
   $env:MCP_HTTP_TOKEN='<long-random-secret>'; npm run mcp:http
   ```

   - Endpoint: `http://<host>:3100/mcp` (transport: **Streamable HTTP**)
   - Auth: `Authorization: Bearer <MCP_HTTP_TOKEN>` header — this token is the
     equivalent of a PAT, so treat it like a secret. If you don't set one, a random
     token is generated and printed at startup (valid until restart).
   - Port is configurable via the `PORT` env var.

2. **Make it reachable from the agent.** Options:
   - Server on the same network/VPS: open firewall port 3100 and point the agent at
     `http://<your-ip>:3100/mcp`.
   - Agent on the internet, server on your PC: expose the port via a tunnel such as
     `cloudflared tunnel --url http://localhost:3100` or ngrok, and give the agent the
     tunnel URL.
   - Alternatively deploy the MCP server itself onto the VPS (it's plain Node —
     clone the repo, `npm install`, run `npm run mcp:http`) and point the agent at
     `http://localhost:3100/mcp` there. Note: video/audio tools then need ffmpeg on
     the VPS too.

3. **Configure the agent's MCP client** with:
   - URL: `http://<host>:3100/mcp`
   - Transport type: Streamable HTTP (sometimes labelled "HTTP/SSE" in client UIs)
   - Header: `Authorization: Bearer <your-token>`

4. **Verify:**

   ```powershell
   $env:MCP_HTTP_TOKEN='<token>'; node ./node_modules/tsx/dist/cli.mjs mcp/smoke-test-http.ts
   ```

   or: `npx @modelcontextprotocol/inspector` → transport "Streamable HTTP",
   URL `http://localhost:3100/mcp`, add the Authorization header.

## MCP hosted on the website itself (`/api/mcp`)

The Next.js app also embeds an MCP endpoint as a route handler
([`app/api/mcp/route.ts`](../app/api/mcp/route.ts)), so the deployed site is itself a
remote MCP server — no separate process or tunnel needed:

- **URL:** `https://<your-site>.netlify.app/api/mcp` (transport: Streamable HTTP)
- **Auth:** `Authorization: Bearer <MCP_TOKEN>` — set `MCP_TOKEN` as an env var in
  Netlify (Site settings → Environment variables). The route returns 503 until it's
  set, and 401 for a wrong token. Static tokens are enough for personal use; the
  `authorize()` helper is isolated so JWT verification can be swapped in later.
- **Serverless constraints** shape what's exposed:
  - **Stateless** — fresh transport per request (no in-memory sessions on Netlify)
  - **Base64 in/out** — no filesystem, so tools take/return base64 image data
    instead of file paths
  - **Image tools only** — `convert_image`, `compress_image`, `list_formats`.
    Video/audio tools need system ffmpeg (unavailable on Netlify) and background
    removal would re-download its ONNX model on every cold start. For the full
    8-tool set, use the standalone servers above.

Agent config: URL `https://<site>/api/mcp`, transport Streamable HTTP, header
`Authorization: Bearer <token>`. Verify locally with:

```powershell
$env:MCP_TOKEN='<token>'; npm run dev                                  # terminal 1
$env:MCP_TOKEN='<token>'; node ./node_modules/tsx/dist/cli.mjs web-mcp-test.mts  # terminal 2
```

### Which server should I use?

| Scenario | Use |
|---|---|
| Local IDE/CLI agents | stdio (`npm run mcp`) |
| Remote agent, full toolset (video/audio), files on disk | standalone HTTP (`npm run mcp:http`) or deploy `mcp/` to the agent's VPS |
| Remote agent, image tools only, zero infrastructure | website endpoint (`/api/mcp`) |

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
app/api/mcp/route.ts    # website-hosted MCP endpoint (stateless, base64, image tools)
mcp/
├── server.ts           # stdio entry point, registers all tools
├── server-http.ts      # HTTP entry point (Streamable HTTP + bearer token auth)
├── smoke-test-http.ts  # HTTP connection smoke test
├── util.ts             # file helpers + ffmpeg/ffprobe runners
└── tools/
    ├── image.ts        # convert_image, compress_image, remove_background
    ├── video.ts        # convert_video, video_to_audio
    ├── audio.ts        # convert_audio
    └── info.ts         # list_formats, get_media_info
```

## Notes

- stdout is reserved for JSON-RPC; all logging goes to stderr.
- Browser-only paths (`lib/client-*.ts`, ffmpeg.wasm) are intentionally not exposed —
  video/audio tools shell out to system ffmpeg instead.
- The Next.js app itself is unchanged; the MCP server is an additive entry point.
