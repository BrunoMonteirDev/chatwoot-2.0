import type { WhatsAppTransport } from './providers.js';

export interface GroupMetadata {
  id: string;
  subject?: string;
  description?: string;
  participants: Array<{ jid: string; name?: string; phoneNumber?: string; admin?: string | null }>;
  transport: WhatsAppTransport;
  canEditDescription: boolean;
}

type Cached = { value: GroupMetadata; expiresAt: number };

export class GroupMetadataCache {
  private values = new Map<string, Cached>();
  constructor(private readonly ttlMs = 5 * 60_000, private readonly now = () => Date.now()) {}
  key(transport: WhatsAppTransport, groupJid: string) { return `${transport}:${groupJid}`; }
  get(transport: WhatsAppTransport, groupJid: string) {
    const item = this.values.get(this.key(transport, groupJid));
    if (!item || item.expiresAt <= this.now()) { if (item) this.values.delete(this.key(transport, groupJid)); return null; }
    return item.value;
  }
  set(value: GroupMetadata) { this.values.set(this.key(value.transport, value.id), { value, expiresAt: this.now() + this.ttlMs }); return value; }
}

export const groupMetadataCache = new GroupMetadataCache();
