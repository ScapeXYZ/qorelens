import { diana } from './network.mjs';

const statusAddress = '0x0000000000000000000000000000000000000a02';
const verifyAddress = '0x0000000000000000000000000000000000000a01';
const addressPattern = /^0x[0-9a-f]{40}$/i;
const bytesPattern = /^0x(?:[0-9a-f]{2})*$/i;
const word = (number) => BigInt(number).toString(16).padStart(64, '0');

export async function rpc(method, params = []) {
  const response = await fetch(diana.evm, {
    method: 'POST', credentials: 'omit', redirect: 'error',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(10000),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${raw}`);
  const body = JSON.parse(raw);
  if (body.error) throw new Error(JSON.stringify(body.error));
  if (body.id !== 1 || !Object.hasOwn(body, 'result')) throw new Error(`Invalid RPC response: ${raw}`);
  return body.result;
}

async function ethCall(to, data) {
  if (await rpc('eth_chainId') !== diana.evmId) throw new Error('Diana EVM chain ID mismatch');
  const result = await rpc('eth_call', [{to, data}, 'latest']);
  if (!bytesPattern.test(result)) throw new Error(`Invalid eth_call bytes: ${result}`);
  return result.slice(2).toLowerCase();
}

function asBool(value) {
  if (value === word(0)) return false;
  if (value === word(1)) return true;
  throw new Error('Invalid ABI bool: ' + value);
}

export async function keyStatus(account, target = statusAddress) {
  if (!addressPattern.test(account) || !addressPattern.test(target)) throw new Error('Invalid EVM address');
  const raw = await ethCall(target, '0x850dfe51' + account.slice(2).padStart(64, '0'));
  if (raw.length < 320 || raw.slice(128, 192) !== word(128)) {
    throw new Error('Expected four-output pqcKeyStatus ABI, received 0x' + raw);
  }
  const algorithmId = Number(BigInt('0x' + raw.slice(64, 128)));
  const keyBytes = Number(BigInt('0x' + raw.slice(256, 320)));
  if (algorithmId > 255 || !Number.isSafeInteger(keyBytes) || raw.length !== 320 + Math.ceil(keyBytes / 32) * 64) {
    throw new Error('Invalid pqcKeyStatus result lengths');
  }
  return { registered: asBool(raw.slice(0, 64)), algorithmId,
    possessionProven: asBool(raw.slice(192, 256)), keyBytes,
    publicKey: '0x' + raw.slice(320, 320 + keyBytes * 2), raw: '0x' + raw };
}

export async function pqcVerify(publicKey, signature, message) {
  const values = [publicKey, signature, message];
  if (!values.every((value) => typeof value === 'string' && bytesPattern.test(value))) {
    throw new Error('PQC inputs must be 0x-prefixed hex bytes');
  }
  let offset = 96;
  let head = '';
  let tail = '';
  for (const value of values) {
    const hex = value.slice(2);
    const padded = hex.padEnd(Math.ceil(hex.length / 64) * 64, '0');
    head += word(offset);
    tail += word(hex.length / 2) + padded;
    offset += 32 + padded.length / 2;
  }
  return asBool(await ethCall(verifyAddress, '0xf52bde0a' + head + tail));
}
