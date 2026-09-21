import { desc } from "drizzle-orm";
import { getDb } from "../../../../db";
import { auditLog } from "../../../../db/schema";
import { adminErrorResponse, requireAdmin } from "../../../../lib/admin";

export async function GET() {
  try { await requireAdmin(["owner"]); return Response.json({ entries: await getDb().select().from(auditLog).orderBy(desc(auditLog.createdAt), desc(auditLog.id)).limit(100) }); } catch (error) { return adminErrorResponse(error); }
}
