import { connectProvider, inspectWallet } from "../wallet/adapter.mjs";
import { bindAccount } from "./account.mjs";
import {
  evidence,
  emptyMatrix,
  keyBindingEvidence,
  invalidKeyReason,
  validBinding,
  walletCrossCheckVerdict,
  withReason,
} from "./evidence.mjs";
import { diana, probe, probeDeployer } from "../chain/network.mjs";
import { keyStatus, pqcVerify, rpc } from "../chain/precompiles.mjs";
import { encodeSelfTransfer } from "../verify/crypto.mjs";
import { hexString } from "../verify/vector-checks.mjs";
import { selfTest, verifyMessage } from "../verify/verdict.mjs";

export const message =
  "QoreX gate test 1 - harmless fixed message - no authorization - testnet only";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const toHex = (bytes) => "0x" + hexString(bytes);
export async function probeEvidence() {
  const start = performance.now();
  try {
    const result = await keyStatus(probeDeployer, probe);
    return evidence(validBinding(result) ? "CHAIN-OBSERVED" : "MISMATCH", {
      ...(validBinding(result)
        ? {}
        : {
            reason: "Probe registry result lacks the expected registered key",
          }),
      evidenceClass: "INDEPENDENT",
      observed: "Diana wrapper returned registry data",
      address: probe,
      result,
      ms: performance.now() - start,
    });
  } catch (error) {
    return evidence("BLOCKED", { error: String(error) });
  }
}

