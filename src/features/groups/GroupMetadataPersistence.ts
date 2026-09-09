import type { GroupMetadata } from './metadata';
import { IndexedDbConnectionManager } from '../persistence/IndexedDbConnectionManager';

const DATABASE = 'kopla-group-metadata-v1';
const STORE = 'groups';

export interface PersistedGroupMetadata {
  key: string;
  accountId: number;
  inboxId: number;
  conversationId: number;
  updatedAt: number;
  group: GroupMetadata;
}

export interface GroupMetadataPersistence {
  get(key: string): Promise<PersistedGroupMetadata | null>;
  put(value: PersistedGroupMetadata): Promise<void>;
  clear(): Promise<void>;
}

export class MemoryGroupMetadataPersistence implements GroupMetadataPersistence {
  readonly entries = new Map<string, PersistedGroupMetadata>();
  async get(key: string) { return structuredClone(this.entries.get(key) || null); }
  async put(value: PersistedGroupMetadata) { this.entries.set(value.key, structuredClone(value)); }
  async clear() { this.entries.clear(); }
}

export class IndexedDbGroupMetadataPersistence implements GroupMetadataPersistence {
  private readonly database = new IndexedDbConnectionManager(DATABASE, 1, database => database.createObjectStore(STORE, { keyPath: 'key' }));

  async get(key: string) {
    return this.safe(() => this.database.run(database => new Promise<PersistedGroupMetadata | null>((resolve, reject) => {
      const transaction = database.transaction(STORE, 'readonly');
      const request = transaction.objectStore(STORE).get(key);
      request.onsuccess = () => resolve((request.result as PersistedGroupMetadata | undefined) || null);
      request.onerror = () => reject(request.error);
    })), null);
  }

  async put(value: PersistedGroupMetadata) {
    await this.safe(() => this.database.run(database => new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE, 'readwrite');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
      transaction.objectStore(STORE).put(value);
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
      if (import.meta.env.DEV) console.warn('[indexeddb] group metadata cache unavailable', error);
      return fallback;
    }
  }
}
