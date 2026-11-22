import { canonical, sha256 } from "./integrity.mjs";
export async function verifyBuild(base = document.baseURI, fetcher = fetch) {
  const response = await fetcher(new URL("build.json", base), {
    cache: "no-store",
  });
  if (!response.ok) throw Error("Build manifest HTTP " + response.status);
  const { fingerprint, ...body } = await response.json();
  if (
    body.schema !== "qorelens-build-v1" ||
    (await sha256(canonical(body))) !== fingerprint
  )
    throw Error("Invalid build manifest fingerprint");
  let vectorText;
  for (const name of [
    "index.html",
    "app.js",
    "app.css",
    "public-vectors.json",
  ]) {
    const asset = await fetcher(new URL(name, base), { cache: "no-store" });
    const content = await asset.arrayBuffer();
    if (!asset.ok || (await sha256(content)) !== body.files?.[name])
      throw Error("Build asset fingerprint mismatch: " + name);
    if (name === "public-vectors.json")
      vectorText = new TextDecoder().decode(content);
  }
  return { ...body, fingerprint, vectorText };
}
