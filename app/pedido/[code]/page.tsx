import { OrderTracking } from "../../../components/order-tracking";

export default async function OrderPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ phone?: string }> }) {
  const { code } = await params;
  const query = await searchParams;
  return <OrderTracking code={code} initialPhone={query.phone ?? ""} />;
}
