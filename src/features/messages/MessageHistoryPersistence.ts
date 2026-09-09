import type { ConversationMessage, ConversationSummary } from '../../domain/currentUser';
import { IndexedDbConnectionManager } from '../persistence/IndexedDbConnectionManager';

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
  private readonly database = new IndexedDbConnectionManager(MESSAGE_HISTORY_DATABASE, 1, database => {
    const store = database.createObjectStore(STORE, { keyPath: 'key' });
    store.createIndex('updatedAt', 'updatedAt');
  });

  async get(accountId: number, conversationId: number) {
    return this.safe(() => this.database.run(database => new Promise<PersistedMessageHistory | null>((resolve, reject) => {
      const transaction = database.transaction(STORE, 'readonly');
      const request = transaction.objectStore(STORE).get(keyFor(accountId, conversationId));
      request.onsuccess = () => resolve((request.result as PersistedMessageHistory | undefined) || null);
      request.onerror = () => reject(request.error);
    })), null);
  }

  async put(entry: PersistedMessageHistory) {
    await this.safe(() => this.database.run(database => new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE, 'readwrite');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
      transaction.objectStore(STORE).put(entry);
    })), undefined);
    await this.trim();
  }

  private async trim() {
    const keys = await this.safe(() => this.database.run(database => new Promise<IDBValidKey[]>((resolve, reject) => {
      const request = database.transaction(STORE, 'readonly').objectStore(STORE).index('updatedAt').getAllKeys();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    })), []);
    if (keys.length <= MAX_PERSISTED_CONVERSATIONS) return;
    await this.safe(() => this.database.run(database => new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE, 'readwrite');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
      keys.slice(0, keys.length - MAX_PERSISTED_CONVERSATIONS).forEach(key => transaction.objectStore(STORE).delete(key));
    })), undefined);
  }

  async clear() {
    await this.safe(() => this.database.run(database => new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE, 'readwrite');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
      transaction.objectStore(STORE).clear();
    })), undefined);
  }

  private async safe<T>(operation: () => Promise<T | null>, fallback: T): Promise<T> {
    try { return (await operation()) ?? fallback; }
    catch (error) {
      if (import.meta.env.DEV) console.warn('[indexeddb] message history cache unavailable', error);
      return fallback;
    }
  }
}

export const messageHistoryPersistence = new IndexedDbMessageHistoryPersistence();
