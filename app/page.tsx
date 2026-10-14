import { StorefrontExperience } from "../components/storefront-experience";
import { mediaSrcSet, mediaVariantUrl } from "../lib/media-images";
import { assetUrl, getStorefront } from "../lib/store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const initialData = await getStorefront();
  const desktopHeroUrl = assetUrl(initialData.settings.appearance.heroImageKey || "/menu-cover.jpeg");
  const mobileHeroUrl = assetUrl(initialData.settings.appearance.heroMobileImageKey || initialData.settings.appearance.heroImageKey || "/menu-cover.jpeg");
  return <><link rel="preload" as="image" href={mediaVariantUrl(desktopHeroUrl, 1280)} imageSrcSet={mediaSrcSet(desktopHeroUrl, [768, 960, 1280, 1600, 1920])} imageSizes="(max-width: 1300px) calc(100vw - 30px), 1240px" media="(min-width: 761px)" /><link rel="preload" as="image" href={mediaVariantUrl(mobileHeroUrl, 640)} imageSrcSet={mediaSrcSet(mobileHeroUrl, [320, 480, 640, 768, 960])} imageSizes="calc(100vw - 30px)" media="(max-width: 760px)" /><StorefrontExperience initialData={initialData} /></>;
}
