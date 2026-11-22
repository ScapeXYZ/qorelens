import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

for (const dir of ["src", "scripts", "test"]) {
  for (const path of await readdir(dir, { recursive: true })) {
    if (!path.endsWith(".mjs")) continue;
    const file = dir + "/" + path;
    const result = spawnSync(process.execPath, ["--check", file], {
      stdio: "inherit",
    });
    if (result.status !== 0) process.exit(1);
    if (
      file.startsWith("src/") &&
      !file.startsWith("src/verify/") &&
      /verdict:\s*['"]VERIFIED/.test(await readFile(file, "utf8"))
    ) {
      console.error("Only the independent verifier can emit VERIFIED: " + file);
      process.exit(1);
    }
  }
}
