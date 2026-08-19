import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { MetaHistoryStore } from './metaHistoryStore';

const paths: string[] = [];
afterEach(async () => { await Promise.all(paths.splice(0).map(path => rm(path, { recursive: true, force: true }))); });

describe('MetaHistoryStore', () => {
  it('faz staging idempotente por meta:<wamid>, sem criar mensagens Chatwoot', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'meta-history-')); paths.push(directory);
    const store = new MetaHistoryStore(join(directory, 'history.json'));
    const batch = { phoneNumberId: 'phone-1', phase: 1, chunkOrder: 1, progress: 10, messages: [{ sourceId: 'meta:wamid.1', messageId: 'wamid.1', threadId: '5511', from: '5511', to: null, direction: 'incoming' as const, timestamp: 1710000000, type: 'text', content: 'Privado', historyStatus: 'READ' }] };
    await expect(store.stage(10, batch)).resolves.toEqual({ added: 1 });
    await expect(store.stage(10, batch)).resolves.toEqual({ added: 0 });
    await expect(store.has(10, 'meta:wamid.1')).resolves.toBe(true);
  });

  it('claims, completes and retries staged messages without losing their identity', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'meta-history-store-')); paths.push(directory);
    const store = new MetaHistoryStore(join(directory, 'history.json'));
    await store.stage(7, { phoneNumberId: 'phone-id', phase: 1, chunkOrder: 1, progress: 50, messages: [{
      sourceId: 'meta:wamid-1', messageId: 'wamid-1', threadId: 'thread-1', from: '5511999999999', to: null,
      direction: 'incoming', timestamp: 1_700_000_000, type: 'text', content: 'Olá', historyStatus: null,
    }] });

    expect((await store.claim(7, 10)).map(message => message.sourceId)).toEqual(['meta:wamid-1']);
    await store.complete(7, 'meta:wamid-1');
    expect(await store.summary(7)).toEqual({ pending: 0, processing: 0, imported: 1, failed: 0 });
    await store.fail(7, 'meta:wamid-1', 'temporary');
    await store.retryFailed(7);
    expect(await store.summary(7)).toEqual({ pending: 1, processing: 0, imported: 0, failed: 0 });
  });
});
