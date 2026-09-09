import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { decryptBridgeValue, encryptBridgeValue } from './encryption.js';
import { bridgeRedis } from './redis.js';

export type GroupOperationResult = { contactId: number; ok: boolean; error?: string };
export type GroupCreationWarning = { code: string };
export type StoredGroupCreation = {
  creationRequestId: string;
  accountId: number;
  inboxId: number;
  inboxName: string;
  mode: 'invite' | 'direct';
  transport: 'waha' | 'evolution';
  providerSession: string;
  name: string;
  contactIds: number[];
  created: true;
  groupId: string;
  groupJid: string;
  conversationId?: number;
  inviteLink?: string;
  inviteStatus: 'not_requested' | 'pending' | 'complete' | 'partial' | 'failed';
  results: GroupOperationResult[];
  warnings: GroupCreationWarning[];
};

type Values = Record<string, StoredGroupCreation>;

export class GroupCreationStore {
  private values: Values = {};
  private loaded = false;
  private queue = Promise.resolve();
  private operationQueues = new Map<string, Promise<void>>();

  constructor(private readonly file: string) {}

  private key(accountId: number, creationRequestId: string) { return `${accountId}:${creationRequestId}`; }

  private async loadFile() {
    if (this.loaded) return;
    try {
      const parsed: unknown = JSON.parse(await readFile(this.file, 'utf8'));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) this.values = parsed as Values;
    } catch (error: unknown) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
    }
    this.loaded = true;
  }

  async get(accountId: number, creationRequestId: string) {
    const key = this.key(accountId, creationRequestId);
    if (bridgeRedis.enabled) {
      const encrypted = await bridgeRedis.get(`bridge:group-creation:${key}`);
      return encrypted ? JSON.parse(decryptBridgeValue(encrypted)) as StoredGroupCreation : null;
    }
    await this.loadFile();
    return this.values[key] || null;
  }

  async save(value: StoredGroupCreation) {
    const key = this.key(value.accountId, value.creationRequestId);
    if (bridgeRedis.enabled) {
      await bridgeRedis.set(`bridge:group-creation:${key}`, encryptBridgeValue(JSON.stringify(value)), 7 * 24 * 60 * 60);
      return value;
    }
    const previous = this.queue;
    let release!: () => void;
    this.queue = new Promise(resolve => { release = resolve; });
    await previous;
    try {
      await this.loadFile();
      this.values[key] = value;
      await mkdir(dirname(this.file), { recursive: true });
      const temporary = `${this.file}.tmp`;
      await writeFile(temporary, JSON.stringify(this.values), { encoding: 'utf8', mode: 0o600 });
      await rename(temporary, this.file);
      return value;
    } finally { release(); }
  }

  async exclusive<T>(accountId: number, creationRequestId: string, operation: () => Promise<T>) {
    const key = this.key(accountId, creationRequestId);
    if (bridgeRedis.enabled) {
      let token: string | null = null;
      for (let attempt = 0; attempt < 600 && !token; attempt += 1) {
        token = await bridgeRedis.acquireLease(`group-creation:${key}`, 120);
        if (!token) await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (!token) throw new Error('A criação do grupo ainda está sendo processada.');
      try { return await operation(); }
      finally { await bridgeRedis.releaseLease(`group-creation:${key}`, token); }
    }
    const previous = this.operationQueues.get(key) || Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>(resolve => { release = resolve; });
    this.operationQueues.set(key, current);
    await previous;
    try { return await operation(); }
    finally { release(); if (this.operationQueues.get(key) === current) this.operationQueues.delete(key); }
  }
}
