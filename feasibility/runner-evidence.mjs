import { constants } from 'node:fs';
import { copyFile, mkdir, rename, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

export async function saveRunnerEvidence(directory, data) {
  const latest = new URL('runner-results.json', directory);
  const snapshots = new URL('runner-snapshots/', directory);
  await mkdir(snapshots, { recursive: true });
  try {
    await copyFile(latest, new URL('prior-latest.json', snapshots), constants.COPYFILE_EXCL);
  } catch (error) {
    if (!['ENOENT', 'EEXIST'].includes(error.code)) throw error;
  }
  const stamp = new Date().toISOString().replaceAll(':', '-');
  const name = stamp + '-' + randomUUID() + '.json';
  const snapshot = new URL(name, snapshots);
  await writeFile(snapshot, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
  const staged = new URL(name + '.tmp', snapshots);
  await copyFile(snapshot, staged, constants.COPYFILE_EXCL);
  await rename(staged, latest);
  return { latest: 'runner-results.json', snapshot: 'runner-snapshots/' + name };
}
