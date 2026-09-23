import { StorefrontExperience } from "../components/storefront-experience";
import { getStorefront } from "../lib/store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const initialData = await getStorefront();
  return <StorefrontExperience initialData={initialData} />;
}
