import sharp from "sharp";
import { removeBackground } from "@imgly/background-removal";

/**
 * Server-side background removal with edge refinement.
 *
 * Pipeline:
 * 1. @imgly/background-removal (ONNX) → raw alpha mask
 * 2. Alpha channel extraction + Gaussian blur on edges → refined alpha
 * 3. Alpha compositing → final transparent PNG
 */

type QualityMode = "fast" | "high";

interface RemoveBackgroundOptions {
    quality?: QualityMode;
}

/**
 * Apply Gaussian blur to the alpha channel edges to soften jagged cuts.
 * This simulates the "trimap + matting" concept — smoothes the boundary
 * between foreground and background.
 */
async function refineAlphaEdges(
    imageBuffer: Buffer<ArrayBuffer>,
    blurRadius: number,
): Promise<Buffer<ArrayBuffer>> {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();

    if (metadata.channels !== 4) {
        // No alpha channel, return as-is
        return imageBuffer;
    }

    // Extract the alpha channel
    const alphaChannel = await image
        .ensureAlpha()
        .extractChannel(3)
        .toBuffer();

    // Create a blurred version of the alpha channel
    const blurredAlpha = await sharp(alphaChannel, {
        raw: {
            width: metadata.width!,
            height: metadata.height!,
            channels: 1,
        },
    })
        .blur(blurRadius)
        .toBuffer();

    // Create a mask: keep original alpha where it's clearly FG (255) or BG (0),
    // but use the blurred version in the edge zone (1-254).
    // This preserves sharp interior details while softening only the edges.
    const originalAlpha = new Uint8Array(alphaChannel);
    const blurred = new Uint8Array(blurredAlpha);
    const refined = new Uint8Array(originalAlpha.length);

    for (let i = 0; i < originalAlpha.length; i++) {
        const a = originalAlpha[i];
        if (a === 0) {
            // Definitely background
            refined[i] = 0;
        } else if (a === 255) {
            // Definitely foreground
            refined[i] = 255;
        } else {
            // Edge zone — blend between original and blurred for smoother transition
            refined[i] = Math.round(a * 0.3 + blurred[i] * 0.7);
        }
    }

    // Composite the refined alpha back onto the image
    const refinedAlphaBuffer = Buffer.from(refined);

    // Get the RGB channels
    const rgbBuffer = await sharp(imageBuffer)
        .ensureAlpha()
        .removeAlpha()
        .raw()
        .toBuffer();

    // Combine RGB + refined alpha
    const result = (await sharp(rgbBuffer, {
        raw: {
            width: metadata.width!,
            height: metadata.height!,
            channels: 3,
        },
    })
        .joinChannel(refinedAlphaBuffer, {
            raw: {
                width: metadata.width!,
                height: metadata.height!,
                channels: 1,
            },
        })
        .png()
        .toBuffer()) as Buffer<ArrayBuffer>;

    return result;
}

/**
 * Remove background from an image buffer (server-side).
 *
 * Uses @imgly/background-removal for segmentation, then applies
 * sharp-based edge refinement for smoother alpha edges.
 */
export async function removeBackgroundServer(
    inputBuffer: Buffer,
    options: RemoveBackgroundOptions = {},
): Promise<Buffer> {
    const { quality = "high" } = options;

    // Convert Buffer → Blob for @imgly/background-removal
    const inputBlob = new Blob([new Uint8Array(inputBuffer)], { type: "image/png" });

    // Run background removal
    const config: Record<string, unknown> = {};

    if (quality === "fast") {
        // Use quantized model for speed
        config.model = "isnet_quint8";
    } else {
        // Use full precision model for quality
        config.model = "isnet";
    }

    const resultBlob = await removeBackground(inputBlob, config);

    // Convert result Blob → Buffer
    const resultArrayBuffer = await resultBlob.arrayBuffer();
    let resultBuffer = Buffer.from(resultArrayBuffer);

    // Apply edge refinement for high quality mode
    if (quality === "high") {
        resultBuffer = await refineAlphaEdges(resultBuffer, 1.5);
    }

    return resultBuffer;
}