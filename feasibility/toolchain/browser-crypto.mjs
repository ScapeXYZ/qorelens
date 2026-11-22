import { ripemd160 } from '@noble/hashes/legacy.js';
import { keccak_256 } from '@noble/hashes/sha3.js';
import { bech32 } from '@scure/base';
import { TxBody, AuthInfo, SignDoc } from 'cosmjs-types/cosmos/tx/v1beta1/tx';
import { PubKey } from 'cosmjs-types/cosmos/crypto/secp256k1/keys';
import { BinaryReader } from 'cosmjs-types/binary';
import { ml_dsa87 } from '@noble/post-quantum/ml-dsa.js';
import { secp256k1 } from '@noble/curves/secp256k1.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { MsgSend } from 'cosmjs-types/cosmos/bank/v1beta1/tx';
import { verifyVectors, utf8, base64, hexString } from '../site/vector-checks.mjs';

export const verifyPq = (key, bytes, signature) =>
  ml_dsa87.verify(signature, bytes, key, { context: new Uint8Array() });

export async function browserVectors() {
  const fixtureResponse = await fetch(new URL('./public-vectors.json', import.meta.url));
  if (!fixtureResponse.ok) throw new Error('Public vectors HTTP ' + fixtureResponse.status);
  const vectors = await fixtureResponse.json();
  const cold = verifyVectors(vectors, verifyPq);
  const warm = verifyVectors(vectors, verifyPq);
  const response = await fetch(import.meta.url);
  if (!response.ok) throw new Error('Verifier bundle HTTP ' + response.status);
  return { cold, warm, bundleBytes: (await response.arrayBuffer()).byteLength };
}

const encodeBase64 = (bytes) => btoa(String.fromCharCode(...bytes));

export function encodeSelfTransfer(address) {
  const value = MsgSend.fromPartial({fromAddress:address,toAddress:address,amount:[{denom:'uqor',amount:'1'}]});
  return {typeUrl:'/cosmos.bank.v1beta1.MsgSend',value:encodeBase64(MsgSend.encode(value).finish())};
}

export function verifyAdr36(component, signer, data) {
  if (component?.keyType !== 'secp256k1') throw new Error('Unsupported ADR-36 classical key type');
  const signDoc = {account_number:'0',chain_id:'',fee:{amount:[],gas:'0'},memo:'',
    msgs:[{type:'sign/MsgSignData',value:{data:encodeBase64(data),signer}}],sequence:'0'};
  return {valid:secp256k1.verify(base64(component.signature), sha256(utf8(JSON.stringify(signDoc))),
    base64(component.publicKey), {prehash:false})};
}

const directChain = 'qorelens-gate-0';
const hybridType = '/qorechain.pqc.v1.PQCHybridSignature';
export function qorAddressHex(address) {
  const decoded = bech32.decode(address);
  const bytes = bech32.fromWords(decoded.words);
  if (decoded.prefix !== 'qor' || bytes.length !== 20) throw new Error('Invalid QoreChain native address');
  return '0x' + hexString(bytes);
}

export function makeDirectDoc(address, publicKey) {
  const bytes = Uint8Array.from(publicKey);
  if (bytes.length !== 33) throw new Error('Expected a compressed secp256k1 public key');
  const transfer = encodeSelfTransfer(address);
  const bodyBytes = TxBody.encode(TxBody.fromPartial({memo:'qorelens-gate-s4',
    messages:[{typeUrl:transfer.typeUrl,value:base64(transfer.value)}]})).finish();
  const authInfoBytes = AuthInfo.encode(AuthInfo.fromPartial({signerInfos:[{sequence:0n,
    modeInfo:{single:{mode:1}},publicKey:{typeUrl:'/cosmos.crypto.secp256k1.PubKey',value:PubKey.encode({key:bytes}).finish()}}],
    fee:{amount:[],gasLimit:0n}})).finish();
  return {bodyBytes:Array.from(bodyBytes),authInfoBytes:Array.from(authInfoBytes),chainId:directChain,accountNumber:'0'};
}

function bigEndian(value, width) {
  const out = new Uint8Array(width);
  for (let i=width-1, n=BigInt(value); i>=0; i--, n>>=8n) out[i]=Number(n&255n);
  return out;
}

function joined(parts) {
  const result = new Uint8Array(parts.reduce((n,a)=>n+a.length,0));
  let offset=0;
  for (const part of parts) {result.set(part,offset); offset+=part.length;}
  return result;
}

