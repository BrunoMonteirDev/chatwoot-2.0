import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { WahaSessionOwnershipError, WahaSessionStore } from './wahaSessionStore.js';

const directories: string[] = [];
const storeAt = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'waha-ownership-')); directories.push(directory);
  return { store: new WahaSessionStore(join(directory, 'sessions.json')), file: join(directory, 'sessions.json') };
};
afterEach(async () => { await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true }))); });

describe('WahaSessionStore', () => {
  it('persists a session exclusively for its account and inbox', async () => {
    const { store, file } = await storeAt();
    await store.reserve({ accountId: 42, inboxId: 100, sessionName: 'session-a', engine: 'GOWS' });
    expect((await store.list(42, 100)).map(item => item.sessionName)).toEqual(['session-a']);
    expect(await store.list(42, 101)).toEqual([]);
    await expect(store.assertOwned(42, 101, 'session-a')).rejects.toMatchObject({ code: 'forbidden' });
    expect((await new WahaSessionStore(file).assertOwned(42, 100, 'session-a')).engine).toBe('GOWS');
  });

  it('rejects cross-account and same-account cross-inbox takeover', async () => {
    const { store } = await storeAt();
    await store.reserve({ accountId: 42, inboxId: 100, sessionName: 'session-a' });
    await expect(store.reserve({ accountId: 43, inboxId: 200, sessionName: 'session-a' })).rejects.toBeInstanceOf(WahaSessionOwnershipError);
    await expect(store.reserve({ accountId: 42, inboxId: 101, sessionName: 'session-a' })).rejects.toMatchObject({ code: 'conflict' });
  });

  it('serializes concurrent claims so only one inbox owns a session', async () => {
    const { store } = await storeAt();
    const result = await Promise.allSettled([
      store.reserve({ accountId: 42, inboxId: 100, sessionName: 'race' }),
      store.reserve({ accountId: 42, inboxId: 101, sessionName: 'race' }),
    ]);
    expect(result.filter(item => item.status === 'fulfilled')).toHaveLength(1);
    expect((await store.get('race'))?.inboxId).toBe(100);
  });
});
