const bytes = new TextEncoder();
export const sha256 = async (data) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        typeof data === "string" ? bytes.encode(data) : data,
      ),
    ),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
export function canonical(value) {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.keys(value)
        .sort()
        .filter((k) => value[k] !== undefined)
        .map((k) => JSON.stringify(k) + ":" + canonical(value[k]))
        .join(",") +
      "}"
    );
  return JSON.stringify(value) ?? "null";
}

export async function createReport(payload) {
  if (!payload?.build?.fingerprint)
    throw Error("A verified build fingerprint is required");
  const body = JSON.parse(
    canonical({ schema: "qorelens-report-v1", ...payload }),
  );
  return {
    ...body,
    integrity: { algorithm: "SHA-256", digest: await sha256(canonical(body)) },
  };
}

const markdownCell = (x) => String(x ?? "").replace(/[|\r\n]/g, " ");
export function renderMarkdown(report) {
  const results = Object.entries(report.results).map(
    ([name, value]) =>
      "| " +
      markdownCell(name) +
      " | " +
      markdownCell(value.verdict) +
      " | " +
      markdownCell(value.evidenceClass) +
      " |",
  );
  return [
    "# QoreLens evidence",
    "",
    "Build " + report.build.commit,
    "",
    "SHA-256 " + report.integrity.digest,
    "",
    "| Capability | Verdict | Evidence |",
    "| --- | --- | --- |",
    ...results,
    "",
    "~~~json",
    JSON.stringify(report, null, 2),
    "~~~",
    "",
  ].join("\n");
}

export async function importReport(text) {
  if (typeof text !== "string" || text.length > 2_000_000)
    throw Error("Report exceeds import limit");
  const markdown = text.startsWith("# QoreLens evidence\n");
  const encoded = markdown
    ? text.slice(text.indexOf("\n~~~json\n") + 9, text.lastIndexOf("\n~~~\n"))
    : text;
  const report = JSON.parse(encoded);
  const { integrity, ...body } = report;
  if (
    body.schema !== "qorelens-report-v1" ||
    !body.build?.fingerprint ||
    !body.results ||
    integrity?.algorithm !== "SHA-256" ||
    integrity.digest !== (await sha256(canonical(body)))
  )
    throw Error("Report integrity check failed");
  if (markdown && renderMarkdown(report) !== text)
    throw Error("Markdown content differs from its verified payload");
  return report;
}
