import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const url = (relative) => new URL(relative, import.meta.url);
await build({ entryPoints: [fileURLToPath(url('./browser-crypto.mjs'))],
  bundle: true, platform: 'browser', format: 'esm', minify: true,
  outfile: fileURLToPath(url('../site/crypto-bundle.mjs')) });
const raw = await readFile(url('../evidence/qoresign-v1.json'));
if (createHash('sha256').update(raw).digest('hex') !== 'bf920288d234204bb77c51b59aec0b3a6c9ce5735cef247a18629b4912186f7c') {
  throw new Error('Vector input differs from the independently verified file');
}
const v = JSON.parse(raw.toString('utf8'));
if (v.format !== 'qoresign-vectors-v1') throw new Error('Unexpected vector format');
const projection = {
  format: v.format, chainId: v.chainId, accounts: {secp256k1: {address: v.accounts.secp256k1.address}},
  canonical: v.canonical.map(({address, publicKey}) => ({address, publicKey})),
  hybridTx: { cases: v.hybridTx.cases.map(({signBytesVersion, signBytes, pqSignature}) => ({signBytesVersion, signBytes, pqSignature})) },
  proofOfPossession: v.proofOfPossession, message: v.message, siwq: v.siwq,
};
await writeFile(url('../site/public-vectors.json'), JSON.stringify(projection) + '\n');
