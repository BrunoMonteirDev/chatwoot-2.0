import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { bridgeRedis } from './redis.js';

export class PersistentDedupStore {
  private readonly ids = new Set<string>();
  private readonly inFlight = new Set<string>();
  private loaded = false;

  constructor(private readonly file: string, private readonly limit = 50_000, private readonly ttlSeconds = 7 * 24 * 60 * 60) {}

  async hasOrLock(id: string) {
    if (bridgeRedis.enabled) {
      const locked = await bridgeRedis.setIfAbsent(`bridge:dedup:${id}`, 'processing', 5 * 60);
      return !locked;
    }
    await this.load();
    if (this.ids.has(id) || this.inFlight.has(id)) return true;
    this.inFlight.add(id);
    return false;
  }

  async commit(id: string) {
    if (bridgeRedis.enabled) {
      await bridgeRedis.set(`bridge:dedup:${id}`, 'committed', this.ttlSeconds);
      return;
    }
    this.inFlight.delete(id); this.ids.add(id);
    while (this.ids.size > this.limit) this.ids.delete(this.ids.values().next().value!);
    await mkdir(dirname(this.file), { recursive: true });
    const temporary = `${this.file}.tmp`;
    await writeFile(temporary, JSON.stringify([...this.ids]), 'utf8');
    await rename(temporary, this.file);
  }

  release(id: string) {
    this.inFlight.delete(id);
    if (bridgeRedis.enabled) return bridgeRedis.delete(`bridge:dedup:${id}`);
  }

  private async load() {
    if (this.loaded) return;
    try {
      const values: unknown = JSON.parse(await readFile(this.file, 'utf8'));
      if (Array.isArray(values)) values.filter((value): value is string => typeof value === 'string').forEach(value => this.ids.add(value));
    } catch (error: unknown) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
    }
    this.loaded = true;
  }
}
