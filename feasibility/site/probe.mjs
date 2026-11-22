import { readDiana } from './network.mjs';
import { keyStatus } from './precompiles.mjs';
import { message, runWalletGates } from './wallet-gates.mjs';
import { sdkNetwork } from './sdk-network.mjs';

const byId = (id) => document.getElementById(id);
const storageName = 'QoreLens lane session';
const state = { origin: location.origin, browser: navigator.userAgent, requests: [], history: [],
  guard: { status: 'BLOCKED', sdk: sdkNetwork,
    missing: ['Public Diana EVM ID', 'Wallet EVM ID', 'Native signer derivation'] } };
try {
  const prior = JSON.parse(sessionStorage.getItem(storageName));
  if (prior?.origin === location.origin && Array.isArray(prior.history) && Array.isArray(prior.requests)) {
    Object.assign(state, prior);
    state.guard = {...prior.guard, status: 'BLOCKED', sdk: sdkNetwork,
      reason: 'Stored results are historical. A page reload does not carry a live network guard.'};
  }
} catch { /* Evidence export remains available when session storage is unavailable. */ }
const json = (value) => JSON.stringify(value, (_, item) => typeof item === 'bigint' ? item.toString() : item, 2);
const copy = (value) => JSON.parse(json(value));
function render() {
  const output = json(state);
  try { sessionStorage.setItem(storageName, output); } catch { /* Use Download after the run. */ }
  byId('results').textContent = output;
}

function introspect() {
  const wallet = window.qorex;
  const names = ['signArbitrary', 'verifyArbitrary', 'signDirect', 'signAndBroadcast',
    'getKey', 'getChainId', 'enable', 'eth_sendTransaction', 'wallet_sendCalls'];
  const methods = Object.fromEntries(names.map((name) => {
    const provider = name.startsWith('eth_') || name.startsWith('wallet_') ? wallet?.evm : wallet?.native;
    const value = provider?.[name];
    return [name, typeof value === 'function'
      ? { type: 'function', arity: value.length, source: Function.prototype.toString.call(value) }
      : { type: typeof value }];
  }), () => new Promise((resolve) => {
    const selection = byId('selection');
    selection.hidden = false;
    selection.disabled = false;
    selection.onclick = () => {selection.hidden = true;selection.disabled = true;selection.onclick = null;resolve();};
  }));
  return { detected: Boolean(wallet), mockDetected: Boolean(window.__qorexMock),
    version: typeof wallet?.version === 'string' ? wallet.version : byId('version').value.trim() || null,
    nativeIdentity: {
      chainId: typeof wallet?.native?.chainId === 'string' ? wallet.native.chainId : null,
      capabilities: Array.isArray(wallet?.native?.capabilities)
        ? wallet.native.capabilities.filter((item) => typeof item === 'string') : [],
    },
    methods, notExercised: ['eth_sendTransaction', 'wallet_sendCalls', 'signDirect', 'personal_sign'] };
}

let running = false;
async function run(action, button) {
  if (running) return;
  running = true;
  const buttons = [...document.querySelectorAll('button')];
  buttons.forEach((item) => { item.disabled = true; });
  const entry = { action: button.id, utc: new Date().toISOString() };
  try {
    const result = await action();
    if (result !== undefined) entry.result = copy(result);
  } catch (error) {
    entry.error = String(error);
  } finally {
    running = false;
    state.history.push(entry);
    buttons.forEach((item) => { item.disabled = false; });
    render();
  }
}

byId('probe').onclick = () => run(async () => {
  state.wallet = introspect();
  state.endpoints = await readDiana();
  if (!state.guidedAttempted) {
    state.guard.publicEvm = state.endpoints.evm.value ?? null;
    state.guard.missing = ['Wallet EVM ID', 'Native signer derivation'];
    if (!state.guard.publicEvm) state.guard.missing.unshift('Public Diana EVM ID');
  }
  return { wallet: state.wallet, endpoints: state.endpoints };
}, byId('probe'));

byId('guided').onclick = () => run(async () => {
  if (state.guidedAttempted) throw new Error('The guided session was already attempted in this page');
  if (location.protocol !== 'https:' && location.origin !== 'http://localhost:4398') throw new Error('Use the deployed HTTPS origin or localhost');
  state.wallet = introspect();
  if (!state.wallet.version) throw new Error('Enter the QoreX version displayed in the extension');
  state.guidedAttempted = true;
  render();
  try { await runWalletGates(state, state.wallet.version, render, () => new Promise((resolve) => {
    const retry = byId('retry');
    retry.hidden = false;
    retry.disabled = false;
    retry.onclick = () => {retry.hidden = true;retry.disabled = true;retry.onclick = null;resolve();};
  })); }
  finally { state.guidedResult = copy({guard: state.guard, gates: state.gates ?? {}, steps: state.steps ?? {}, laneIdentity: state.laneIdentity, approvals: state.approvals ?? 0}); }
  return state.guidedResult;
}, byId('guided'));

byId('registry').onclick = () => run(async () => {
  const account = byId('account').value.trim();
  const wrapper = byId('wrapper').value.trim();
  const start = performance.now();
  state.registry = { account, wrapper: wrapper || null, result: await keyStatus(account, wrapper || undefined),
    ms: performance.now() - start };
  return state.registry;
}, byId('registry'));

byId('benchmark').onclick = () => run(async () => {
  const start = performance.now();
  const { browserVectors } = await import('./crypto-bundle.mjs');
  const loadMs = performance.now() - start;
  state.vectorBenchmark = { loadMs, ...await browserVectors(),
    scope: 'Public PQ vectors, including controls. This does not prove verification of a real QoreX signature.' };
  return state.vectorBenchmark;
}, byId('benchmark'));

function serialize() {
  state.utc = new Date().toISOString();
  state.wallet ??= introspect();
  state.fixedMessage = message;
  return json(state);
}

byId('save').onclick = () => run(async () => {
  if (location.origin !== 'http://localhost:4398') throw new Error('Use Download on the hosted origin.');
  const response = await fetch('/results', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: serialize() });
  if (!response.ok) throw new Error('Collector HTTP ' + response.status + '. Use Download.');
  state.saved = await response.json();
  return state.saved;
}, byId('save'));

byId('download').onclick = () => {
  const target = URL.createObjectURL(new Blob([serialize()], {type: 'application/json'}));
  const link = document.createElement('a');
  link.href = target;
  link.download = 'runner-results.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(target), 1000);
};
render();
