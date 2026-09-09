import type { GroupMetadata } from './metadata';

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
  private database?: Promise<IDBDatabase | null>;
  private open() {
    if (this.database) return this.database;
    this.database = new Promise((resolve) => {
      if (typeof indexedDB === 'undefined') { resolve(null); return; }
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'key' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    });
    return this.database;
  }
  async get(key: string) {
    const database = await this.open();
    if (!database) return null;
    return new Promise<PersistedGroupMetadata | null>((resolve) => {
      const request = database.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      request.onsuccess = () => resolve((request.result as PersistedGroupMetadata | undefined) || null);
      request.onerror = () => resolve(null);
    });
  }
  async put(value: PersistedGroupMetadata) {
    const database = await this.open();
    if (!database) return;
    await new Promise<void>((resolve) => {
      const request = database.transaction(STORE, 'readwrite').objectStore(STORE).put(value);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
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
