import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPanel, type AdminSection, type Product } from "../../components/admin-panel";
import { requireAdmin } from "../../lib/admin";
import { fallbackProducts } from "../../lib/catalog";

export const dynamic = "force-dynamic";

const validSections = new Set<AdminSection>(["visao", "pedidos", "produtos", "aparencia", "configuracoes", "equipe", "atividades", "seguranca"]);

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  let currentUser;
  try {
    currentUser = await requireAdmin();
  } catch (error) {
    if (error && typeof error === "object" && "status" in error && (error as { status?: number }).status === 401) redirect("/admin/login?returnTo=%2Fadmin");
    return <main className="admin-login-page"><section className="admin-login-card"><h1>Acesso restrito</h1><p>Seu acesso ao painel não está ativo. Entre com uma conta administrativa válida.</p><Link href="/">Voltar para a loja</Link></section></main>;
  }

  const query = await searchParams;
  const requestedSection = query.section as AdminSection | undefined;
  const roleSections: Record<typeof currentUser.role, AdminSection[]> = { owner: ["visao", "pedidos", "produtos", "aparencia", "configuracoes", "equipe", "atividades", "seguranca"], manager: ["visao", "pedidos", "produtos", "aparencia", "configuracoes", "seguranca"], attendant: ["visao", "pedidos", "seguranca"] };
  const initialSection = requestedSection && validSections.has(requestedSection) && roleSections[currentUser.role].includes(requestedSection) ? requestedSection : "visao";
  const products: Product[] = fallbackProducts.map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.priceCents / 100,
    category: product.category,
    image: product.imageKey ? `/${product.imageKey}` : "/hero-food.jpeg",
    imageKey: product.imageKey,
    badge: product.badge ?? undefined,
    featured: product.featured,
    available: product.available,
    options: product.options,
  }));

  return <AdminPanel products={products} currentUser={currentUser} initialSection={initialSection} />;
}
