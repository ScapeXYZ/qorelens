$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
if (Test-Path -LiteralPath 'evidence/video-session-rpc-verification.json') { throw 'RPC evidence already exists' }
$program = @'
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const dir = resolve("evidence");
const report = JSON.parse(await readFile(resolve(dir, "video-session.json")));
const saved = report.results["Hybrid transaction"];
const hash = "5216F3E05807BDEBD8E843E831635FE60316D294FE94DE03690F3C5D520D8DDE";
const height = 10625585;
assert.equal(saved.result.txHash, hash);
assert.equal(saved.result.height, height);
assert.equal(report.signer.bech32, "qor1ylgewp0h038mrnslyte4yst20q0zwdhqs7fujv");
assert.equal(report.build.commit, "613335b03e1c95b587a67fada29031ed415e17de");
const evidenceFile = resolve(dir, "video-session-rpc-verification.json");
const rawResponses = {};
const native = "https://rpc-testnet.qore.host";
const evm = "https://evm-testnet.qore.host";
const paths = [height - 1, height].map((n) => "0x" + n.toString(16));
const calls = [
  ["native-status", native + "/status"],
  ["native-tx", native + "/tx?hash=0x" + hash + "&prove=false"],
  ["evm-chain", evm, "eth_chainId", []],
  ...paths.flatMap((tag, i) => [
    ["nonce-" + i, evm, "eth_getTransactionCount", [report.signer.hex, tag]],
    ["balance-" + i, evm, "eth_getBalance", [report.signer.hex, tag]],
  ]),
];
const results = await Promise.all(calls.map(async ([name, url, method, params]) => {
  try {
    const response = await fetch(url, {
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      ...(method ? { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) } : {}),
    });
    const text = await response.text();
    rawResponses[name] = text;
    const json = JSON.parse(text);
    if (!response.ok || json.error || json.result == null)
      return [name, { status: "UNRESOLVED", http: response.status, error: json.error }];
    return [name, { status: "PASS", result: json.result }];
  } catch (error) {
    return [name, { status: "UNRESOLVED", error: String(error), cause: String(error.cause ?? "") }];
  }
}));
const rpc = Object.fromEntries(results);
const checks = {};
const check = (name, ready, verify) => {
  if (!ready) { checks[name] = { status: "UNRESOLVED" }; return; }
  try { checks[name] = { status: "PASS", details: verify() }; }
  catch (error) { checks[name] = { status: "FAIL", error: String(error) }; }
};
check("nativeChain", rpc["native-status"].result, () =>
  assert.equal(rpc["native-status"].result.node_info.network, "qorechain-diana"));
check("evmChain", rpc["evm-chain"].result, () => assert.equal(rpc["evm-chain"].result, "0x2648"));
const tx = rpc["native-tx"].result;
check("transactionInclusion", tx, () => {
  assert.equal(tx.hash.toUpperCase(), hash);
  assert.equal(Number(tx.height), height);
  assert.equal(Number(tx.tx_result.code), 0);
  assert.equal(createHash("sha256").update(Buffer.from(tx.tx, "base64")).digest("hex").toUpperCase(), hash);
  return { hash, height, code: Number(tx.tx_result.code), gasUsed: tx.tx_result.gas_used };
});
check("messageAndFee", tx, () => {
  const require = createRequire("C:/dev/qorelens/package.json");
  const { TxRaw, TxBody, AuthInfo } = require("cosmjs-types/cosmos/tx/v1beta1/tx");
  const { MsgSend } = require("cosmjs-types/cosmos/bank/v1beta1/tx");
  const raw = TxRaw.decode(Buffer.from(tx.tx, "base64"));
  const body = TxBody.decode(raw.bodyBytes);
  const auth = AuthInfo.decode(raw.authInfoBytes);
  assert.equal(body.memo, "qorelens-gate-g6");
  assert.equal(body.messages.length, 1);
  assert.equal(body.messages[0].typeUrl, "/cosmos.bank.v1beta1.MsgSend");
  const msg = MsgSend.decode(body.messages[0].value);
  assert.equal(msg.fromAddress, report.signer.bech32);
  assert.equal(msg.toAddress, report.signer.bech32);
  assert.deepEqual(msg.amount, [{ denom: "uqor", amount: "1" }]);
  const fee = auth.fee?.amount;
  assert.equal(fee?.length, 1);
  assert.equal(fee[0].denom, "uqor");
  assert.equal(fee[0].amount, "60000");
  const attr = (event) => Object.fromEntries((event.attributes ?? []).map((x) => [x.key, x.value]));
  const feeEvents = tx.tx_result.events.filter((e) => e.type === "tx").map(attr).filter((e) => e.fee);
  const transfers = tx.tx_result.events.filter((e) => e.type === "transfer").map(attr);
  assert.ok(transfers.some((e) => e.sender === msg.fromAddress && e.recipient === msg.toAddress && e.amount === "1uqor"));
  assert.ok(feeEvents.some((e) => e.fee === fee[0].amount + "uqor" && e.fee_payer === msg.fromAddress));
  const hybrid = tx.tx_result.events.filter(e => e.type === "pqc_hybrid_verify").map(attr);
  assert.ok(hybrid.some(e => e.address === msg.fromAddress && e.status === "verified"));
  return { signer: msg.fromAddress, recipient: msg.toAddress, amount: msg.amount, memo: body.memo,
    fee, feeEvents, pqcEvents: tx.tx_result.events.filter((e) => e.type.startsWith("pqc_")),
    explorerAmountComparison: fee[0].amount === "60000" ? "0.06 QOR equals the charged fee; MsgSend amount is 1 uqor" : "0.06 QOR differs from the decoded fee" };
});
check("historicalState", ["nonce-0", "nonce-1", "balance-0", "balance-1"].every((k) => rpc[k].status === "PASS"), () => {
  const before = { nonce: rpc["nonce-0"].result, balance: rpc["balance-0"].result };
  const after = { nonce: rpc["nonce-1"].result, balance: rpc["balance-1"].result };
  for (const k of ["nonce", "balance"]) {
    assert.equal(BigInt(before[k]), BigInt(saved.before[k]));
    assert.equal(BigInt(after[k]), BigInt(saved.after[k]));
  }
  assert.equal(BigInt(before.nonce), 6n);
  assert.equal(BigInt(after.nonce), 7n);
  assert.equal(BigInt(before.balance) - BigInt(after.balance), 60000000000000000n);
  return { before, after, heights: [height - 1, height], decrease: String(BigInt(before.balance) - BigInt(after.balance)) };
});
const status = Object.values(checks).some((x) => x.status === "FAIL") ? "FAIL"
  : Object.values(checks).some((x) => x.status === "UNRESOLVED") ? "UNRESOLVED" : "PASS";
const output = { status, checks, rawResponses, requests: calls.map(([name, url, method, params]) => ({ name, url, method, params })),
  rpcStatus: Object.fromEntries(results.map(([name, { result, ...status }]) => [name, status])) };
await writeFile(evidenceFile, JSON.stringify(output, null, 2) + "\n", { flag: "wx" });
console.log(status + " " + evidenceFile);
if (status !== "PASS") process.exitCode = 1;

'@
$program | node --input-type=module -
exit $LASTEXITCODE
