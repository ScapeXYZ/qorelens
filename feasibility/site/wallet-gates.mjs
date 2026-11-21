import { diana, readDiana } from './network.mjs';
import { keyStatus, pqcVerify, rpc } from './precompiles.mjs';
import { sdkNetwork } from './sdk-network.mjs';
import { base64, framed, hex, hexString, utf8, controls } from './vector-checks.mjs';

export const message = 'QoreX gate test 1 - harmless fixed message - no authorization - testnet only';
const chain = sdkNetwork.chainId;
const evmAddress = /^0x[\da-f]{40}$/i;
const nativeAddress = /^qor1[\da-z]{38}$/;
const hash = async (data) => hexString(new Uint8Array(await crypto.subtle.digest('SHA-256', data)));

export async function runWalletGates(state, version, update) {
  const evm = window.qorex?.evm;
  const native = window.qorex?.native;
  const provider = await new Promise((resolve) => {
    const listener = (event) => {
      if (event.detail?.info?.rdns === 'network.qore.qorex' && event.detail.provider === evm) finish(true);
    };
    const timer = setTimeout(() => finish(false), 900);
    function finish(result) {
      clearTimeout(timer);
      removeEventListener('eip6963:announceProvider', listener);
      resolve(result);
    }
    addEventListener('eip6963:announceProvider', listener);
    dispatchEvent(new Event('eip6963:requestProvider'));
  });
  if (!provider || !native || window.__qorexMock) throw new Error('Real QoreX EIP-6963 provider and native bridge are required');
  state.approvals = 0;
  state.walletVersion = version;
  state.guard = { status: 'BLOCKED', mode:'N0-lite', sdk: sdkNetwork, missing: ['Public Diana EVM ID', 'Wallet EVM ID', 'Cross-lane address match'] };
  state.steps = Object.fromEntries(['S2','S3','S4','S5'].map(id=>[id,{status:'BLOCKED',error:'N0-lite prerequisites unavailable'}]));
  const step = (id,status,fields={}) => {state.steps[id]={...fields,status};update();};
  state.gates = Object.fromEntries([1,2,3,4,5,6].map((i) => ['G'+i, {status:'BLOCKED', error:'Prerequisite evidence unavailable'}]));
  const gate = (n, status, fields = {}) => { state.gates['G' + n] = {...fields, status}; update(); };

  async function ask(label, args, invoke, approval = false, signed = false) {
    if (approval && state.approvals >= 6) throw new Error('Six-approval limit reached');
    if (signed && state.guard.status !== 'PASS') throw new Error('N0 did not pass');
    if (!confirm(label + '\n' + JSON.stringify(args, null, 2))) throw new Error('User declined ' + label);
    if (approval) state.approvals++;
    const record = { label, args, utc: new Date().toISOString() };
    state.requests.push(record);
    const start = performance.now();
    try {
      return await invoke();
    } catch (error) {
      record.error = { name: error?.name, code: error?.code, message: error?.message ?? String(error) };
      throw error;
    } finally {
      record.ms = performance.now() - start;
      update();
    }
  }
  const evmCall = (method, params = [], approval = false) =>
    ask('QoreX EVM ' + method, { method, params }, () => evm.request({method, params}), approval);
  const nativeCall = (method, args, approval = false, signed = false) =>
    ask('QoreX native ' + method, args, () => native[method](...args), approval, signed);

  const publicId = await rpc('eth_chainId');
  state.endpoints = await readDiana();
  state.guard.publicEvm = publicId;
  state.guard.missing = ['Wallet EVM ID', 'Cross-lane address match'];
  if (publicId !== diana.evmId || sdkNetwork.evmChainId !== Number(publicId)
      || sdkNetwork.evmRpc !== diana.evm || sdkNetwork.chainId !== diana.cosmosId
      || sdkNetwork.rpc + '/status' !== diana.consensus
      || new URL(diana.rest).origin !== sdkNetwork.rest
      || [state.endpoints.consensus, state.endpoints.rest].some((r) => r.value && r.value !== chain)) {
    throw new Error('Public Diana and installed SDK constants disagree or are unavailable');
  }
  const walletChain = await evmCall('eth_chainId');
  state.guard.walletEvm = walletChain;
  if (walletChain !== publicId) throw new Error('Switch QoreX to Diana in the wallet UI. Wallet EVM chain ID differs.');
  const crypto = await import('./crypto-bundle.mjs');
  await evmCall('eth_requestAccounts', [], true);
  const [account] = await evmCall('eth_accounts');
  if (!evmAddress.test(account)) throw new Error('Invalid QoreX EVM account');
  const key = await nativeCall('getKey', [chain], true);
  const address = key?.bech32Address;
  if (!nativeAddress.test(address)) throw new Error('Invalid QoreX native address');
  const converted = crypto.qorAddressHex(address);
  state.addresses = {evm:account,native:address,converted};
  state.guard.nativeIdentity = {chainId:typeof native.chainId==='string'?native.chainId:null,
    getChainId:typeof native.getChainId, queryUsed:false};
  if ((state.guard.nativeIdentity.chainId && state.guard.nativeIdentity.chainId !== chain)
      || converted.toLowerCase() !== account.toLowerCase()) throw new Error('Wallet network or converted cross-lane address mismatch');
  state.guard.missing = [];
  update();

  async function recheck() {
    const publicChain = await rpc('eth_chainId');
    const latestEvm = await evmCall('eth_chainId');
    const [latestAccount] = await evmCall('eth_accounts');
    const latestKey = await nativeCall('getKey', [chain]);
    if (publicChain !== diana.evmId || latestEvm !== publicChain
        || (typeof native.chainId === 'string' && native.chainId !== chain)
        || latestKey.bech32Address !== address || latestAccount?.toLowerCase() !== account.toLowerCase()
        || crypto.qorAddressHex(latestKey.bech32Address).toLowerCase() !== account.toLowerCase()) {
      state.guard.status = 'BLOCKED';
      throw new Error('Diana network or selected account changed');
    }
  }

  const suffix = prompt('Confirm the dedicated Diana account by typing the last six characters of ' + address);
  if (suffix !== address.slice(-6)) throw new Error('Address confirmation did not match');
  state.guard.status = 'PASS';
  update();
  let first;
  try {
    if (typeof native.signArbitrary !== 'function' || native.signArbitrary.length !== 3) throw Error('Expected signArbitrary arity 3');
    await recheck();
    first = await nativeCall('signArbitrary', [chain,address,message], true, true);
    const pq = base64(first.pq.signature);
    const status = pq.length===4627 ? 'PASS' : 'FAIL';
    const info = {evidenceClass:'WALLET-REPORTED',signature:first,fields:Object.keys(first),
      pqBytes:pq.length,pqSha256:await hash(pq)};
    gate(1,status,info);
    step('S2',status,info);
  } catch (error) {
    const info = {error:String(error),installedWarning:'QoreX: signArbitrary not yet supported'};
    gate(1,'BLOCKED',info); step('S2','BLOCKED',info);
  }

  let binding;
  try {
    binding = await keyStatus(account);
    gate(3, binding.registered ? 'BLOCKED' : 'FAIL', {evidenceClass:'INDEPENDENT', binding,
      error: binding.registered ? 'Key comparison requires G2' : 'Diana EVM address has no registered PQC key'});
  } catch (error) { gate(3, 'BLOCKED', {error:String(error)}); }
  if (first?.pq?.signature && binding?.registered) {
    try {
      const fixture = await (await fetch('./public-vectors.json')).json();
      const wrongKey = fixture.canonical.map((x) => hex(x.publicKey)).find((x) => hexString(x) !== binding.publicKey.slice(2));
      const { verifyPq, verifyAdr36 } = await import('./crypto-bundle.mjs');
      const chainKey = hex(binding.publicKey.slice(2));
      const data = utf8(message);
      const bytes = framed(data, chain);
      const signature = base64(first.pq.signature);
      const cases = [{name:'valid'}, ...controls(data, chain, signature, wrongKey)];
      const measure = async (check) => {
        const results = [];
        for (const c of cases) {
          const begin = performance.now();
          try {
            results.push({name:c.name, valid:await check(c.key ?? chainKey, c.bytes ?? bytes, c.signature ?? signature), ms:performance.now()-begin});
          } catch(error) { results.push({name:c.name, error:String(error), ms:performance.now()-begin}); }
        }
        return results;
      };
      const independent = await measure(verifyPq);
      const encodings = [{name:'UTF-8', valid:independent[0].valid}];
      for (const [name, decode] of [['base64',base64],['hex',hex]]) {
        try { encodings.push({name, valid:verifyPq(chainKey, framed(decode(message), chain), signature)}); }
        catch (error) { encodings.push({name, error:String(error)}); }
      }
      let classical;
      try { classical = verifyAdr36(first.classical, address, data); }
      catch (error) { classical = {error:String(error)}; }
      const good = independent.every((c, i) => c.valid === (i === 0));
      gate(2, good ? 'PASS' : 'FAIL', {evidenceClass:'INDEPENDENT', independent,
        encodings, classical, keySha256:await hash(chainKey), scope:'Revised C1 prime live message verification', error:good ? undefined : 'Independent verification or a control did not match'});
      const supplied = first.pq.publicKey;
      const matches = supplied === undefined || hexString(base64(supplied)) === binding.publicKey.slice(2);
      gate(3, independent[0].valid && matches ? 'PASS' : 'FAIL', {evidenceClass:'INDEPENDENT', binding, matches, supplied: supplied !== undefined});
      const onChain = await measure((k,m,s) => pqcVerify('0x'+hexString(k),'0x'+hexString(s),'0x'+hexString(m)));
      gate(4, onChain.every((c,i) => c.valid === (i === 0)) ? 'PASS' : 'FAIL', {evidenceClass:'INDEPENDENT', onChain});
    } catch (error) { state.verificationError = String(error); }
  }
  try {
    if (typeof native.verifyArbitrary !== 'function' || native.verifyArbitrary.length !== 4) throw Error('Expected verifyArbitrary arity 4');
    const vectors = await (await fetch('./public-vectors.json')).json();
    const row = vectors.message.cases[0];
    const data = hex(row.data);
    const mutated = data.slice(); mutated[0] ^= 1;
    const vectorKey = hex(vectors.canonical.find(x=>x.address===vectors.message.signer).publicKey);
    const sig = base64(row.signature.pq.signature);
    const tampered = sig.slice(); tampered[0] ^= 1;
    const altered = {...row.signature,pq:{...row.signature.pq,signature:btoa(String.fromCharCode(...tampered))}};
    const checks = [];
    for (const item of [{name:'valid',data,sig,object:row.signature},
      {name:'tampered message',data:mutated,sig,object:row.signature},
      {name:'tampered signature',data,sig:tampered,object:altered}]) {
      const expected = crypto.verifyPq(vectorKey,framed(item.data,vectors.chainId),item.sig);
      try {
        const valid = await nativeCall('verifyArbitrary',[vectors.chainId,vectors.message.signer,new TextDecoder().decode(item.data),item.object]);
        checks.push({name:item.name,expected,valid});
      } catch(error) { checks.push({name:item.name,expected,error:String(error)}); }
    }
    const mismatch = checks.some(x=>typeof x.valid==='boolean'&&x.valid!==x.expected);
    const status=mismatch?'FAIL':checks.every(x=>typeof x.valid==='boolean')?'PASS':'BLOCKED';
    const info={checks,evidenceClass:'WALLET-REPORTED',comparison:mismatch?'MISMATCH':undefined};
    gate(5,status,info);step('S3',status,info);
  } catch(error) {const info={error:String(error)};gate(5,'BLOCKED',info);step('S3','BLOCKED',info);}
  try {
    if (typeof native.signDirect!=='function' || native.signDirect.length!==2) throw Error('Expected signDirect arity 2');
    const doc = crypto.makeDirectDoc(address,key.pubKey);
    await recheck();
    const response = await nativeCall('signDirect',[address,doc],true,true);
    const chainKey = binding?.registered && binding.algorithmId===1 ? hex(binding.publicKey.slice(2)) : null;
    const checked = crypto.inspectDirect(response,doc,key.pubKey,chainKey);
    const info={response,verified:checked,evidenceClass:checked.pq===true?'INDEPENDENT':'WALLET-REPORTED',broadcast:false};
    step('S4',checked.classical && checked.pq===true?'PASS':'FAIL',info);
    if (checked.pq === true) {
      gate(3,'PASS',{binding,evidenceClass:'INDEPENDENT',matchedBy:'S4',keySha256:await hash(chainKey)});
    }
  } catch(error) { step('S4','BLOCKED',{error:String(error),broadcast:false}); }


  try {
    if (!native.capabilities?.includes('signAndBroadcast') || typeof native.signAndBroadcast !== 'function') {
      throw new Error('QoreX signAndBroadcast capability unavailable');
    }
    const gas = 400000;
    const minimumUqor = 60001n;
    const snapshot = async () => {
      const [nonce, balance] = await Promise.all([rpc('eth_getTransactionCount',[account,'latest']),rpc('eth_getBalance',[account,'latest'])]);
      return {nonce, balance};
    };
    const { encodeSelfTransfer } = await import('./crypto-bundle.mjs');
    const req = {chainId:chain,messages:[encodeSelfTransfer(address)],memo:'qorelens-gate-g6',gasLimit:gas};
    await recheck();
    const before = await snapshot();
    if (BigInt(before.balance) < minimumUqor * 1000000000000n) throw Error('Unified Diana balance below 60001 uqor reserve');
    const result = await nativeCall('signAndBroadcast', [req], true, true);
    const sent = {result, before, observation:'not observed on Diana', hybrid:'Inferred from the chain rule for PQC-registered accounts; transaction signature layer was not inspected.'};
    if (/^(0x)?[0-9a-f]{64}$/i.test(result?.txHash)) sent.explorer = 'https://dashboard.qorechain.io/explorer/tx/' + result.txHash;
    gate(6, result?.code === 0 ? 'BLOCKED' : 'FAIL', {...sent, evidenceClass:'WALLET-REPORTED'});
    if (result?.code !== 0) return;
    const start = performance.now();
    while (performance.now() - start < 48000) {
      const after = await snapshot();
      const changed = BigInt(after.nonce) > BigInt(before.nonce) && BigInt(after.balance) < BigInt(before.balance);
      gate(6, changed ? 'PASS' : 'BLOCKED', {...sent, observation:changed?'observed on Diana':'not observed on Diana', after, ms:performance.now()-start,
        evidenceClass:changed ? 'CHAIN-OBSERVED' : 'WALLET-REPORTED'});
      if (changed) break;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  } catch (error) {
    const observed = state.gates.G6;
    gate(6, 'BLOCKED', {...observed, error:String(error)});
  } finally {
    state.steps.S5=state.gates.G6;
    update();
  }
}
