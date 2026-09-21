import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Defina DATABASE_URL antes de gerar o backup.");
const tables = ["categories", "products", "product_options", "store_settings", "delivery_zones", "orders", "order_items", "admin_allowlist", "audit_log"];
const connection = await mysql.createConnection({ uri: url, ssl: process.env.DB_SSL === "true" ? {} : undefined });
const escape = (value) => value === null ? "NULL" : connection.escape(value);
let output = "SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\n";
for (const table of tables) {
  const [createRows] = await connection.query(`SHOW CREATE TABLE \`${table}\``);
  output += `DROP TABLE IF EXISTS \`${table}\`;\n${createRows[0]["Create Table"]};\n`;
  const [rows] = await connection.query(`SELECT * FROM \`${table}\``);
  for (const row of rows) {
    const columns = Object.keys(row).map((column) => `\`${column}\``).join(", ");
    const values = Object.values(row).map(escape).join(", ");
    output += `INSERT INTO \`${table}\` (${columns}) VALUES (${values});\n`;
  }
}
output += "SET FOREIGN_KEY_CHECKS=1;\n";
const directory = path.join(process.cwd(), "backups");
await mkdir(directory, { recursive: true });
const file = path.join(directory, `crazy-chicken-${new Date().toISOString().replace(/[:.]/g, "-")}.sql`);
await writeFile(file, output, "utf8");
await connection.end();
console.log(`Backup criado em ${file}`);
