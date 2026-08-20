import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { WahaHistoryStore } from './wahaHistoryStore.js';

const directories: string[] = [];
const job = { id: 'job-1', accountId: 42, inboxId: 100, sessionName: 'session-a', requestedRange: '30d' as const, trackId: 'trk_test', status: 'pending' as const, processed: 0, imported: 0, duplicates: 0, skipped: 0, failed: 0, mediaImported: 0, mediaFailed: 0, conversations: 0 };
const storeAt = async () => { const directory = await mkdtemp(join(tmpdir(), 'waha-history-')); directories.push(directory); return { store: new WahaHistoryStore(join(directory, 'jobs.json')), file: join(directory, 'jobs.json') }; };
afterEach(async () => { await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true }))); });

describe('WahaHistoryStore', () => {
  it('persists progress per account/inbox and rejects a concurrent job', async () => {
    const { store, file } = await storeAt();
    await store.create(job);
    await store.addMetrics(42, 100, { processed: 2, imported: 1, duplicates: 1 });
    await expect(store.create({ ...job, id: 'job-2' })).rejects.toThrow('andamento');
    expect(await new WahaHistoryStore(file).get(42, 100, 'job-1')).toMatchObject({ processed: 2, imported: 1, duplicates: 1 });
    expect(await store.get(42, 101)).toBeUndefined();
  });

  it('serializes concurrent progress writes in the local file fallback', async () => {
    const { store, file } = await storeAt();
    await store.create(job);
    await Promise.all(Array.from({ length: 12 }, () => store.addMetrics(42, 100, { processed: 1 })));
    expect(await new WahaHistoryStore(file).get(42, 100, 'job-1')).toMatchObject({ processed: 12 });
  });
});
