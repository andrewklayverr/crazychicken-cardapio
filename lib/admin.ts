import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { adminAllowlist, auditLog } from "../db/schema";
import { configuredAdminEmails, getCurrentUser, type AdminRole, type AdminUser } from "./auth";

export class AdminAuthError extends Error {
  status: number;
  constructor(message: string, status = 401) { super(message); this.status = status; }
}

const roleRank: Record<AdminRole, number> = { attendant: 1, manager: 2, owner: 3 };

export async function requireAdmin(roles?: AdminRole[]): Promise<AdminUser> {
  const user = await getCurrentUser();
  if (!user) throw new AdminAuthError("Faça login para acessar o painel.", 401);
  if (user.status !== "active") throw new AdminAuthError("Esta conta está suspensa.", 403);
  if (roles?.length && !roles.includes(user.role) && !(user.role === "owner" && Math.max(...roles.map((role) => roleRank[role])) <= roleRank.owner)) throw new AdminAuthError("Você não tem permissão para esta ação.", 403);
  if (user.id === 0) {
    if (configuredAdminEmails().includes(user.email.toLowerCase())) return user;
    try {
      const [allowed] = await getDb().select({ id: adminAllowlist.id }).from(adminAllowlist).where(eq(adminAllowlist.email, user.email.toLowerCase())).limit(1);
      if (allowed) return user;
    } catch { /* instalação legada sem as novas tabelas */ }
    throw new AdminAuthError("Seu e-mail não está autorizado para o painel.", 403);
  }
  return user;
}

export async function requireRole(role: AdminRole) {
  return requireAdmin([role]);
}

export function adminErrorResponse(error: unknown) {
  if (error instanceof AdminAuthError) return Response.json({ error: error.message }, { status: error.status });
  return Response.json({ error: error instanceof Error ? error.message : "Erro inesperado." }, { status: 500 });
}

export function roleCanManageCatalog(role: AdminRole) { return role === "owner" || role === "manager"; }
export function roleCanManageOrders(role: AdminRole) { return role === "owner" || role === "manager" || role === "attendant"; }

export async function recordAudit(input: { user: AdminUser; action: string; entity: string; entityId?: string | number; metadata?: Record<string, unknown> }) {
  try {
    await getDb().insert(auditLog).values({ actorUserId: input.user.userId, actorEmail: input.user.email, action: input.action, entity: input.entity, entityId: input.entityId == null ? null : String(input.entityId), metadataJson: JSON.stringify(input.metadata ?? {}) });
  } catch { /* auditoria não deve desfazer uma alteração válida */ }
}
