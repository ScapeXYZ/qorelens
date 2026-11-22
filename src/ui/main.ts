import { emptyMatrix } from "../lens/evidence.mjs";
import { probeEvidence, runSession } from "../lens/session.mjs";
import { selfTest } from "../verify/verdict.mjs";
import { verifyBuild } from "../report/fingerprint.mjs";
import {
  createReport,
  importReport,
  renderMarkdown,
} from "../report/integrity.mjs";

const element = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const status = element("status");
const actions = ["run", "vectors", "probe"].map((id) =>
  element<HTMLButtonElement>(id),
);
const downloads = ["json", "markdown"].map((id) =>
  element<HTMLButtonElement>(id),
);
const version = element<HTMLInputElement>("version");
let matrix = emptyMatrix();
let build;
let vectors;
let busy = false;
let report;
const render = (run?) => {
  const body = element("matrix");
  body.replaceChildren();
  for (const [name, row] of Object.entries(matrix)) {
    const tr = document.createElement("tr");
    for (const value of [
      name,
      row.advertised ?? "—",
      row.observed ?? row.error ?? "—",
      row.evidenceClass ?? "—",
      row.verdict,
    ]) {
      const td = document.createElement("td");
      td.textContent = String(value);
      tr.append(td);
    }
    body.append(tr);
  }
  element("raw").textContent = JSON.stringify(run ?? matrix, null, 2);
  if (run?.signer)
    element("signer").textContent =
      "Signer (native lane): " +
      run.signer.bech32 +
      " · " +
      run.signer.hex +
      " | EVM-lane account: " +
      run.evmAccount;
};
const interact = async (fn) => {
  if (!build || busy) return;
  busy = true;
  actions.forEach((x) => (x.disabled = true));
  downloads.forEach((x) => (x.disabled = true));
  try {
    const result = await fn();
    report = await createReport({
      build,
      browser: navigator.userAgent,
      utc: new Date().toISOString(),
      results: matrix,
      ...result,
    });
    downloads.forEach((x) => (x.disabled = false));
    status.textContent =
      "Saved in this tab · Build " + build.fingerprint.slice(0, 12);
  } catch (error) {
    status.textContent = String(error);
  } finally {
    busy = false;
    actions.forEach((x) => (x.disabled = false));
    render(report);
  }
};
actions[0].onclick = () =>
  interact(async () => {
    matrix = emptyMatrix();
    status.textContent = "Review each QoreX request";
    const result = await runSession({
      vectors,
      version: version.value.trim(),
      consent: (payload) =>
        confirm(
          "Diana testnet wallet request\n\n" + JSON.stringify(payload, null, 2),
        ),
      confirmSigner: (signer) =>
        prompt("Type the last six characters of " + signer.bech32),
      update: (run) => {
        matrix = run.results;
        render(run);
      },
    });
    matrix = result.results;
    return result;
  });
actions[1].onclick = () =>
  interact(async () => {
    matrix["Verifier self-test"] = selfTest(vectors);
    return {};
  });
actions[2].onclick = () =>
  interact(async () => {
    matrix["Deployed probe"] = await probeEvidence();
    return {};
  });
function download(content, name, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
downloads[0].onclick = () =>
  download(
    JSON.stringify(report, null, 2) + "\n",
    "qorelens-report.json",
    "application/json",
  );
downloads[1].onclick = () =>
  download(renderMarkdown(report), "qorelens-report.md", "text/markdown");
element<HTMLInputElement>("import").onchange = async (event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    if (file.size > 2_000_000) throw Error("Report exceeds import limit");
    const imported = await importReport(await file.text());
    element("import-status").textContent =
      "Imported evidence · hash valid · author and build provenance unverified";
    element("imported").textContent = JSON.stringify(imported, null, 2);
  } catch (error) {
    element("import-status").textContent = String(error);
    element("imported").textContent = "";
  }
};
actions.forEach((x) => (x.disabled = true));
render();
try {
  build = await verifyBuild();
  if (location.protocol === "https:" && build.dirty)
    throw Error("Hosted wallet use requires a committed build");
  vectors = JSON.parse(build.vectorText);
  delete build.vectorText;
  status.textContent = "Build verified · " + build.fingerprint.slice(0, 12);
  actions.forEach((x) => (x.disabled = false));
} catch (error) {
  status.textContent = String(error);
}
