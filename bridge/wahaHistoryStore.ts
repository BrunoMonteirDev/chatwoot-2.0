import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { decryptBridgeValue, encryptBridgeValue } from './encryption.js';
import { bridgeRedis } from './redis.js';

export type WahaHistoryRange = '7d' | '30d' | '90d' | 'all';
export type WahaHistoryJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface WahaHistoryJob {
  id: string;
  accountId: number;
  inboxId: number;
  sessionName: string;
  requestedRange: WahaHistoryRange;
  trackId: string;
  status: WahaHistoryJobStatus;
  startedAt?: string;
  finishedAt?: string;
  processed: number;
  imported: number;
  duplicates: number;
  skipped: number;
  failed: number;
  mediaImported: number;
  mediaFailed: number;
  conversations: number;
  lastError?: string;
}

/**
 * A compact, encrypted job document. Redis is the production source of truth;
 * the file fallback lives in the bridge data volume for local development.
 */
export class WahaHistoryStore {
  private values: Record<string, WahaHistoryJob> = {};
  private loaded = false;
  // The development fallback is one JSON document. History workers update
  // progress concurrently, so serialize its read/modify/write cycle just as
  // Redis does in production. Otherwise two writes reuse the same `.tmp`
  // filename and one rename can fail with ENOENT.
  private localQueue = Promise.resolve();
  constructor(private readonly file: string) {}

  async create(job: WahaHistoryJob) {
    return this.mutate(job.accountId, job.inboxId, current => {
      if (current && (current.status === 'pending' || current.status === 'running')) throw new Error('Uma importação de histórico já está em andamento para esta inbox.');
      return job;
    });
  }

  async get(accountId: number, inboxId: number, jobId?: string) {
    const job = await this.read(accountId, inboxId);
    return job && (!jobId || job.id === jobId) ? job : undefined;
  }

  async update(accountId: number, inboxId: number, change: Partial<WahaHistoryJob>) {
    return this.mutate(accountId, inboxId, current => {
      if (!current) throw new Error('Importação de histórico não encontrada.');
      return { ...current, ...change };
    });
  }

  async addMetrics(accountId: number, inboxId: number, metrics: Partial<Pick<WahaHistoryJob, 'processed' | 'imported' | 'duplicates' | 'skipped' | 'failed' | 'mediaImported' | 'mediaFailed' | 'conversations'>>) {
    return this.mutate(accountId, inboxId, current => {
      if (!current) throw new Error('Importação de histórico não encontrada.');
      const next = { ...current };
      for (const [key, value] of Object.entries(metrics) as Array<[keyof typeof metrics, number | undefined]>) {
        if (typeof value === 'number') (next as unknown as Record<string, number>)[key] += value;
      }
      return next;
    });
  }

  private key(accountId: number, inboxId: number) { return `bridge:waha-history:${accountId}:${inboxId}`; }

  private async mutate(accountId: number, inboxId: number, action: (job: WahaHistoryJob | undefined) => WahaHistoryJob) {
    const write = async () => {
      const job = action(await this.read(accountId, inboxId));
      await this.write(accountId, inboxId, job);
      return job;
    };
    if (bridgeRedis.enabled) return bridgeRedis.withLock(`waha-history-job:${accountId}:${inboxId}`, write);
    return this.withLocalLock(write);
  }

  private async withLocalLock<T>(callback: () => Promise<T>) {
    const previous = this.localQueue;
    let release!: () => void;
    this.localQueue = new Promise<void>(resolve => { release = resolve; });
    await previous;
    try { return await callback(); } finally { release(); }
  }

  private async read(accountId: number, inboxId: number): Promise<WahaHistoryJob | undefined> {
    const key = this.key(accountId, inboxId);
    if (bridgeRedis.enabled) {
      const encrypted = await bridgeRedis.get(key);
      if (encrypted) {
        try {
          const value: unknown = JSON.parse(decryptBridgeValue(encrypted));
          return this.valid(value) ? value : undefined;
        } catch { throw new Error('O estado criptografado da importação WAHA não pôde ser lido.'); }
      }
      await this.load();
      const legacy = this.values[key];
      if (legacy) await this.write(accountId, inboxId, legacy);
      return legacy;
    }
    await this.load();
    return this.values[key];
  }

  private async write(accountId: number, inboxId: number, job: WahaHistoryJob) {
    const key = this.key(accountId, inboxId);
    if (bridgeRedis.enabled) {
      await bridgeRedis.set(key, encryptBridgeValue(JSON.stringify(job)));
      return;
    }
    this.values[key] = job;
    await mkdir(dirname(this.file), { recursive: true });
    const temporary = `${this.file}.tmp`;
    await writeFile(temporary, JSON.stringify(this.values), { encoding: 'utf8', mode: 0o600 });
    await rename(temporary, this.file);
  }

  private valid(value: unknown): value is WahaHistoryJob {
    return Boolean(value && typeof value === 'object' && typeof (value as WahaHistoryJob).id === 'string' && typeof (value as WahaHistoryJob).accountId === 'number' && typeof (value as WahaHistoryJob).inboxId === 'number');
  }

  private async load() {
    if (this.loaded) return;
    try {
      const parsed: unknown = JSON.parse(await readFile(this.file, 'utf8'));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) this.values = Object.fromEntries(Object.entries(parsed as Record<string, unknown>).filter(([, value]) => this.valid(value)) as Array<[string, WahaHistoryJob]>);
    } catch (error: unknown) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
    }
    this.loaded = true;
  }
}
