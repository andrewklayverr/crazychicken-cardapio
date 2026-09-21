import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "../../../lib/admin";
import { AdminTeamPanel } from "../../../components/admin-team-panel";

export const dynamic = "force-dynamic";

export default async function AdminTeamPage() {
  try {
    const user = await requireAdmin(["owner"]);
    return <AdminTeamPanel currentUser={{ id: user.id, name: user.displayName, email: user.email }} />;
  } catch (error) {
    if (error && typeof error === "object" && "status" in error && (error as { status?: number }).status === 401) redirect("/admin/login?returnTo=%2Fadmin%2Fequipe");
    return <main className="admin-login-page"><section className="admin-login-card"><h1>Acesso restrito</h1><p>Somente o proprietário pode gerenciar a equipe.</p><Link href="/admin">Voltar ao painel</Link></section></main>;
  }
}
