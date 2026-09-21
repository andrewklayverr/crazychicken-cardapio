import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { adminAllowlist, auditLog } from "../db/schema";
import { getChatGPTUser, type ChatGPTUser } from "../app/chatgpt-auth";

export class AdminAuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export async function requireAdmin(): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (!user) throw new AdminAuthError("Faça login para acessar o painel.", 401);

  const configuredEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (configuredEmails.includes(user.email.toLowerCase())) return user;

  try {
    const db = getDb();
    const [allowed] = await db
      .select({ id: adminAllowlist.id })
      .from(adminAllowlist)
      .where(eq(adminAllowlist.email, user.email.toLowerCase()))
      .limit(1);
    if (allowed) return user;
  } catch {
    // The allowlist can be configured through the runtime secret before D1 exists.
  }

  throw new AdminAuthError("Seu e-mail não está autorizado para o painel.", 403);
}

export function adminErrorResponse(error: unknown) {
  if (error instanceof AdminAuthError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Erro inesperado.";
  return Response.json({ error: message }, { status: 500 });
}

export async function recordAudit(input: {
  user: ChatGPTUser;
  action: string;
  entity: string;
  entityId?: string | number;
  metadata?: Record<string, unknown>;
}) {
  try {
    const db = getDb();
    await db.insert(auditLog).values({
      actorUserId: input.user.userId,
      actorEmail: input.user.email,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId == null ? null : String(input.entityId),
      metadataJson: JSON.stringify(input.metadata ?? {}),
    });
  } catch {
    // Auditing must never make a valid product/order change fail.
  }
}
