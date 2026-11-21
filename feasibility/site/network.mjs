export const diana = Object.freeze({
  evmId: '0x2648',
  cosmosId: 'qorechain-diana',
  evm: 'https://evm-testnet.qore.host',
  consensus: 'https://rpc-testnet.qore.host/status',
  rest: 'https://api-testnet.qore.host/cosmos/base/tendermint/v1beta1/node_info',
});

async function read(label, url, options, extract) {
  const start = performance.now();
  try {
    const response = await fetch(url, {
      ...options, credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(10000),
    });
    const raw = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${raw}`);
    const value = extract(JSON.parse(raw));
    if (typeof value !== 'string') throw new Error(`Missing chain ID: ${raw}`);
    return { label, url, value, raw, ms: performance.now() - start };
  } catch (error) {
    return { label, url, error: String(error), cause: error.cause?.message, ms: performance.now() - start };
  }
}

export async function readDiana() {
  const [evm, consensus, rest] = await Promise.all([
    read('EVM', diana.evm, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
    }, (body) => body.result),
    read('Consensus', diana.consensus, {}, (body) => body.result?.node_info?.network),
    read('REST', diana.rest, {}, (body) => body.default_node_info?.network),
  ]);
  return { evm, consensus, rest };
}
