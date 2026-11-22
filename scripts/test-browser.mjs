import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { startServer } from "./serve.mjs";

const args = process.argv.slice(2);
const cli = createRequire(import.meta.url).resolve("@playwright/test/cli");
const server =
  args.includes("--list") || args.includes("--help")
    ? null
    : await startServer(0);
try {
  const url = server && "http://127.0.0.1:" + server.address().port;
  if (url) console.log("QoreLens test server ready on " + url);
  // The pinned Playwright loader can hang on Node 24 before config loads.
  // Our config and tests use native ESM and need no TypeScript ESM hook.
  const child = spawn(process.execPath, [cli, "test", ...args], {
    env: {
      ...process.env,
      PW_DISABLE_TS_ESM: "1",
      ...(url ? { QORELENS_BROWSER_TEST_URL: url } : {}),
    },
    stdio: "inherit",
  });
  const timeout = setTimeout(() => {
    console.error("Playwright exceeded the 90-second process limit.");
    if (process.platform === "win32" && child.pid) {
      spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        timeout: 5000,
      });
    }
    child.kill();
    process.exitCode = 124;
  }, 90_000);
  timeout.unref();
  try {
    const code = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", resolve);
    });
    process.exitCode ??= code ?? 1;
  } finally {
    clearTimeout(timeout);
  }
} finally {
  if (server) {
    const closed = new Promise((resolve) => server.close(resolve));
    server.closeAllConnections();
    await closed;
  }
}
