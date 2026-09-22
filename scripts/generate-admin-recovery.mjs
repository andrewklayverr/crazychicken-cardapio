import { randomBytes } from "node:crypto";

// Run locally; never commit the generated output or put it in a public URL.
console.log("ADMIN_RECOVERY_EMAIL=rodrigostuarth@hotmail.com");
console.log(`ADMIN_RECOVERY_CODE=${randomBytes(32).toString("base64url")}`);
console.log(`ADMIN_RECOVERY_EXPIRES_AT=${new Date(Date.now() + 23 * 3600000).toISOString()}`);
