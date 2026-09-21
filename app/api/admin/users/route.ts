import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "../../../../db";
import { adminSessions, adminTokens, adminUsers } from "../../../../db/schema";
import { adminErrorResponse, recordAudit, requireAdmin } from "../../../../lib/admin";
import { hashToken, normalizeEmail, randomToken } from "../../../../lib/admin-security";
import { sendAdminInvite } from "../../../../lib/email";
import { validateAdminMutation } from "../../../../lib/auth";

const roles = ["manager", "attendant"] as const;

export async function GET() {
  try {
    await requireAdmin(["owner"]);
    const users = await getDb().select({ id: adminUsers.id, email: adminUsers.email, name: adminUsers.name, role: adminUsers.role, status: adminUsers.status, mfaEnabledAt: adminUsers.mfaEnabledAt, lastLoginAt: adminUsers.lastLoginAt, createdAt: adminUsers.createdAt }).from(adminUsers).orderBy(desc(adminUsers.createdAt));
    return Response.json({ users });
  } catch (error) { return adminErrorResponse(error); }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdmin(["owner"]); await validateAdminMutation(request);
    const body = await request.json() as Record<string, unknown>;
    const email = normalizeEmail(String(body.email ?? "")); const role = String(body.role ?? "attendant"); const name = String(body.name ?? "Administrador").trim().slice(0, 120);
    if (!email.includes("@") || !roles.includes(role as typeof roles[number])) return Response.json({ error: "E-mail ou função inválidos." }, { status: 400 });
    const db = getDb(); const [existing] = await db.select().from(adminUsers).where(eq(adminUsers.email, email)).limit(1);
    if (existing?.status === "active") return Response.json({ error: "Este e-mail já possui acesso." }, { status: 409 });
    if (existing) await db.delete(adminTokens).where(and(eq(adminTokens.userId, existing.id), eq(adminTokens.type, "invite")));
    const insertResult = existing ? null : await db.insert(adminUsers).values({ email, name, role, status: "invited", createdBy: actor.id || null });
    const userId = existing?.id ?? Number(insertResult?.[0]?.insertId);
    if (existing) await db.update(adminUsers).set({ name, role, status: "invited" }).where(eq(adminUsers.id, userId));
    const token = randomToken();
    await db.insert(adminTokens).values({ userId, type: "invite", tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 24 * 3600000).toISOString() });
    try { await sendAdminInvite({ email, role, token }); } catch (error) { await db.delete(adminTokens).where(eq(adminTokens.tokenHash, hashToken(token))); if (!existing) await db.delete(adminUsers).where(eq(adminUsers.id, userId)); throw error; }
    await recordAudit({ user: actor, action: existing ? "resend_invite" : "invite", entity: "admin_user", entityId: userId, metadata: { email, role } });
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) { return adminErrorResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireAdmin(["owner"]); await validateAdminMutation(request);
    const body = await request.json() as { id?: number; role?: string; status?: string; name?: string };
    const id = Number(body.id); if (!Number.isInteger(id)) return Response.json({ error: "Usuário inválido." }, { status: 400 });
    const [target] = await getDb().select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1);
    if (!target) return Response.json({ error: "Usuário não encontrado." }, { status: 404 });
    if (id === actor.id && body.status === "suspended") return Response.json({ error: "Você não pode suspender sua própria conta." }, { status: 400 });
    const nextRole = body.role ?? target.role; const nextStatus = body.status ?? target.status;
    if (!["owner", "manager", "attendant"].includes(nextRole) || !["active", "invited", "suspended"].includes(nextStatus)) return Response.json({ error: "Dados inválidos." }, { status: 400 });
    if (target.role === "owner" && (nextRole !== "owner" || nextStatus === "suspended")) {
      const owners = await getDb().select({ id: adminUsers.id }).from(adminUsers).where(and(eq(adminUsers.role, "owner"), eq(adminUsers.status, "active")));
      if (owners.length <= 1) return Response.json({ error: "A instalação precisa manter pelo menos um proprietário ativo." }, { status: 400 });
    }
    await getDb().update(adminUsers).set({ role: nextRole, status: nextStatus, ...(body.name !== undefined ? { name: String(body.name).trim().slice(0, 120) } : {}), updatedAt: new Date().toISOString() }).where(eq(adminUsers.id, id));
    if (nextStatus === "suspended") await getDb().update(adminSessions).set({ revokedAt: new Date().toISOString() }).where(and(eq(adminSessions.userId, id), isNull(adminSessions.revokedAt)));
    await recordAudit({ user: actor, action: "update", entity: "admin_user", entityId: id, metadata: { role: nextRole, status: nextStatus } });
    return Response.json({ ok: true });
  } catch (error) { return adminErrorResponse(error); }
}
