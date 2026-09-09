import type { ConversationMessage, ConversationSummary } from '../../domain/currentUser';

export const MESSAGE_HISTORY_DATABASE = 'kopla-message-history-v1';
const STORE = 'histories';
const MAX_PERSISTED_CONVERSATIONS = 50;

export interface PersistedMessageHistory {
  key: string;
  accountId: number;
  conversationId: number;
  messages: ConversationMessage[];
  hasOlderMessages: boolean;
  updatedAt: number;
  scrollTop: number;
  oldestMessageId?: number;
  conversation?: ConversationSummary;
}

export interface MessageHistoryPersistence {
  get(accountId: number, conversationId: number): Promise<PersistedMessageHistory | null>;
  put(entry: PersistedMessageHistory): Promise<void>;
  clear(): Promise<void>;
}

const keyFor = (accountId: number, conversationId: number) => `${accountId}:${conversationId}`;

export class MemoryMessageHistoryPersistence implements MessageHistoryPersistence {
  readonly entries = new Map<string, PersistedMessageHistory>();
  async get(accountId: number, conversationId: number) { return structuredClone(this.entries.get(keyFor(accountId, conversationId)) || null); }
  async put(entry: PersistedMessageHistory) { this.entries.set(entry.key, structuredClone(entry)); }
  async clear() { this.entries.clear(); }
}

export class IndexedDbMessageHistoryPersistence implements MessageHistoryPersistence {
  private database?: Promise<IDBDatabase | null>;

  private open() {
    if (this.database) return this.database;
    this.database = new Promise((resolve) => {
      if (typeof indexedDB === 'undefined') { resolve(null); return; }
      const request = indexedDB.open(MESSAGE_HISTORY_DATABASE, 1);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore(STORE, { keyPath: 'key' });
        store.createIndex('updatedAt', 'updatedAt');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    });
    return this.database;
  }

  async get(accountId: number, conversationId: number) {
    const database = await this.open();
    if (!database) return null;
    return new Promise<PersistedMessageHistory | null>((resolve) => {
      const request = database.transaction(STORE, 'readonly').objectStore(STORE).get(keyFor(accountId, conversationId));
      request.onsuccess = () => resolve((request.result as PersistedMessageHistory | undefined) || null);
      request.onerror = () => resolve(null);
    });
  }

  async put(entry: PersistedMessageHistory) {
    const database = await this.open();
    if (!database) return;
    await new Promise<void>((resolve) => {
      const request = database.transaction(STORE, 'readwrite').objectStore(STORE).put(entry);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
    await this.trim(database);
  }

  private async trim(database: IDBDatabase) {
    const keys = await new Promise<IDBValidKey[]>((resolve) => {
      const request = database.transaction(STORE, 'readonly').objectStore(STORE).index('updatedAt').getAllKeys();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve([]);
    });
    if (keys.length <= MAX_PERSISTED_CONVERSATIONS) return;
    const transaction = database.transaction(STORE, 'readwrite');
    keys.slice(0, keys.length - MAX_PERSISTED_CONVERSATIONS).forEach(key => transaction.objectStore(STORE).delete(key));
  }

  async clear() {
    const database = await this.open();
    if (!database) return;
    await new Promise<void>((resolve) => {
      const request = database.transaction(STORE, 'readwrite').objectStore(STORE).clear();
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
  }
}

export const messageHistoryPersistence = new IndexedDbMessageHistoryPersistence();
