import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { parseEnv } from 'node:util';

const git = (...args) => execFileSync('git', args, { stdio: ['ignore','pipe','ignore'], maxBuffer: 64 * 1024 * 1024 });
try {
  git('check-ignore', '-v', '--', '.env.local');
  const secrets = [...new Set(Object.values(parseEnv(readFileSync('.env.local','utf8'))).filter(Boolean))].map(x => Buffer.from(x));
  if (!secrets.length) throw Error();
  const count = (buffers) => buffers.filter((data) => secrets.some((secret) => data.includes(secret))).length;
  const split = (buffer) => buffer.toString('utf8').split('\0').filter(Boolean);
  const index = split(git('ls-files','--stage','-z'));
  const tracked = [...new Set(index.map((row) => row.slice(row.indexOf('\t') + 1)))];
  const workingFiles = tracked.flatMap(name => {
    try { return [readFileSync(name)]; }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  });
  const stagedObjects = [...new Set(index.map((row) => row.split(' ', 3)[1]))];
  const history = [...new Set(git('rev-list','--all','--reflog','--objects','--no-object-names').toString().trim().split(/\s+/).filter(Boolean))];
  const countObjects = (ids) => count(ids.map(id => git('cat-file','-p',id)));
  const result = {ignored:1,literalValues:secrets.length,trackedFileHits:count(workingFiles),
    stagedObjectHits:countObjects(stagedObjects),historyObjectHits:countObjects(history)};
  console.log(JSON.stringify(result));
  if (result.trackedFileHits || result.stagedObjectHits || result.historyObjectHits) process.exitCode=2;
} catch {
  console.error('Literal secret scan could not complete.');
  process.exitCode=1;
}
