import { createRequire } from "node:module";
import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { canonical, sha256 } from "../src/report/integrity.mjs";

const require = createRequire(import.meta.url);
const local = process.env.QORELENS_REPLAY_NODE_MODULES;
const esbuild = local
  ? createRequire(resolve(local, "../package.json"))("esbuild")
  : require("esbuild");
await mkdir("dist", { recursive: true });
await esbuild.build({
  entryPoints: ["src/ui/main.ts"],
  outfile: "dist/app.js",
  format: "esm",
  platform: "browser",
  bundle: true,
  minify: true,
  target: "es2022",
  nodePaths: local ? [resolve(local)] : [],
});
const appDigest = await sha256(await readFile("dist/app.js"));
const integrity = "sha256-" + Buffer.from(appDigest, "hex").toString("base64");
const html = (await readFile("site/index.html", "utf8")).replace(
  'src="./app.js"',
  'src="./app.js" integrity="' + integrity + '"',
);
await Promise.all([
  writeFile("dist/index.html", html),
  cp("site/app.css", "dist/app.css"),
  cp("test/vectors/public-vectors.json", "dist/public-vectors.json"),
]);
const commit =
  process.env.GITHUB_SHA ||
  execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const dirty =
  !process.env.GITHUB_SHA &&
  Boolean(
    execFileSync(
      "git",
      [
        "status",
        "--porcelain",
        "--untracked-files=normal",
        "--",
        "src",
        "scripts",
        "site",
        "test",
        "package.json",
        "package-lock.json",
      ],
      { encoding: "utf8" },
    ).trim(),
  );
const files = {};
for (const name of ["index.html", "app.js", "app.css", "public-vectors.json"])
  files[name] = await sha256(await readFile("dist/" + name));
const body = { schema: "qorelens-build-v1", commit, dirty, files };
await writeFile(
  "dist/build.json",
  JSON.stringify(
    { ...body, fingerprint: await sha256(canonical(body)) },
    null,
    2,
  ) + "\n",
);
