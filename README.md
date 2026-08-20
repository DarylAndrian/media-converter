# Media Converter

A suite of browser-based tools for images and video: convert images and videos between formats, compress images to a target size, extract audio from video, remove photo backgrounds with AI, and annotate photos. Everything runs locally — files never leave your device.

## Features

- **Image converter** — drag-and-drop or browse, single-file download or batch conversion as ZIP. Inputs: JPG, PNG, WEBP, TIFF, BMP, GIF, HEIC, HEIF. Outputs: JPG, PNG, WEBP, TIFF, GIF
- **Compressor** — iterative quality + resize loop to hit a target size (500 KB – 5 MB presets)
- **Video converter** — MP4, MOV, AVI, MKV, WEBM via ffmpeg WASM in the browser
- **Video → audio** — extract MP3, WAV, M4A, OGG, FLAC, or OPUS
- **Background remover** — client-side AI segmentation with edge smoothing (fast / high quality)
- **Image editor** — pixelate, blur, shapes, text, and brush annotation with undo/redo

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy to Netlify

1. Push this repository to GitHub.
2. In Netlify, choose **Add new site** -> **Import an existing project**.
3. Connect the GitHub repository.
4. Confirm these settings:
   - Build command: `npm run build`
   - Publish directory: `.next`
   - Plugin: `@netlify/plugin-nextjs`
5. Add environment variable:
   - `SHARP_IGNORE_GLOBAL_LIBVIPS=1`
6. Deploy the site.

Netlify will run the included `postinstall` script during deployment to ensure `sharp` is built for the Linux runtime.

## Tech stack

- Next.js App Router
- sharp
- heic-convert
- jszip
- react-dropzone
- Tailwind CSS