export function inspectDirect(result, request, walletKey, chainKey) {
  const signed = result?.signed;
  if (signed?.chainId !== directChain || String(signed.accountNumber) !== '0') {
    throw new Error('Returned SignDoc changed the sign-only chain ID or account number');
  }
  const bodyBytes = Uint8Array.from(signed.bodyBytes);
  const authInfoBytes = Uint8Array.from(signed.authInfoBytes);
  const signature = result.signature;
  const pub = base64(signature.pub_key.value);
  const classical = hexString(pub) === hexString(Uint8Array.from(walletKey)) &&
    secp256k1.verify(base64(signature.signature), sha256(SignDoc.encode({chainId:directChain,
      bodyBytes,authInfoBytes,accountNumber:0n}).finish()), pub, {prehash:false});
  const body = TxBody.decode(bodyBytes);
  const ext = [...body.extensionOptions, ...body.nonCriticalExtensionOptions].filter(x=>x.typeUrl===hybridType);
  if (!ext.length) return {classical,pq:false,note:'Returned SignDoc has no PQ extension'};
  if (!chainKey || ext.length !== 1) return {classical,pq:null,note:'Registered key or unique PQ extension unavailable'};
  body.extensionOptions = body.extensionOptions.filter(x=>x.typeUrl!==hybridType);
  body.nonCriticalExtensionOptions = body.nonCriticalExtensionOptions.filter(x=>x.typeUrl!==hybridType);
  const unsigned = TxBody.encode(body).finish();
  if (hexString(unsigned) !== hexString(Uint8Array.from(request.bodyBytes))) throw new Error('Returned SignDoc changed the transaction body');
  if (AuthInfo.decode(authInfoBytes).signerInfos.some(s=>s.sequence!==0n)) throw new Error('Returned SignDoc changed sequence zero');
  const r = new BinaryReader(ext[0].value);
  let algorithm = 0, pqSig, supplied;
  while (r.pos < r.len) {
    const tag=r.uint32();
    if (tag===8) algorithm=r.uint32();
    else if (tag===18) pqSig=r.bytes();
    else if (tag===26) supplied=r.bytes();
    else r.skipType(tag&7);
  }
  if (algorithm !== 1 || pqSig?.length !== 4627) return {classical,pq:false,note:'Malformed ML-DSA-87 extension'};
  const sameKey = !supplied?.length || hexString(supplied)===hexString(chainKey);
  const framed = joined([bigEndian(unsigned.length,4),unsigned,bigEndian(authInfoBytes.length,4),authInfoBytes]);
  const cid=utf8(directChain);
  const v2=joined([utf8('qorechain-pqc-hybrid-v2'),bigEndian(cid.length,8),cid,framed]);
  const verifiedV2=verifyPq(chainKey,v2,pqSig);
  const verifiedV1=verifyPq(chainKey,framed,pqSig);
  return {classical,pq:sameKey&&(verifiedV2||verifiedV1),sameKey,verifiedV2,verifiedV1,
    signatureBytes:pqSig.length,keyBytes:chainKey.length};
}

export function classifyLaneIdentity(key, evmAccount) {
  const c = qorAddressHex(key.bech32Address);
  const d = evmAccount.toLowerCase();
  const pk = typeof key.pubKey === 'string' ? base64(key.pubKey) : Uint8Array.from(key.pubKey ?? []);
  if (pk.length !== 33 || ![2,3].includes(pk[0])) throw Error('Native getKey did not provide a compressed secp256k1 public key');
  const point = secp256k1.Point.fromHex(hexString(pk));
  const a = '0x'+hexString(ripemd160(sha256(pk)));
  const b = '0x'+hexString(keccak_256(point.toBytes(false).slice(1)).slice(-20));
  const scheme = c===a ? 'HASH160' : c===b ? 'KECCAK256' : null;
  const classification = !scheme ? 'UNRESOLVED' : c===d ? 'SAME_ACCOUNT' :
    scheme==='HASH160' ? 'DISTINCT_BY_DERIVATION' : 'ACCOUNT_SELECTION_MISMATCH';
  const nativeKey = {algo:key.algo, pubKey:Array.from(pk), address:key.address, bech32Address:key.bech32Address};
  for (const [name,value] of Object.entries(key)) {
    if (/eth|evm/i.test(name) && typeof value==='string' && /^(0x)?[0-9a-f]{40}$/i.test(value)) nativeKey[name]=value;
  }
  return {classification,scheme,a,b,c,d,addressesEqual:c===d,nativeKey,evidenceClass:'INDEPENDENT',inputsClass:'WALLET-REPORTED'};
}
