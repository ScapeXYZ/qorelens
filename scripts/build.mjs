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
  plugins: [
    {
      name: "separate-verifier",
      setup(build) {
        build.onResolve({ filter: /verify\/verdict\.mjs$/ }, () => ({
          path: "./verifier.js",
          external: true,
        }));
      },
    },
  ],
});
await esbuild.build({
  entryPoints: ["src/verify/verdict.mjs"],
  outfile: "dist/verifier.js",
  format: "esm",
  platform: "browser",
  bundle: true,
  minify: true,
  target: "es2022",
  nodePaths: local ? [resolve(local)] : [],
});
const fontFiles = {
  "plex-sans.woff2":
    "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2",
  "plex-sans-semibold.woff2":
    "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2",
  "plex-mono.woff2":
    "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2",
};
const assets = [
  "index.html",
  "app.js",
  "app.css",
  "verifier.js",
  "public-vectors.json",
];
for (const [name, source] of Object.entries(fontFiles)) {
  try {
    await cp("node_modules/" + source, "dist/" + name);
    assets.push(name);
  } catch (error) {
    if (
      !process.env.QORELENS_ALLOW_LOCAL_FONT_FALLBACK ||
      process.env.GITHUB_ACTIONS ||
      error.code !== "ENOENT"
    )
      throw error;
  }
}
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
for (const name of assets)
  files[name] = await sha256(await readFile("dist/" + name));
const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
const manifest = JSON.parse(await readFile("package.json", "utf8"));
const dependencyVersions = {};
for (const [name, version] of Object.entries({
  ...manifest.dependencies,
  ...manifest.devDependencies,
})) {
  const installed = lock.packages["node_modules/" + name]?.version;
  if (
    installed !== version &&
    (!process.env.QORELENS_ALLOW_LOCAL_FONT_FALLBACK ||
      process.env.GITHUB_ACTIONS)
  )
    throw Error("Unpinned dependency: " + name);
  if (installed === version) dependencyVersions[name] = installed;
}
const ciRunId = process.env.GITHUB_RUN_ID ?? null;
if (process.env.GITHUB_ACTIONS && !ciRunId) throw Error("Missing CI run ID");
const body = {
  schema: "qorelens-build-v2",
  commit,
  dirty,
  ciRunId,
  buildTimestamp: new Date().toISOString(),
  bundleSha256: files["app.js"],
  verifierSha256: files["verifier.js"],
  dependencyVersions,
  files,
  bundledFonts: Object.keys(fontFiles).every((name) => assets.includes(name)),
};
const output =
  JSON.stringify(
    { ...body, fingerprint: await sha256(canonical(body)) },
    null,
    2,
  ) + "\n";
await Promise.all(
  ["build.json", "fingerprint.json"].map((name) =>
    writeFile("dist/" + name, output),
  ),
);
