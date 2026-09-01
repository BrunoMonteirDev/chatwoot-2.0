import type { ConversationMessage } from '../../domain/currentUser';
import type { MessageHistoryPage } from '../../integrations/chatwoot/messages';

export const MESSAGE_HISTORY_TTL_MS = 30_000;
export const MESSAGE_HISTORY_MAX_CONVERSATIONS = 12;

export const mergeMessage = (current: ConversationMessage[], incoming: ConversationMessage): ConversationMessage[] => {
  const index = current.findIndex((message) => message.id === incoming.id || Boolean(incoming.echoId && message.echoId === incoming.echoId));
  if (index >= 0) {
    if (current[index].updatedAt && incoming.updatedAt && current[index].updatedAt > incoming.updatedAt) return current;
    const next = [...current];
    next[index] = incoming;
    return next.sort((a, b) => a.createdAt - b.createdAt || a.id - b.id);
  }
  return [...current, incoming].sort((a, b) => a.createdAt - b.createdAt || a.id - b.id);
};

export interface CachedMessageHistory {
  messages: ConversationMessage[];
  hasOlderMessages: boolean;
  updatedAt: number;
  scrollTop: number;
}

type Entry = CachedMessageHistory & { key: string };
type Fetcher = (signal: AbortSignal) => Promise<MessageHistoryPage>;

/** In-memory, account-scoped message pages. Intentionally has no persistence. */
export class MessageHistoryCache {
  private entries = new Map<string, Entry>();
  private inFlight = new Map<string, { controller: AbortController; promise: Promise<MessageHistoryPage> }>();
  constructor(private readonly maxEntries = MESSAGE_HISTORY_MAX_CONVERSATIONS, private readonly ttlMs = MESSAGE_HISTORY_TTL_MS, private readonly now = () => Date.now()) {}

  key(accountId: number, conversationId: number) { return `${accountId}:${conversationId}`; }

  get(accountId: number, conversationId: number): (CachedMessageHistory & { isFresh: boolean }) | null {
    const key = this.key(accountId, conversationId);
    const entry = this.entries.get(key);
    if (!entry) return null;
    this.entries.delete(key); // Map insertion order is our LRU list.
    this.entries.set(key, entry);
    return { messages: entry.messages, hasOlderMessages: entry.hasOlderMessages, updatedAt: entry.updatedAt, scrollTop: entry.scrollTop, isFresh: this.now() - entry.updatedAt < this.ttlMs };
  }

  has(accountId: number, conversationId: number) { return this.entries.has(this.key(accountId, conversationId)); }

  set(accountId: number, conversationId: number, page: MessageHistoryPage, options: { prepend?: boolean; preserveExisting?: boolean } = {}) {
    const key = this.key(accountId, conversationId);
    const previous = this.entries.get(key);
    const base = options.prepend || options.preserveExisting ? previous?.messages || [] : [];
    const messages = page.messages.reduce(mergeMessage, base);
    const entry: Entry = { key, messages, hasOlderMessages: options.prepend ? page.hasOlderMessages : (previous?.hasOlderMessages || page.hasOlderMessages), updatedAt: this.now(), scrollTop: previous?.scrollTop || 0 };
    this.entries.delete(key);
    this.entries.set(key, entry);
    while (this.entries.size > this.maxEntries) this.entries.delete(this.entries.keys().next().value!);
    return entry;
  }

  upsertIfPresent(accountId: number, message: ConversationMessage) {
    const key = this.key(accountId, message.conversationId);
    const previous = this.entries.get(key);
    if (!previous) return false;
    this.entries.delete(key);
    this.entries.set(key, { ...previous, messages: mergeMessage(previous.messages, message), updatedAt: this.now() });
    return true;
  }

  setScroll(accountId: number, conversationId: number, scrollTop: number) {
    const key = this.key(accountId, conversationId);
    const entry = this.entries.get(key);
    if (entry) entry.scrollTop = scrollTop;
  }

  request(accountId: number, conversationId: number, fetcher: Fetcher, signal?: AbortSignal, variant = 'latest'): Promise<MessageHistoryPage> {
    const key = `${this.key(accountId, conversationId)}:${variant}`;
    let shared = this.inFlight.get(key);
    if (!shared) {
      const controller = new AbortController();
      const promise = fetcher(controller.signal).finally(() => this.inFlight.delete(key));
      shared = { controller, promise };
      this.inFlight.set(key, shared);
    }
    if (!signal) return shared.promise;
    if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
    return Promise.race([shared.promise, new Promise<MessageHistoryPage>((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }))]);
  }

  abort(accountId: number, conversationId: number, variant = 'latest') { this.inFlight.get(`${this.key(accountId, conversationId)}:${variant}`)?.controller.abort(); }
  isLoading(accountId: number, conversationId: number, variant = 'latest') { return this.inFlight.has(`${this.key(accountId, conversationId)}:${variant}`); }
  size() { return this.entries.size; }
}

export const messageHistoryCache = new MessageHistoryCache();

/** Idle-only prefetch queue. Explicit opens never wait for this queue. */
export class MessageHistoryPrefetcher {
  private queue: Array<{ key: string; task: () => Promise<void> }> = [];
  private active = 0;
  private scheduled = false;
  private pending = new Set<string>();
  constructor(private readonly limit = 2) {}

  enqueue(key: string, task: () => Promise<void>) {
    if (this.pending.has(key)) return;
    this.pending.add(key);
    this.queue.push({ key, task });
    this.schedule();
  }

  private schedule() {
    if (this.scheduled) return;
    this.scheduled = true;
    const run = () => { this.scheduled = false; this.drain(); };
    const idle = globalThis.requestIdleCallback as undefined | ((callback: () => void) => number);
    if (idle) idle(run); else globalThis.setTimeout(run, 0);
  }

  private drain() {
    while (this.active < this.limit && this.queue.length) {
      const { key, task } = this.queue.shift()!;
      this.active += 1;
      void task().finally(() => { this.active -= 1; this.pending.delete(key); this.drain(); });
    }
  }
}

export const messageHistoryPrefetcher = new MessageHistoryPrefetcher();
