import { redirect } from "next/navigation";
import { requireAdmin } from "../../../lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminTeamPage() {
  try {
    await requireAdmin(["owner"]);
  } catch (error) {
    if (error && typeof error === "object" && "status" in error && (error as { status?: number }).status === 401) redirect("/admin/login?returnTo=%2Fadmin%3Fsection%3Dequipe");
    redirect("/admin");
  }
  redirect("/admin?section=equipe");
}
