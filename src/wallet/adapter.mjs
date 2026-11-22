export function inspectWallet(wallet = globalThis.window?.qorex) {
  const native = wallet?.native;
  const methods = Object.fromEntries(
    [
      "getKey",
      "signArbitrary",
      "verifyArbitrary",
      "signAndBroadcast",
      "signDirect",
    ].map((name) => [
      name,
      typeof native?.[name] === "function" ? native[name].length : null,
    ]),
  );
  return {
    detected: Boolean(wallet),
    version: typeof wallet?.version === "string" ? wallet.version : null,
    advertised: Array.isArray(native?.capabilities)
      ? native.capabilities.filter((x) => typeof x === "string")
      : [],
    methods,
    svm: Boolean(wallet?.svm),
    nativeChainQuery: typeof native?.getChainId,
  };
}

export async function connectProvider(announce = globalThis.window) {
  const wallet = announce?.qorex;
  if (!wallet?.evm || !wallet?.native || announce.__qorexMock)
    throw Error("Real QoreX native and EVM providers are required");
  const real = await new Promise((resolve) => {
    const finish = (result) => {
      clearTimeout(timer);
      announce.removeEventListener("eip6963:announceProvider", receive);
      resolve(result);
    };
    const receive = (e) => {
      if (
        e.detail?.info?.rdns === "network.qore.qorex" &&
        e.detail.provider === wallet.evm
      )
        finish(true);
    };
    const timer = setTimeout(() => finish(false), 900);
    announce.addEventListener("eip6963:announceProvider", receive);
    announce.dispatchEvent(new Event("eip6963:requestProvider"));
  });
  if (!real) throw Error("QoreX EIP-6963 provider announcement did not match");
  return wallet;
}
