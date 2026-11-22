import { diana } from "./network.mjs";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let pending = Promise.resolve();
let last = 0;
let cachedChain;
let id = 0;

export function rpc(method, params = [], { fresh = false } = {}) {
  if (
    ![
      "eth_chainId",
      "eth_call",
      "eth_getBalance",
      "eth_getTransactionCount",
    ].includes(method)
  )
    return Promise.reject(Error("Diana RPC method is not read-only"));
  if (
    !fresh &&
    method === "eth_chainId" &&
    cachedChain &&
    Date.now() - cachedChain.at < 15000
  )
    return Promise.resolve(cachedChain.value);
  const task = pending.then(async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      await wait(Math.max(0, 150 - (Date.now() - last)));
      last = Date.now();
      const request = ++id;
      let response;
      try {
        response = await fetch(diana.evm, {
          method: "POST",
          credentials: "omit",
          redirect: "error",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: request, method, params }),
          signal: AbortSignal.timeout(4000),
        });
      } catch (error) {
        throw Error("Diana EVM RPC transport or CORS error: " + String(error));
      }
      if ([429, 502, 503, 504].includes(response.status) && attempt === 0) {
        await response.body?.cancel();
        await wait(600);
        continue;
      }
      const raw = await response.text();
      if (!response.ok) throw Error("HTTP " + response.status + ": " + raw);
      const body = JSON.parse(raw);
      if (body.error) throw Error(JSON.stringify(body.error));
      if (body.id !== request || !Object.hasOwn(body, "result"))
        throw Error("Invalid RPC response: " + raw);
      if (method === "eth_chainId" && body.result === diana.evmId)
        cachedChain = { value: body.result, at: Date.now() };
      return body.result;
    }
  });
  pending = task.catch(() => {});
  return task;
}