export async function runSession({
  vectors,
  consent,
  confirmSigner,
  version,
  update = () => {},
}) {
  const matrix = emptyMatrix();
  const walletInfo = inspectWallet();
  const run = {
    utc: new Date().toISOString(),
    rpc: diana.evm,
    wallet: { ...walletInfo, version: walletInfo.version || version || null },
    requests: [],
    approvals: 0,
    results: matrix,
  };
  const set = (name, value) => {
    matrix[name] = withReason(
      value,
      "Independent verification did not meet the expected outcomes",
    );
    update(run);
  };
  const failure = (error, verdict = "BLOCKED") =>
    evidence(verdict, { error: String(error) });
  const fixtureResult = selfTest(vectors);
  set("Verifier self-test", fixtureResult);
  set(
    "Provider diagnostics",
    evidence(walletInfo.detected ? "WALLET-REPORTED" : "BLOCKED", {
      evidenceClass: walletInfo.detected ? "WALLET-REPORTED" : undefined,
      advertised: walletInfo.advertised.join(", "),
      observed: walletInfo.detected ? "QoreX detected" : "QoreX unavailable",
      methods: walletInfo.methods,
      excluded: ["eth_sendTransaction", "wallet_sendCalls", "signDirect"],
      svm: walletInfo.svm,
    }),
  );
  for (const method of [
    "signDirect",
    "eth_sendTransaction",
    "wallet_sendCalls",
    "Atomic calls",
  ]) {
    const advertised = walletInfo.advertised.some(
      (flag) =>
        flag === method || (method === "Atomic calls" && /atomic/i.test(flag)),
    );
    set(
      method,
      evidence(advertised ? "ADVERTISED-ONLY" : "NOT EXERCISED", {
        advertised,
        observed: "Outside the exercised request surface",
      }),
    );
  }
  const wrapper = probeEvidence().then((value) => set("Deployed probe", value));
  let guard = false;
  const request = async (
    lane,
    fn,
    args,
    invoke,
    { approval = false, sign = false } = {},
  ) => {
    if (sign && !guard) throw Error("Diana network guard is blocked");
    if (approval && run.approvals >= 6)
      throw Error("Six-approval limit reached");
    const payload = {
      lane,
      method: fn,
      args,
      network: diana.cosmosId,
      signer: run.signer?.bech32 ?? null,
    };
    if (!(await consent(payload))) throw Error("User declined " + fn);
    if (approval) run.approvals++;
    const entry = { ...payload, utc: new Date().toISOString() };
    run.requests.push(entry);
    const start = performance.now();
    try {
      return await invoke();
    } catch (error) {
      entry.error = {
        message: error?.message ?? String(error),
        code: error?.code,
      };
      throw error;
    } finally {
      entry.ms = performance.now() - start;
      update(run);
    }
  };
  let wallet, native, evm, signer, evmAccount, binding, evmId;
  let refresh;
  try {
    if (fixtureResult.verdict !== "VERIFIED")
      throw Error("Verifier self-test failed");
    wallet = await connectProvider();
    if (!run.wallet.version) throw Error("Enter the QoreX extension version");
    evm = (method, params = [], options) =>
      request(
        "EVM",
        method,
        { method, params },
        () => wallet.evm.request({ method, params }),
        options,
      );
    native = (method, args, options) =>
      request(
        "native",
        method,
        args,
        () => wallet.native[method](...args),
        options,
      );
    const publicId = await rpc("eth_chainId", [], { fresh: true });
    evmId = await evm("eth_chainId");
    run.chain = {
      publicId,
      walletEvmId: evmId,
      nativeQuery: typeof wallet.native.getChainId,
      requestedNative: diana.cosmosId,
    };
    if (publicId !== diana.evmId || evmId !== publicId)
      throw Error(
        "Switch QoreX to Diana testnet and rerun. Wallet or public EVM chain differs.",
      );
    const connected = await evm("eth_requestAccounts", [], { approval: true });
    [evmAccount] = (await evm("eth_accounts")) ?? connected ?? [];
    const key = await native("getKey", [diana.cosmosId], { approval: true });
    const identity = bindAccount(key, evmAccount);
    signer = {
      bech32: key.bech32Address,
      hex: identity.c,
      publicKey: identity.nativeKey.pubKey,
    };
    run.signer = signer;
    run.evmAccount = evmAccount;
    run.laneIdentity = identity;
    if (
      typeof wallet.native.chainId === "string" &&
      wallet.native.chainId !== diana.cosmosId
    )
      throw Error("Native QoreX provider reports a different chain");
    binding = await keyStatus(signer.hex);
    const keyEvidence = keyBindingEvidence(binding);
    set("Key binding", keyEvidence);
    if (keyEvidence.verdict === "BLOCKED") throw Error(invalidKeyReason);
    if ((await confirmSigner(signer)) !== signer.bech32.slice(-6))
      throw Error("Native signer address confirmation did not match");
    guard = true;
    set(
      "Network guard",
      evidence("CHAIN-OBSERVED", {
        evidenceClass: "INDEPENDENT",
        observed: "Diana ID and native signer binding passed",
        chain: run.chain,
        addressesEqual: identity.addressesEqual,
      }),
    );
    refresh = async () => {
      guard = false;
      const [publicId, walletId] = [
        await rpc("eth_chainId", [], { fresh: true }),
        await evm("eth_chainId"),
      ];
      const current = await native("getKey", [diana.cosmosId]);
      const currentIdentity = bindAccount(current, evmAccount);
      if (
        publicId !== diana.evmId ||
        walletId !== publicId ||
        current.bech32Address !== signer.bech32 ||
        currentIdentity.c !== signer.hex ||
        JSON.stringify(currentIdentity.nativeKey.pubKey) !==
          JSON.stringify(signer.publicKey) ||
        (typeof wallet.native.chainId === "string" &&
          wallet.native.chainId !== diana.cosmosId)
      ) {
        const error = Error(
          "Diana chain or native signer changed before approval",
        );
        set("Network guard", failure(error));
        throw error;
      }
      guard = true;
    };
  } catch (error) {
    set("Network guard", failure(error));
    set(
      "Hybrid transaction",
      evidence("NOT EXERCISED", { reason: "Diana network guard did not pass" }),
    );
    await wrapper;
    return run;
  }

  let response, checked;
  try {
    if (walletInfo.methods.signArbitrary !== 3) {
      const verdict = walletInfo.advertised.includes("signArbitrary")
        ? "ADVERTISED-ONLY"
        : "NOT EXERCISED";
      set(
        "Message signing",
        evidence(verdict, {
          advertised: walletInfo.advertised.includes("signArbitrary"),
          observed: "Expected QoreX signArbitrary arity 3 is unavailable",
        }),
      );
    } else {
      await refresh();
      try {
        response = await native(
          "signArbitrary",
          [diana.cosmosId, signer.bech32, message],
          { approval: true, sign: true },
        );
      } catch (error) {
        set(
          "Message signing",
          failure(
            error,
            /unsupported|not yet supported|not implemented/i.test(String(error))
              ? "UNSUPPORTED"
              : "BLOCKED",
          ),
        );
      }
      if (response) {
        set(
          "Message signing",
          evidence("WALLET-REPORTED", {
            evidenceClass: "WALLET-REPORTED",
            observed: "QoreX returned a signature",
            raw: response,
          }),
        );
        checked = await verifyMessage({
          fixtureResult,
          vectors,
          binding,
          signature: response,
          address: signer.bech32,
          chainId: diana.cosmosId,
          message,
          signerPublicKey: signer.publicKey,
        });
        set("Message signing", {
          ...checked.result,
          observed: "QoreX returned a signature",
          raw: response,
        });
        set("Tamper controls", {
          ...checked.result,
          observed: "Five modified inputs tested",
        });
        set("Key binding", {
          ...checked.result,
          observed: "Native signer registry read",
          binding,
        });
      } else if (matrix["Message signing"].verdict === "NOT EXERCISED") {
        set(
          "Message signing",
          evidence("BLOCKED", { reason: "QoreX did not return a signature" }),
        );
      }
    }
  } catch (error) {
    set("Message signing", failure(error));
  }

  if (checked) {
    try {
      if (walletInfo.methods.verifyArbitrary !== 4)
        throw Error("Expected QoreX verifyArbitrary arity 4 is unavailable");
      const checks = [];
      for (const [i, data, sig] of [
        [0, message, response],
        [1, checked.changedMessage, response],
        [2, message, checked.changedSignature],
      ]) {
        const expected = checked.result.checks[i].valid;
        try {
          const observed = await native("verifyArbitrary", [
            diana.cosmosId,
            signer.bech32,
            data,
            sig,
          ]);
          checks.push({
            name: checked.result.checks[i].name,
            expected,
            observed,
          });
        } catch (error) {
          checks.push({
            name: checked.result.checks[i].name,
            expected,
            error: String(error),
          });
        }
      }
      const verdict = walletCrossCheckVerdict(checks);
      set(
        "Wallet verify cross-check",
        evidence(verdict, {
          evidenceClass: "WALLET-REPORTED",
          observed: "Three wallet verification checks",
          reason:
            verdict === "MISMATCH"
              ? "Wallet checks did not confirm a valid signature and reject both controls"
              : verdict === "BLOCKED"
                ? "Wallet did not return all three verification outcomes"
                : undefined,
          checks,
        }),
      );
    } catch (error) {
      set("Wallet verify cross-check", failure(error));
    }
    const checks = [];
    for (const c of checked.cases) {
      try {
        checks.push({
          name: c.name,
          observed: await pqcVerify(
            toHex(c.key),
            toHex(c.signature),
            toHex(c.bytes),
          ),
        });
      } catch (error) {
        checks.push({ name: c.name, error: String(error) });
      }
    }
    set(
      "Diana precompile",
      evidence(
        checks.some((x) => x.error)
          ? "BLOCKED"
          : checks.every((x, i) => x.observed === (i === 0))
            ? "CHAIN-OBSERVED"
            : "MISMATCH",
        {
          evidenceClass: "INDEPENDENT",
          observed: "Diana verification precompile tested",
          reason: checks.some((x) => x.error)
            ? "Diana verification precompile returned an error"
            : checks.every((x, i) => x.observed === (i === 0))
              ? undefined
              : "Diana verification precompile disagreed with the expected outcomes",
          checks,
        },
      ),
    );
  }

  try {
    if (walletInfo.methods.signAndBroadcast !== 1)
      throw Error("Expected QoreX signAndBroadcast arity 1 is unavailable");
    await refresh();
    const snapshot = async () => ({
      nonce: await rpc("eth_getTransactionCount", [signer.hex, "latest"]),
      balance: await rpc("eth_getBalance", [signer.hex, "latest"]),
    });
    const before = await snapshot();
    if (BigInt(before.balance) < 60001n * 1000000000000n)
      throw Error("Native signer balance below 60001 uqor fee reserve");
    const payload = {
      chainId: diana.cosmosId,
      messages: [encodeSelfTransfer(signer.bech32)],
      memo: "qorelens-gate-g6",
      gasLimit: 400000,
    };
    const result = await native("signAndBroadcast", [payload], {
      approval: true,
      sign: true,
    });
    const details = {
      before,
      result,
      observed: "Not observed on Diana",
      evidenceClass: "WALLET-REPORTED",
      hybrid:
        "Signature layer not inspected; hybrid signing inferred from chain rules",
    };
    if (/^(0x)?[a-f0-9]{64}$/i.test(result?.txHash ?? ""))
      details.explorer =
        "https://dashboard.qorechain.io/explorer/tx/" + result.txHash;
    if (result?.code !== 0 || !details.explorer) {
      set(
        "Hybrid transaction",
        evidence("BLOCKED", {
          ...details,
          reason:
            "Wallet did not report a successful transaction with a valid hash",
        }),
      );
    } else {
      set("Hybrid transaction", evidence("WALLET-REPORTED", details));
    }
    if (result?.code === 0) {
      const start = performance.now();
      do {
        try {
          details.after = await snapshot();
        } catch (error) {
          details.pollError = String(error);
          break;
        }
        const changed =
          Boolean(details.explorer) &&
          BigInt(details.after.nonce) > BigInt(before.nonce) &&
          BigInt(details.after.balance) < BigInt(before.balance);
        if (changed) {
          set(
            "Hybrid transaction",
            evidence("CHAIN-OBSERVED", {
              ...details,
              observed: "Signer nonce increased and balance decreased",
              evidenceClass: "CHAIN-OBSERVED",
              ms: performance.now() - start,
            }),
          );
          break;
        }
        await sleep(1500);
      } while (performance.now() - start < 38000);
      if (matrix["Hybrid transaction"].verdict !== "CHAIN-OBSERVED")
        set(
          "Hybrid transaction",
          evidence("BLOCKED", {
            ...details,
            reason:
              details.pollError ||
              "Signer nonce and balance movement were not observed on Diana",
            ms: performance.now() - start,
          }),
        );
    }
  } catch (error) {
    set("Hybrid transaction", failure(error));
  }
  await wrapper;
  return run;
}
