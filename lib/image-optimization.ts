import sharp from "sharp";

type ImagePreset = "display" | "product";

const imagePresets: Record<ImagePreset, { width: number; height: number; quality: number }> = {
  display: { width: 1920, height: 1600, quality: 80 },
  product: { width: 1200, height: 1200, quality: 78 },
};

export async function optimizeUploadedImage(bytes: Uint8Array, preset: ImagePreset = "display") {
  const settings = imagePresets[preset];
  const optimized = await sharp(Buffer.from(bytes), { failOn: "error", limitInputPixels: 20_000_000 })
    .rotate()
    .resize({
      width: settings.width,
      height: settings.height,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: settings.quality, effort: 4, smartSubsample: true })
    .toBuffer();

  return new Uint8Array(optimized);
}
