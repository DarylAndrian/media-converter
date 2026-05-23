# Media Converter

A web app for converting images between common formats. Upload one file or many, pick an output format, and download the result instantly.

## Features

- Drag-and-drop or browse to upload images
- Single-file download or batch conversion as ZIP
- Input formats: JPG, JPEG, PNG, WEBP, TIFF, BMP, GIF, HEIC, HEIF
- Output formats: JPG, PNG, WEBP, TIFF, GIF

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
