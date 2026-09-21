import { readFile } from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Defina DATABASE_URL antes de executar a migração.");
const connection = await mysql.createConnection({ uri: url, ssl: process.env.DB_SSL === "true" ? {} : undefined });
const sql = await readFile(path.join(process.cwd(), "db", "migrations", "001_hostinger.sql"), "utf8");
for (const statement of sql.split(/;\s*(?:\r?\n|$)/).map((item) => item.trim()).filter(Boolean)) await connection.query(statement);
await connection.end();
console.log("Migração MariaDB concluída.");
