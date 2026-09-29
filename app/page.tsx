import { StorefrontExperience } from "../components/storefront-experience";
import { assetUrl, getStorefront } from "../lib/store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const initialData = await getStorefront();
  const desktopHeroUrl = assetUrl(initialData.settings.appearance.heroImageKey || "/menu-cover.jpeg");
  const mobileHeroUrl = assetUrl(initialData.settings.appearance.heroMobileImageKey || initialData.settings.appearance.heroImageKey || "/menu-cover.jpeg");
  return <><link rel="preload" as="image" href={desktopHeroUrl} media="(min-width: 761px)" /><link rel="preload" as="image" href={mobileHeroUrl} media="(max-width: 760px)" /><StorefrontExperience initialData={initialData} /></>;
}
