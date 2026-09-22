import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "./schema";

let pool: mysql.Pool | null = null;

export function getPool() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL não configurada. Crie a conexão MariaDB no painel da Hostinger.");
  if (!pool) {
    pool = mysql.createPool({
      uri: databaseUrl,
      connectionLimit: Math.max(1, Number(process.env.DB_CONNECTION_LIMIT ?? 5)),
      waitForConnections: true,
      enableKeepAlive: true,
      ssl: process.env.DB_SSL === "true" ? {} : undefined,
    });
  }
  return pool;
}

export function getDb() {
  return drizzle(getPool(), { schema, mode: "default" });
}

export async function closeDb() {
  if (pool) await pool.end();
  pool = null;
}
