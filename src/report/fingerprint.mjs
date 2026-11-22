import { canonical, sha256 } from "./integrity.mjs";
export async function verifyBuild(base = document.baseURI, fetcher = fetch) {
  const response = await fetcher(new URL("fingerprint.json", base), {
    cache: "no-store",
  });
  if (!response.ok) throw Error("Build manifest HTTP " + response.status);
  const { fingerprint, ...body } = await response.json();
  if (
    body.schema !== "qorelens-build-v2" ||
    body.bundleSha256 !== body.files?.["app.js"] ||
    body.verifierSha256 !== body.files?.["verifier.js"] ||
    !body.buildTimestamp ||
    !body.dependencyVersions ||
    (await sha256(canonical(body))) !== fingerprint
  )
    throw Error("Invalid build manifest fingerprint");
  let vectorText;
  const required = [
    "index.html",
    "app.js",
    "app.css",
    "verifier.js",
    "public-vectors.json",
  ];
  if (required.some((name) => !Object.hasOwn(body.files, name)))
    throw Error("Missing required build asset");
  const permitted = [
    ...required,
    "plex-sans.woff2",
    "plex-sans-semibold.woff2",
    "plex-mono.woff2",
  ];
  const names = Object.keys(body.files);
  if (names.some((name) => !permitted.includes(name)))
    throw Error("Unexpected build asset");
  for (const name of names) {
    const asset = await fetcher(new URL(name, base), { cache: "no-store" });
    const content = await asset.arrayBuffer();
    if (!asset.ok || (await sha256(content)) !== body.files?.[name])
      throw Error("Build asset fingerprint mismatch: " + name);
    if (name === "public-vectors.json")
      vectorText = new TextDecoder().decode(content);
  }
  return { ...body, fingerprint, vectorText };
}
