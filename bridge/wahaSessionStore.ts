import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { decryptBridgeValue, encryptBridgeValue } from './encryption.js';
import { bridgeRedis } from './redis.js';

export type WahaSessionOwnership = {
  provider: 'waha'; accountId: number; inboxId: number; sessionName: string;
  createdAt: string; updatedAt: string; status?: string; engine?: string; phone?: string;
};

export class WahaSessionOwnershipError extends Error {
  constructor(readonly code: 'not_found' | 'forbidden' | 'conflict') { super('WAHA session is not available for this inbox.'); }
}

type Stored = Record<string, WahaSessionOwnership>;

// One small encrypted document makes account/inbox checks atomic across bridge
// replicas. It deliberately contains only public session metadata, never keys.
export class WahaSessionStore {
  private values: Stored = {}; private loaded = false; private localQueue = Promise.resolve();
  constructor(private readonly file: string) {}

  private async loadFile() {
    if (this.loaded) return;
    try { const value: unknown = JSON.parse(await readFile(this.file, 'utf8')); if (value && typeof value === 'object' && !Array.isArray(value)) this.values = value as Stored; }
    catch (error: unknown) { if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error; }
    this.loaded = true;
  }
  private async read(): Promise<Stored> {
    if (bridgeRedis.enabled) {
      const encrypted = await bridgeRedis.get('bridge:waha-session-ownerships');
      if (!encrypted) return {};
      const value: unknown = JSON.parse(decryptBridgeValue(encrypted));
      return value && typeof value === 'object' && !Array.isArray(value) ? value as Stored : {};
    }
    await this.loadFile(); return { ...this.values };
  }
  private async write(values: Stored) {
    if (bridgeRedis.enabled) { await bridgeRedis.set('bridge:waha-session-ownerships', encryptBridgeValue(JSON.stringify(values))); return; }
    this.values = values; await mkdir(dirname(this.file), { recursive: true }); const tmp = `${this.file}.tmp`;
    await writeFile(tmp, JSON.stringify(values), { encoding: 'utf8', mode: 0o600 }); await rename(tmp, this.file);
  }
  private async locked<T>(callback: () => Promise<T>) {
    if (bridgeRedis.enabled) return bridgeRedis.withLock('waha-session-ownerships', callback);
    const previous = this.localQueue; let release!: () => void; this.localQueue = new Promise(resolve => { release = resolve; });
    await previous; try { return await callback(); } finally { release(); }
  }
  async get(sessionName: string) { return (await this.read())[sessionName] || null; }
  async list(accountId: number, inboxId: number) { return Object.values(await this.read()).filter(item => item.accountId === accountId && item.inboxId === inboxId); }
  async assertOwned(accountId: number, inboxId: number, sessionName: string) {
    const ownership = await this.get(sessionName);
    if (!ownership) throw new WahaSessionOwnershipError('not_found');
    if (ownership.accountId !== accountId || ownership.inboxId !== inboxId) throw new WahaSessionOwnershipError('forbidden');
    return ownership;
  }
  async reserve(input: Omit<WahaSessionOwnership, 'provider' | 'createdAt' | 'updatedAt'>) {
    return this.locked(async () => {
      const values = await this.read(); const existing = values[input.sessionName];
      if (existing && (existing.accountId !== input.accountId || existing.inboxId !== input.inboxId)) throw new WahaSessionOwnershipError('conflict');
      const now = new Date().toISOString(); const record: WahaSessionOwnership = { ...existing, ...input, provider: 'waha', createdAt: existing?.createdAt || now, updatedAt: now };
      values[input.sessionName] = record; await this.write(values); return record;
    });
  }
  async update(sessionName: string, patch: Partial<Pick<WahaSessionOwnership, 'status' | 'engine' | 'phone'>>) {
    return this.locked(async () => { const values = await this.read(); const existing = values[sessionName]; if (!existing) throw new WahaSessionOwnershipError('not_found'); values[sessionName] = { ...existing, ...patch, updatedAt: new Date().toISOString() }; await this.write(values); return values[sessionName]; });
  }
  async remove(accountId: number, inboxId: number, sessionName: string) {
    return this.locked(async () => { const values = await this.read(); const value = values[sessionName]; if (!value) return; if (value.accountId !== accountId || value.inboxId !== inboxId) throw new WahaSessionOwnershipError('forbidden'); delete values[sessionName]; await this.write(values); });
  }
}
