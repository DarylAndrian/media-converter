import { removeBackgroundServer } from "@/lib/remove-bg";
import {
    SERVER_MAX_UPLOAD_BYTES,
    serverUploadLimitMB,
} from "@/lib/server-upload-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

// The page processes images in the browser; this server route is a fallback and
// is capped at the Netlify request-body ceiling (see lib/server-upload-limit.ts).

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get("image");
        const quality = formData.get("quality") === "fast" ? "fast" : "high";

        if (!file || !(file instanceof File) || file.size === 0) {
            return Response.json(
                { error: "No image uploaded." },
                { status: 400 },
            );
        }

        if (file.size > SERVER_MAX_UPLOAD_BYTES) {
            return Response.json(
                {
                    error: `Image is too large for server-side processing. Please use an image under ${serverUploadLimitMB()} MB, or use the in-browser mode.`,
                },
                { status: 413 },
            );
        }

        const inputBuffer = Buffer.from(await file.arrayBuffer());
        const resultBuffer = await removeBackgroundServer(inputBuffer, {
            quality,
        });

        // Derive output filename
        const nameWithoutExt =
            file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
        const outputFilename = `${nameWithoutExt}-nobg.png`;

        return new Response(new Uint8Array(resultBuffer), {
            headers: {
                "Content-Type": "image/png",
                "Content-Disposition": `attachment; filename="${outputFilename}"`,
            },
        });
    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : "Background removal failed.";
        console.error("Background removal error:", message);

        return Response.json({ error: message }, { status: 500 });
    }
}