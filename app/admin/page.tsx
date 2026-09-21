import { redirect } from "next/navigation";
import Link from "next/link";
import { AdminPanel, Product } from "../page";
import { requireAdmin } from "../../lib/admin";
import { fallbackProducts } from "../../lib/catalog";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  let currentUser;
  try {
    currentUser = await requireAdmin();
  } catch (error) {
    if (error && typeof error === "object" && "status" in error && (error as { status?: number }).status === 401) redirect("/admin/login?returnTo=%2Fadmin");
    return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 32, background: "#fff8e9", fontFamily: "Arial, sans-serif" }}><section style={{ maxWidth: 480, padding: 32, borderRadius: 20, background: "#fff", border: "1px solid #e6d8be", textAlign: "center" }}><h1>Acesso restrito</h1><p>Seu e-mail ainda não está autorizado no painel administrativo. Configure ADMIN_EMAILS ou a lista de administradores no banco.</p><Link href="/" style={{ color: "#af171a", fontWeight: 800 }}>Voltar para a loja</Link></section></main>;
  }
  const products: Product[] = fallbackProducts.map((product) => ({ id: product.id, name: product.name, description: product.description, price: product.priceCents / 100, category: product.category as Product["category"], image: product.imageKey ? `/${product.imageKey}` : "/hero-food.jpeg", imageKey: product.imageKey, badge: product.badge ?? undefined, featured: product.featured, available: product.available, options: product.options }));
  return <AdminPanel products={products} currentUser={currentUser} />;
}
