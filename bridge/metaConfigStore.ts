import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { MetaCloudManualConfig } from './meta.js';
import { decryptBridgeValue, encryptBridgeValue } from './encryption.js';
import { bridgeRedis } from './redis.js';

// Redis is the production source of truth, encrypted before persistence.
// The file is retained only as a local-development and one-time migration
// fallback for installations created before shared persistence was available.
export class MetaConfigStore {
  private values: Record<string, MetaCloudManualConfig> = {};
  private loaded = false;
  constructor(private readonly file: string) {}

  async save(inboxId: number, config: MetaCloudManualConfig) {
    if (bridgeRedis.enabled) {
      await bridgeRedis.set(`bridge:meta-config:${inboxId}`, encryptBridgeValue(JSON.stringify(config)));
      return;
    }
    await this.load();
    this.values[String(inboxId)] = config;
    await mkdir(dirname(this.file), { recursive: true });
    const temporary = `${this.file}.tmp`;
    await writeFile(temporary, JSON.stringify(this.values), { encoding: 'utf8', mode: 0o600 });
    await rename(temporary, this.file);
  }

  async get(inboxId: number): Promise<MetaCloudManualConfig | null> {
    if (bridgeRedis.enabled) {
      const encrypted = await bridgeRedis.get(`bridge:meta-config:${inboxId}`);
      if (encrypted) {
        try {
          const parsed: unknown = JSON.parse(decryptBridgeValue(encrypted));
          if (parsed && typeof parsed === 'object' && typeof (parsed as MetaCloudManualConfig).wabaId === 'string' && typeof (parsed as MetaCloudManualConfig).phoneNumberId === 'string' && typeof (parsed as MetaCloudManualConfig).accessToken === 'string') return parsed as MetaCloudManualConfig;
        } catch {
          throw new Error('A configuração Meta criptografada não pôde ser lida.');
        }
      }
      // Safe gradual migration from the old local development store.
      await this.load();
      const legacy = this.values[String(inboxId)] || null;
      if (legacy) await this.save(inboxId, legacy);
      return legacy;
    }
    await this.load();
    return this.values[String(inboxId)] || null;
  }

  private async load() {
    if (this.loaded) return;
    try {
      const parsed: unknown = JSON.parse(await readFile(this.file, 'utf8'));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) this.values = parsed as Record<string, MetaCloudManualConfig>;
    } catch (error: unknown) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
    }
    this.loaded = true;
  }
}
