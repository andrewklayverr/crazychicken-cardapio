import { createHash, randomBytes } from "node:crypto";
import mysql from "mysql2/promise";

const emailArgument = process.argv.find((value) => value.startsWith("--email="))?.slice("--email=".length) ?? process.argv[process.argv.indexOf("--email") + 1];
const email = String(emailArgument ?? "").trim().toLowerCase();
if (!email.includes("@")) throw new Error("Uso: npm run admin:bootstrap -- --email dono@empresa.com.br");
if (!process.env.DATABASE_URL) throw new Error("Defina DATABASE_URL antes do bootstrap.");
if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM || !process.env.APP_URL) throw new Error("Configure RESEND_API_KEY, EMAIL_FROM e APP_URL antes do bootstrap.");

const db = await mysql.createConnection({ uri: process.env.DATABASE_URL, ssl: process.env.DB_SSL === "true" ? {} : undefined });
const [countRows] = await db.query("SELECT COUNT(*) AS count FROM admin_users WHERE status <> 'suspended'");
if (Number(countRows[0].count) > 0) throw new Error("Já existe uma conta administrativa. Use convites dentro do painel.");
const token = randomBytes(32).toString("base64url");
const hash = createHash("sha256").update(token).digest("hex");
const [result] = await db.execute("INSERT INTO admin_users (email, name, role, status) VALUES (?, ?, 'owner', 'invited')", [email, "Proprietário"]);
const userId = result.insertId;
await db.execute("INSERT INTO admin_tokens (user_id, type, token_hash, expires_at) VALUES (?, 'invite', ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))", [userId, hash]);
const appUrl = process.env.APP_URL.replace(/\/$/, "");
const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [email], subject: "Ative seu painel Crazy Chicken", html: `<p>Você recebeu o acesso de proprietário ao painel Crazy Chicken.</p><p><a href="${appUrl}/admin/accept-invite?token=${encodeURIComponent(token)}">Criar minha conta</a></p><p>O link expira em 24 horas e só pode ser usado uma vez.</p>` }) });
if (!response.ok) { await db.execute("DELETE FROM admin_tokens WHERE token_hash = ?", [hash]); await db.execute("DELETE FROM admin_users WHERE id = ?", [userId]); throw new Error("O Resend não aceitou o convite inicial."); }
await db.end();
console.log(`Convite de proprietário enviado para ${email}.`);
