// Netlify synchronous functions buffer request/response payloads up to 6 MB,
// and binary uploads are Base64-encoded (~+30% overhead), so the practical
// ceiling for an uploaded file is about 4.5 MB. We cap a touch lower so the
// app returns its own clear 413 instead of a cryptic platform rejection.
//
// Common formats are processed in the browser (see lib/client-*.ts) and never
// hit this limit; the server routes below only handle the fallback cases the
// browser cannot (HEIC/TIFF input, GIF/TIFF output).
export const SERVER_MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export function serverUploadLimitMB(): number {
  return Math.floor(SERVER_MAX_UPLOAD_BYTES / (1024 * 1024));
}
