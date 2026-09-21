import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Defina DATABASE_URL antes de executar a migração.");
const connection = await mysql.createConnection({ uri: url, ssl: process.env.DB_SSL === "true" ? {} : undefined });
const migrationDir = path.join(process.cwd(), "db", "migrations");
const migrations = (await readdir(migrationDir)).filter((file) => /^\d+_.*\.sql$/i.test(file)).sort();
for (const migration of migrations) {
  const sql = await readFile(path.join(migrationDir, migration), "utf8");
  for (const statement of sql.split(/;\s*(?:\r?\n|$)/).map((item) => item.trim()).filter(Boolean)) await connection.query(statement);
  console.log(`Migração aplicada: ${migration}`);
}
await connection.end();
console.log("Migração MariaDB concluída.");
