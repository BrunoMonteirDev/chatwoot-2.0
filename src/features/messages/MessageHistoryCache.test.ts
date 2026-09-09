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

  it('não degrada o Contact participante quando o refresh traz o sender do grupo', () => {
    const cache = new MessageHistoryCache();
    const attributes = { whatsapp_remote_jid: '120363@g.us', whatsapp_participant_jid: '123@lid', whatsapp_participant_phone: '+5544988687221' };
    cache.set(1, 1, page(message(20, { senderId: 91, senderName: 'Ricardo', senderPhoneNumber: '+5544988687221', senderAvatarUrl: 'ricardo.jpg', contentAttributes: attributes })));
    cache.set(1, 1, page(message(20, { senderId: 65, senderName: 'Equipe', senderPhoneNumber: null, contentAttributes: attributes })), { preserveExisting: true });
    expect(cache.get(1, 1)?.messages[0]).toMatchObject({ senderId: 91, senderName: 'Ricardo', senderPhoneNumber: '+5544988687221', senderAvatarUrl: 'ricardo.jpg' });
  });

  it('enriquece mensagem histórica sem sender e não cria duplicata', () => {
    const cache = new MessageHistoryCache();
    cache.set(1, 1, page(message(20, { sourceId: 'waha:same' })));
    cache.set(1, 1, page(message(99, { sourceId: 'waha:same', senderId: 91, senderName: 'Ricardo', senderPhoneNumber: '+5544988687221' })), { preserveExisting: true });
    expect(cache.get(1, 1)?.messages).toHaveLength(1);
    expect(cache.get(1, 1)?.messages[0]).toMatchObject({ id: 99, senderId: 91, senderName: 'Ricardo' });
  });

  it('reconcilia pelo source_id quando REST e realtime têm ids locais diferentes', () => {
    const cache = new MessageHistoryCache();
    cache.set(1, 1, page(message(20, { sourceId: 'wamid.same', content: 'realtime' })));
    cache.set(1, 1, page(message(99, { sourceId: 'wamid.same', content: 'rest' })), { preserveExisting: true });
    expect(cache.get(1, 1)?.messages).toHaveLength(1);
    expect(cache.get(1, 1)?.messages[0]).toMatchObject({ id: 99, sourceId: 'wamid.same' });
  });

  it('isola respostas fora de ordem pela conta e conversa', async () => {
    const cache = new MessageHistoryCache();
    let resolveA!: (value: ReturnType<typeof page>) => void;
    let resolveB!: (value: ReturnType<typeof page>) => void;
    const a = cache.request(1, 10, () => new Promise((resolve) => { resolveA = resolve; }));
    const b = cache.request(1, 20, () => new Promise((resolve) => { resolveB = resolve; }));
    resolveB(page(message(20, { conversationId: 20 })));
    cache.set(1, 20, await b);
    resolveA(page(message(10, { conversationId: 10 })));
    cache.set(1, 10, await a);
    expect(cache.get(1, 10)?.messages.map(item => item.conversationId)).toEqual([10]);
    expect(cache.get(1, 20)?.messages.map(item => item.conversationId)).toEqual([20]);
  });

  it('mantém no cache mutações locais e remoções ao sair e voltar', () => {
    const cache = new MessageHistoryCache();
    cache.set(1, 1, page(message(1)));
    cache.upsertIfPresent(1, message(2, { status: 'sending' }));
    cache.removeMessage(1, 1, 1);
    expect(cache.get(1, 1)?.messages).toEqual([message(2, { status: 'sending' })]);
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
