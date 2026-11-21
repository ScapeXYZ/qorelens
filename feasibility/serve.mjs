import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { saveRunnerEvidence } from './runner-evidence.mjs';

const port = 4398;
const origin = 'http://localhost:' + port;
const assets = new Map([['/', ['index.html', 'text/html']], ['/probe.css', ['probe.css', 'text/css']],
  ['/probe.mjs', ['probe.mjs', 'text/javascript']], ['/network.mjs', ['network.mjs', 'text/javascript']], ['/precompiles.mjs', ['precompiles.mjs', 'text/javascript']]]);
assets.set('/crypto-bundle.mjs', ['crypto-bundle.mjs', 'text/javascript']);
assets.set('/public-vectors.json', ['public-vectors.json', 'application/json']);
for (const name of ['sdk-network.mjs', 'wallet-gates.mjs', 'vector-checks.mjs']) assets.set('/' + name, [name, 'text/javascript']);
const results = new URL('./evidence/', import.meta.url);
let saveQueue = Promise.resolve();

const server = createServer(async (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  if (request.headers.host !== 'localhost:' + port) {
    response.writeHead(403).end();
    return;
  }
  try {
    if (request.method === 'POST' && request.url === '/results') {
      if (request.headers.origin !== origin || request.headers['content-type'] !== 'application/json') {
        response.writeHead(403).end();
        return;
      }
      const chunks = [];
      let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > 1024 * 1024) {
          response.writeHead(413).end();
          return;
        }
        chunks.push(chunk);
      }
      const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (data.origin !== origin || typeof data.utc !== 'string') {
        response.writeHead(400).end();
        return;
      }
      const saved = saveQueue.then(() => saveRunnerEvidence(results, data));
      saveQueue = saved.catch(() => {});
      const paths = await saved;
      response.writeHead(201, {'Content-Type':'application/json'}).end(JSON.stringify(paths));
      return;
    }
    const asset = assets.get(request.url);
    if (request.method !== 'GET' || !asset) {
      response.writeHead(404).end();
      return;
    }
    const [name, type] = asset;
    const contents = await readFile(new URL('./site/' + name, import.meta.url));
    response.writeHead(200, { 'Content-Type': type + '; charset=utf-8' }).end(contents);
  } catch (error) {
    response.writeHead(error.code === 'EEXIST' ? 409 : error instanceof SyntaxError ? 400 : error.code === 'ENOENT' ? 404 : 500).end();
  }
});
server.listen(port, '127.0.0.1', () => console.log(origin));
