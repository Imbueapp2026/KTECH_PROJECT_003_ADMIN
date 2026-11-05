import "server-only";
import sharp from "sharp";

export const PRODUCT_IMAGE_CACHE_CONTROL = "public, max-age=31536000, immutable";

export interface CompressedImage {
  buffer: Buffer;
  contentType: string;
  extension: string;
}

/** Resize and strongly compress an upload before it reaches Supabase Storage. */
export async function compressImageUpload(input: ArrayBuffer | Buffer, fileName: string): Promise<CompressedImage> {
  const source = Buffer.isBuffer(input) ? input : Buffer.from(input);
  const outputName = fileName.replace(/\.[^.]+$/, "") || "image";

  try {
    const buffer = await sharp(source, { animated: true })
      .rotate()
      .resize({
        width: 1600,
        height: 1600,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 78, effort: 5 })
      .toBuffer();

    return {
      buffer,
      contentType: "image/webp",
      extension: "webp",
    };
  } catch (error) {
    throw new Error(`Image compression failed for ${outputName}: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
