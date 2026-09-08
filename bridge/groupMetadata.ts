import type { WhatsAppTransport } from './providers.js';

export interface GroupMetadata {
  id: string; avatarUrl?: string;
  subject?: string;
  description?: string;
  participants: Array<{ jid: string; lid?: string; phoneJid?: string; name?: string; phoneNumber?: string; avatarUrl?: string; admin?: string | null }>;
  transport: WhatsAppTransport;
  canEditDescription: boolean;
}
export const persistedGroupMetadata = (groupJid: string, transport: WhatsAppTransport, persisted: { subject?: string; avatarUrl?: string; description?: string; participants: unknown[] }): GroupMetadata | null => {
  const participants = persisted.participants.flatMap(value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    const item = value as Record<string, unknown>; const jid = typeof item.jid === 'string' ? item.jid : '';
    return jid ? [{ jid, ...(typeof item.lid === 'string' ? { lid: item.lid } : {}), ...(typeof item.phone_jid === 'string' ? { phoneJid: item.phone_jid } : {}), ...(typeof item.phone === 'string' ? { phoneNumber: item.phone } : {}), ...(typeof item.name === 'string' ? { name: item.name } : {}), ...(typeof item.avatar_url === 'string' ? { avatarUrl: item.avatar_url } : {}), ...(typeof item.admin === 'string' || item.admin === null ? { admin: item.admin as string | null } : {}) }] : [];
  });
  if (!participants.length) return null;
  return { id: groupJid, transport, canEditDescription: false, participants, ...(persisted.subject ? { subject: persisted.subject } : {}), ...(persisted.avatarUrl ? { avatarUrl: persisted.avatarUrl } : {}), ...(persisted.description ? { description: persisted.description } : {}) };
};

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
  invalidate(transport: WhatsAppTransport, groupJid: string) { this.values.delete(this.key(transport, groupJid)); }
}

export const groupMetadataCache = new GroupMetadataCache();
