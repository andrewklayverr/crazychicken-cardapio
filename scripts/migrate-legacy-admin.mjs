import mysql from "mysql2/promise";

const email = (process.env.ADMIN_EMAILS ?? "").split(",").map((value) => value.trim().toLowerCase()).find(Boolean);
const passwordHash = process.env.ADMIN_PASSWORD_HASH;
if (!process.env.DATABASE_URL || !email || !passwordHash) throw new Error("Defina DATABASE_URL, ADMIN_EMAILS e ADMIN_PASSWORD_HASH para migrar o acesso atual.");
const db = await mysql.createConnection({ uri: process.env.DATABASE_URL, ssl: process.env.DB_SSL === "true" ? {} : undefined });
const [rows] = await db.query("SELECT id FROM admin_users WHERE email = ? LIMIT 1", [email]);
if (!rows.length) {
  const [result] = await db.execute("INSERT INTO admin_users (email, name, role, status, password_hash) VALUES (?, ?, 'owner', 'active', ?)", [email, email.split("@")[0], passwordHash]);
  console.log(`Acesso legado migrado para o proprietário #${result.insertId}. Configure o MFA após entrar.`);
} else console.log("Este e-mail já possui conta administrativa; nenhuma alteração foi feita.");
await db.end();
