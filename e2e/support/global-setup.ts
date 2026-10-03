import { spawn, spawnSync } from "node:child_process";

const hostname = "127.0.0.1";
const port = 3100;
const baseURL = `http://${hostname}:${port}`;

async function waitUntilReady(childExited: () => boolean): Promise<void> {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (childExited()) throw new Error("O servidor E2E encerrou antes de ficar disponível.");
    try {
      await fetch(baseURL, { redirect: "manual" });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`O servidor E2E não respondeu em ${baseURL}.`);
}

export default async function globalSetup() {
  if (process.env.PLAYWRIGHT_BASE_URL?.trim()) return;

  const child = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "dev", "--hostname", hostname, "--port", String(port)],
    {
      cwd: process.cwd(),
      detached: true,
      stdio: "ignore",
      env: {
        ...process.env,
        E2E_MODE: "true",
        ADMIN_EMAILS: "e2e-owner@example.test",
        APP_URL: baseURL,
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
  );

  let exited = false;
  child.once("exit", () => {
    exited = true;
  });
  child.unref();
  await waitUntilReady(() => exited);

  return async () => {
    if (!child.pid || exited) return;
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      return;
    }
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      // O processo já encerrou.
    }
  };
}
