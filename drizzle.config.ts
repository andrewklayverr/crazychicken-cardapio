import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./db/schema.ts",
  dialect: "mysql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "mysql://user:password@localhost:3306/crazy_chicken" },
});
