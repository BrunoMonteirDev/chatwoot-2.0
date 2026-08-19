import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PersistentDedupStore } from './dedupStore';

const directories: string[] = [];
afterEach(async () => Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true }))));

describe('PersistentDedupStore', () => {
  it('bloqueia o mesmo ID de mídia enquanto baixa e depois de confirmar a entrega', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'evolution-dedup-'));
    directories.push(directory);
    const store = new PersistentDedupStore(join(directory, 'media.json'));
    expect(await store.hasOrLock('cw-1:media-42')).toBe(false);
    expect(await store.hasOrLock('cw-1:media-42')).toBe(true);
    await store.commit('cw-1:media-42');
    expect(await store.hasOrLock('cw-1:media-42')).toBe(true);
  });
});
