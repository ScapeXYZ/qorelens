export const utf8 = (text) => new TextEncoder().encode(text);
export function hex(value) {
  if (!/^(?:[\da-f]{2})*$/i.test(value)) throw new Error('Invalid hex bytes');
  return Uint8Array.from(value.match(/../g) || [], (byte) => Number.parseInt(byte, 16));
}
export const base64 = (value) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
export const hexString = (bytes) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
export const framed = (data, chain, domain = 'qorechain-msg-v1') => {
  const prefix = utf8(domain + '|' + chain + '|');
  const bytes = new Uint8Array(prefix.length + data.length);
  bytes.set(prefix);
  bytes.set(data, prefix.length);
  return bytes;
};
export function controls(data, chain, signature, wrongKey) {
  const wrongData = data.slice();
  const wrongSignature = signature.slice();
  wrongData[0] ^= 1;
  wrongSignature[0] ^= 1;
  return [
    { name: 'message bit', bytes: framed(wrongData, chain) },
    { name: 'signature byte', signature: wrongSignature },
    { name: 'chain ID', bytes: framed(data, 'qorechain-control') },
    { name: 'domain prefix', bytes: framed(data, chain, 'qorechain-control') },
    { name: 'public key', key: wrongKey },
  ];
}

export function verifyVectors(vectors, verify) {
  if (vectors.format !== 'qoresign-vectors-v1') throw new Error('Unexpected vector format');
  const { accounts, canonical, chainId, hybridTx, message, proofOfPossession, siwq } = vectors;
  const keyFor = (address) => hex(canonical.find((candidate) => candidate.address === address).publicKey);
  const checks = [];
  function run(name, key, bytes, signature, expected = true) {
    const start = performance.now();
    try {
      const valid = verify(key, bytes, signature);
      checks.push({ name, valid, expected, matches: valid === expected, ms: performance.now() - start,
        bytes: { key: key.length, message: bytes.length, signature: signature.length } });
    } catch (error) {
      checks.push({ name, expected, matches: false, error: String(error), ms: performance.now() - start });
    }
  }
  for (const test of hybridTx.cases) {
    run('hybrid ' + test.signBytesVersion, keyFor(accounts.secp256k1.address), hex(test.signBytes), hex(test.pqSignature));
  }
  run('proof of possession', keyFor(proofOfPossession.account), utf8(proofOfPossession.message), hex(proofOfPossession.signature));
  run('SIWQ', keyFor(siwq.fields.address), hex(siwq.pqSignBytes), base64(siwq.signature.pq.signature));
  const key = keyFor(message.signer);
  const wrongKey = keyFor(canonical.find((candidate) => candidate.address !== message.signer).address);
  message.cases.forEach((test, index) => {
    const data = hex(test.data);
    const bytes = framed(data, chainId);
    if (hexString(bytes) !== test.pqSignBytes) throw new Error('Published message framing mismatch at case ' + index);
    const signature = base64(test.signature.pq.signature);
    run('message ' + index, key, bytes, signature);
    for (const control of controls(data, chainId, signature, wrongKey)) {
      run('message ' + index + ' / ' + control.name, control.key ?? key,
        control.bytes ?? bytes, control.signature ?? signature, false);
    }
  });
  return checks;
}
