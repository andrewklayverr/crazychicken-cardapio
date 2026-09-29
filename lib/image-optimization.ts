import sharp from "sharp";

const MAX_IMAGE_WIDTH = 2000;
const MAX_IMAGE_HEIGHT = 1600;

export async function optimizeUploadedImage(bytes: Uint8Array) {
  const optimized = await sharp(Buffer.from(bytes), { failOn: "error", limitInputPixels: 20_000_000 })
    .rotate()
    .resize({
      width: MAX_IMAGE_WIDTH,
      height: MAX_IMAGE_HEIGHT,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82, effort: 4, smartSubsample: true })
    .toBuffer();

  return new Uint8Array(optimized);
}
