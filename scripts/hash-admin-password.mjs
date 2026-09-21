import { randomBytes, scryptSync } from "node:crypto";

const password = process.argv[2] ?? process.env.ADMIN_PASSWORD_INPUT;
if (!password) throw new Error("Uso: npm run auth:hash -- \"sua-senha\"");
const salt = randomBytes(16).toString("hex");
const hash = scryptSync(password, salt, 64).toString("hex");
console.log(`scrypt$${salt}$${hash}`);
