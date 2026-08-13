import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

// Maps both WhatsApp identity forms (phone and LID) to one Chatwoot source id.
export class IdentityStore {
  private values: Record<string, string> = {};
  private loaded = false;

  constructor(private readonly file: string) {}

  async find(keys: string[]) {
    await this.load();
    return keys.map(key => this.values[key]).find((value): value is string => typeof value === 'string');
  }

  async save(keys: string[], sourceId: string) {
    await this.load();
    keys.filter(Boolean).forEach(key => { this.values[key] = sourceId; });
    await mkdir(dirname(this.file), { recursive: true });
    const temporary = `${this.file}.tmp`;
    await writeFile(temporary, JSON.stringify(this.values), 'utf8');
    await rename(temporary, this.file);
  }

  private async load() {
    if (this.loaded) return;
    try {
      const data: unknown = JSON.parse(await readFile(this.file, 'utf8'));
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        this.values = Object.fromEntries(Object.entries(data).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
      }
    } catch (error: unknown) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
    }
    this.loaded = true;
  }
}
