import { inspectWallet } from "../wallet/adapter.mjs";
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
const drawer = element<HTMLDialogElement>("drawer");
const approval = element<HTMLDialogElement>("approval");
element("decline").onclick = () => approval.close("cancel");
element("approve").onclick = () => approval.close("approve");
const showEvidence = (name, row) => {
  element("drawer-title").textContent = name;
  element("drawer-data").textContent = JSON.stringify(row, null, 2);
  const comparisons = element("drawer-comparisons");
  comparisons.replaceChildren();
  for (const check of row.checks ?? []) {
    const item = document.createElement("li");
    const observed = check.valid ?? check.observed;
    item.textContent =
      check.name +
      ": " +
      (typeof observed === "boolean"
        ? observed
          ? "accepted"
          : "rejected"
        : (check.error ?? "no result")) +
      (typeof check.ms === "number" ? " · " + check.ms.toFixed(1) + " ms" : "");
    comparisons.append(item);
  }
  element("copy-status").textContent = "";
  if (!drawer.open) drawer.showModal();
};
element("drawer-close").onclick = () => drawer.close();
element("copy").onclick = async () => {
  try {
    await navigator.clipboard.writeText(
      element("drawer-data").textContent ?? "",
    );
    element("copy-status").textContent = "Evidence copied";
  } catch (error) {
    element("copy-status").textContent = String(error);
  }
};
const consent = (payload) =>
  new Promise<boolean>((resolve) => {
    element("approval-data").textContent = JSON.stringify(payload, null, 2);
    approval.returnValue = "cancel";
    approval.addEventListener(
      "close",
      () => resolve(approval.returnValue === "approve"),
      { once: true },
    );
    approval.showModal();
  });
const render = (run?) => {
  const body = element("matrix");
  const rail = element("rail");
  const current = document.activeElement?.getAttribute("data-lens");
  body.replaceChildren();
  rail.replaceChildren();
  Object.entries(matrix).forEach(([name, row], index) => {
    const id = "lens-" + index;
    const tr = document.createElement("tr");
    tr.id = id;
    const heading = document.createElement("th");
    heading.scope = "row";
    const open = document.createElement("button");
    open.type = "button";
    open.textContent = name;
    open.dataset.lens = id;
    open.onclick = () => showEvidence(name, row);
    heading.append(open);
    tr.append(heading);
    for (const [col, value] of [
      row.advertised ?? "—",
      row.observed ?? row.error ?? "—",
      row.evidenceClass ?? "—",
      row.verdict,
    ].entries()) {
      const td = document.createElement("td");
      td.textContent = String(value);
      if (col === 3)
        td.className =
          "verdict " + row.verdict.toLowerCase().replaceAll(" ", "-");
      tr.append(td);
    }
    body.append(tr);
    const entry = document.createElement("li");
    const jump = document.createElement("a");
    jump.href = "#" + id;
    const label =
      row.verdict === "VERIFIED"
        ? "✓ "
        : row.verdict === "MISMATCH" || row.verdict === "BLOCKED"
          ? "× "
          : "○ ";
    jump.textContent = label + name;
    jump.setAttribute("aria-label", name + ": " + row.verdict);
    jump.title = row.verdict;
    entry.append(jump);
    rail.append(entry);
    if (current === id) open.focus();
  });
  const guard = matrix["Network guard"];
  element("network-state").textContent =
    "Diana · 0x2648 · " +
    (guard.verdict === "CHAIN-OBSERVED"
      ? "guard passed"
      : guard.verdict === "BLOCKED"
        ? "guard blocked"
        : "awaiting guard");
  if (run?.wallet)
    element("wallet-state").textContent = run.wallet.detected
      ? "QoreX " + (run.wallet.version ?? "version unknown")
      : "QoreX unavailable";
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
      consent,
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
render({ wallet: inspectWallet() });
try {
  build = await verifyBuild();
  if (
    location.protocol === "https:" &&
    (build.dirty || !build.ciRunId || !build.bundledFonts)
  )
    throw Error(
      "Hosted wallet use requires a committed CI build with bundled fonts",
    );
  vectors = JSON.parse(build.vectorText);
  delete build.vectorText;
  status.textContent = "Build verified · " + build.fingerprint.slice(0, 12);
  actions.forEach((x) => (x.disabled = false));
} catch (error) {
  status.textContent = String(error);
}
