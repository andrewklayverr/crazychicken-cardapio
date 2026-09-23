import { StorefrontExperience } from "../components/storefront-experience";
import { getStorefront } from "../lib/store";

export const revalidate = 30;

export default async function Home() {
  const initialData = await getStorefront();
  return <StorefrontExperience initialData={initialData} />;
}
