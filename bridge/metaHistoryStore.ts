import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { IncomingMetaMedia } from './metaEvent.js';
import { decryptBridgeValue, encryptBridgeValue } from './encryption.js';
import { bridgeRedis } from './redis.js';

export interface StagedMetaHistoryMessage {
  sourceId: string;
  messageId: string;
  threadId: string;
  from: string;
  to: string | null;
  direction: 'incoming' | 'outgoing' | 'unknown';
  timestamp: number | null;
  type: string;
  content: string;
  media?: IncomingMetaMedia;
  quotedMessageId?: string;
  historyStatus: string | null;
}

export interface StagedMetaHistoryBatch {
  phoneNumberId: string;
  phase: number | null;
  chunkOrder: number | null;
  progress: number | null;
  messages: StagedMetaHistoryMessage[];
}

export type MetaHistoryImportState = 'pending' | 'processing' | 'imported' | 'failed';

interface StoredMetaHistoryMessage extends StagedMetaHistoryMessage {
  importState: MetaHistoryImportState;
  lastError?: string;
}

export interface MetaHistoryImportSummary {
  pending: number;
  processing: number;
  imported: number;
  failed: number;
}

/**
 * History data is private message content. In production it is encrypted and
 * kept per inbox in Redis, with a brief distributed lock around mutations.
 * The file remains only for local development and migration from older builds.
 */
export class MetaHistoryStore {
  private values: Record<string, StoredMetaHistoryMessage[]> = {};
  private loaded = false;
  constructor(private readonly file: string) {}

  async stage(inboxId: number, batch: StagedMetaHistoryBatch) {
    return this.mutate(inboxId, messages => {
      const known = new Set(messages.map(message => message.sourceId));
      const additions = batch.messages
        .filter(message => !known.has(message.sourceId))
        .map(message => ({ ...message, importState: 'pending' as const }));
      return { value: [...messages, ...additions], result: { added: additions.length } };
    });
  }

  async has(inboxId: number, sourceId: string) {
    return (await this.read(inboxId)).some(message => message.sourceId === sourceId);
  }

  async claim(inboxId: number, limit: number): Promise<StagedMetaHistoryMessage[]> {
    return this.mutate(inboxId, messages => {
      // A process may have stopped between claim and completion. Import is
      // idempotent by source_id, so an explicit restart safely retries it.
      const reset = messages.map(message => message.importState === 'processing' ? { ...message, importState: 'pending' as const } : message);
      const claimedIds = new Set(reset.filter(message => message.importState === 'pending').slice(0, Math.max(1, limit)).map(message => message.sourceId));
      const value = reset.map(message => claimedIds.has(message.sourceId) ? { ...message, importState: 'processing' as const, lastError: undefined } : message);
      const result = value.filter(message => claimedIds.has(message.sourceId)).map(({ importState: _state, lastError: _error, ...message }) => message);
      return { value, result };
    });
  }

  async complete(inboxId: number, sourceId: string) {
    await this.transition(inboxId, sourceId, 'imported');
  }

  async fail(inboxId: number, sourceId: string, error: string) {
    await this.transition(inboxId, sourceId, 'failed', error.slice(0, 300));
  }

  async retryFailed(inboxId: number) {
    return this.mutate(inboxId, messages => ({
      value: messages.map(message => message.importState === 'failed' ? { ...message, importState: 'pending' as const, lastError: undefined } : message),
      result: undefined,
    }));
  }

  async summary(inboxId: number): Promise<MetaHistoryImportSummary> {
    return (await this.read(inboxId)).reduce<MetaHistoryImportSummary>((summary, message) => {
      summary[message.importState] += 1;
      return summary;
    }, { pending: 0, processing: 0, imported: 0, failed: 0 });
  }

  private async transition(inboxId: number, sourceId: string, importState: MetaHistoryImportState, lastError?: string) {
    await this.mutate(inboxId, messages => ({
      value: messages.map(message => message.sourceId === sourceId
        ? { ...message, importState, ...(lastError ? { lastError } : { lastError: undefined }) }
        : message),
      result: undefined,
    }));
  }

  private async mutate<T>(inboxId: number, action: (messages: StoredMetaHistoryMessage[]) => { value: StoredMetaHistoryMessage[]; result: T }): Promise<T> {
    return bridgeRedis.withLock(`meta-history:${inboxId}`, async () => {
      const result = action(await this.read(inboxId));
      await this.write(inboxId, result.value);
      return result.result;
    });
  }

  private key(inboxId: number) { return `bridge:meta-history:${inboxId}`; }

  private async read(inboxId: number): Promise<StoredMetaHistoryMessage[]> {
    if (bridgeRedis.enabled) {
      const encrypted = await bridgeRedis.get(this.key(inboxId));
      if (encrypted) {
        try {
          const parsed: unknown = JSON.parse(decryptBridgeValue(encrypted));
          return Array.isArray(parsed) ? this.normalize(parsed) : [];
        } catch {
          throw new Error('O histórico Meta criptografado não pôde ser lido.');
        }
      }
      await this.load();
      const legacy = this.values[String(inboxId)] || [];
      if (legacy.length) await this.write(inboxId, legacy);
      return legacy;
    }
    await this.load();
    return this.values[String(inboxId)] || [];
  }

  private async write(inboxId: number, messages: StoredMetaHistoryMessage[]) {
    if (bridgeRedis.enabled) {
      await bridgeRedis.set(this.key(inboxId), encryptBridgeValue(JSON.stringify(messages)));
      return;
    }
    this.values[String(inboxId)] = messages;
    await mkdir(dirname(this.file), { recursive: true });
    const temporary = `${this.file}.tmp`;
    await writeFile(temporary, JSON.stringify(this.values), { encoding: 'utf8', mode: 0o600 });
    await rename(temporary, this.file);
  }

  private normalize(values: unknown[]): StoredMetaHistoryMessage[] {
    return values.filter((message): message is StagedMetaHistoryMessage => Boolean(message && typeof message === 'object' && typeof (message as StagedMetaHistoryMessage).sourceId === 'string'))
      .map(message => ({ ...message, importState: ['pending', 'processing', 'imported', 'failed'].includes((message as StoredMetaHistoryMessage).importState)
        ? (message as StoredMetaHistoryMessage).importState : 'pending' as const }));
  }

  private async load() {
    if (this.loaded) return;
    try {
      const parsed: unknown = JSON.parse(await readFile(this.file, 'utf8'));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        this.values = Object.fromEntries(Object.entries(parsed as Record<string, unknown>).map(([inboxId, messages]) => [inboxId, Array.isArray(messages) ? this.normalize(messages) : []]));
      }
    } catch (error: unknown) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
    }
    this.loaded = true;
  }
}
