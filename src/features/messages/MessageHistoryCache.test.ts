import { describe, expect, it, vi } from 'vitest';
import type { ConversationMessage } from '../../domain/currentUser';
import { MessageHistoryCache, MessageHistoryPrefetcher } from './MessageHistoryCache';

const message = (id: number, overrides: Partial<ConversationMessage> = {}): ConversationMessage => ({
  id, conversationId: 1, kind: 'incoming', contentType: 'text', content: String(id), createdAt: id,
  updatedAt: null, status: 'sent', senderName: null, senderEmail: null, senderAvatarUrl: null, origin: null, attachments: [], contentAttributes: {}, ...overrides,
});
const page = (...messages: ConversationMessage[]) => ({ messages, hasOlderMessages: false });

describe('MessageHistoryCache', () => {
  it('diferencia cache hit/miss e expira o TTL sem apagar o histórico', () => {
    let now = 0;
    const cache = new MessageHistoryCache(12, 30_000, () => now);
    expect(cache.get(1, 1)).toBeNull();
    cache.set(1, 1, page(message(1)));
    expect(cache.get(1, 1)).toMatchObject({ messages: [message(1)], isFresh: true });
    now = 30_001;
    expect(cache.get(1, 1)).toMatchObject({ isFresh: false });
  });

  it('remove a conversa menos recentemente usada (LRU)', () => {
    const cache = new MessageHistoryCache(2);
    cache.set(1, 1, page(message(1)));
    cache.set(1, 2, page(message(2, { conversationId: 2 })));
    cache.get(1, 1);
    cache.set(1, 3, page(message(3, { conversationId: 3 })));
    expect(cache.has(1, 1)).toBe(true);
    expect(cache.has(1, 2)).toBe(false);
  });

  it('deduplica a request e permite abortar o consumidor', async () => {
    const cache = new MessageHistoryCache();
    let resolve!: (value: ReturnType<typeof page>) => void;
    const fetcher = vi.fn(() => new Promise<ReturnType<typeof page>>((done) => { resolve = done; }));
    const abort = new AbortController();
    const first = cache.request(1, 1, fetcher);
    const cancelled = cache.request(1, 1, fetcher, abort.signal);
    abort.abort();
    await expect(cancelled).rejects.toMatchObject({ name: 'AbortError' });
    resolve(page(message(1)));
    await first;
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('preserva realtime durante SWR e une paginação sem duplicatas', () => {
    const cache = new MessageHistoryCache();
    cache.set(1, 1, page(message(20)));
    cache.upsertIfPresent(1, message(21)); // conversa inativa já cacheada
    cache.set(1, 1, page(message(20, { content: 'servidor' })), { preserveExisting: true });
    cache.set(1, 1, page(message(10), message(20)), { prepend: true });
    expect(cache.get(1, 1)?.messages.map((item) => item.id)).toEqual([10, 20, 21]);
    expect(cache.upsertIfPresent(1, message(1, { conversationId: 99 }))).toBe(false);
  });

  it('guarda e recupera a posição de scroll por conversa', () => {
    const cache = new MessageHistoryCache();
    cache.set(1, 1, page(message(1)));
    cache.setScroll(1, 1, 328);
    expect(cache.get(1, 1)?.scrollTop).toBe(328);
  });
});

describe('MessageHistoryPrefetcher', () => {
  it('prefetch usa no máximo duas requests simultâneas e não agenda duplicata', async () => {
    vi.useFakeTimers();
    const prefetcher = new MessageHistoryPrefetcher(2);
    let active = 0; let max = 0; let completed = 0;
    const task = async () => { active += 1; max = Math.max(max, active); await new Promise<void>((done) => setTimeout(done, 20)); active -= 1; completed += 1; };
    prefetcher.enqueue('a', task);
    prefetcher.enqueue('a', task);
    prefetcher.enqueue('b', task);
    prefetcher.enqueue('c', task);
    await vi.runAllTimersAsync();
    expect(max).toBe(2);
    expect(completed).toBe(3);
    vi.useRealTimers();
  });
});
