import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { adminAllowlist, auditLog } from "../db/schema";
import { getCurrentUser, configuredAdminEmails, type ChatGPTUser } from "./auth";

export class AdminAuthError extends Error {
  status: number;
  constructor(message: string, status = 401) { super(message); this.status = status; }
}

export async function requireAdmin(): Promise<ChatGPTUser> {
  const user = await getCurrentUser();
  if (!user) throw new AdminAuthError("Faça login para acessar o painel.", 401);
  if (configuredAdminEmails().includes(user.email.toLowerCase())) return user;
  try {
    const [allowed] = await getDb().select({ id: adminAllowlist.id }).from(adminAllowlist).where(eq(adminAllowlist.email, user.email.toLowerCase())).limit(1);
    if (allowed) return user;
  } catch {
    // A variável ADMIN_EMAILS é suficiente para o primeiro acesso e para ambientes sem banco.
  }
  throw new AdminAuthError("Seu e-mail não está autorizado para o painel.", 403);
}

export function adminErrorResponse(error: unknown) {
  if (error instanceof AdminAuthError) return Response.json({ error: error.message }, { status: error.status });
  return Response.json({ error: error instanceof Error ? error.message : "Erro inesperado." }, { status: 500 });
}

export async function recordAudit(input: { user: ChatGPTUser; action: string; entity: string; entityId?: string | number; metadata?: Record<string, unknown> }) {
  try {
    await getDb().insert(auditLog).values({ actorUserId: input.user.userId, actorEmail: input.user.email, action: input.action, entity: input.entity, entityId: input.entityId == null ? null : String(input.entityId), metadataJson: JSON.stringify(input.metadata ?? {}) });
  } catch {
    // Auditoria não deve desfazer uma alteração válida.
  }
}
