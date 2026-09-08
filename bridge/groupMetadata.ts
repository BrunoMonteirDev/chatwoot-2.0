import type { WhatsAppTransport } from './providers.js';

export interface GroupMetadata {
  id: string; avatarUrl?: string;
  subject?: string;
  description?: string;
  participants: Array<{ jid: string; lid?: string; phoneJid?: string; name?: string; displayName?: string; phoneNumber?: string; avatarUrl?: string; admin?: string | null; contactId?: number }>;
  historicalParticipants?: GroupMetadata['participants'];
  transport: WhatsAppTransport;
  canEditDescription: boolean;
}
const persistedParticipants = (values: unknown[]) => values.flatMap(value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    const item = value as Record<string, unknown>; const jid = typeof item.jid === 'string' ? item.jid : '';
    return jid ? [{ jid, ...(typeof item.lid === 'string' ? { lid: item.lid } : {}), ...(typeof item.phone_jid === 'string' ? { phoneJid: item.phone_jid } : {}), ...(typeof item.phone === 'string' ? { phoneNumber: item.phone } : {}), ...(typeof item.name === 'string' ? { name: item.name } : {}), ...(typeof item.display_name === 'string' ? { displayName: item.display_name } : {}), ...(typeof item.avatar_url === 'string' ? { avatarUrl: item.avatar_url } : {}), ...(typeof item.contact_id === 'number' ? { contactId: item.contact_id } : {}), ...(typeof item.admin === 'string' || item.admin === null ? { admin: item.admin as string | null } : {}) }] : [];
  });
export const persistedGroupMetadata = (groupJid: string, transport: WhatsAppTransport, persisted: { subject?: string; avatarUrl?: string; description?: string; participants: unknown[]; historicalParticipants?: unknown[] }): GroupMetadata | null => {
  const participants = persistedParticipants(persisted.participants);
  if (!participants.length) return null;
  const historicalParticipants = persistedParticipants(persisted.historicalParticipants || []);
  return { id: groupJid, transport, canEditDescription: false, participants, ...(historicalParticipants.length ? { historicalParticipants } : {}), ...(persisted.subject ? { subject: persisted.subject } : {}), ...(persisted.avatarUrl ? { avatarUrl: persisted.avatarUrl } : {}), ...(persisted.description ? { description: persisted.description } : {}) };
};
export const mergeParticipantHistory = (previous: GroupMetadata['participants'], current: GroupMetadata['participants']) => {
  const merged = new Map<string, GroupMetadata['participants'][number]>();
  const key = (participant: GroupMetadata['participants'][number]) => String(participant.contactId || participant.phoneNumber || participant.phoneJid || participant.lid || participant.jid);
  previous.forEach(participant => merged.set(key(participant), participant));
  current.forEach(participant => merged.set(key(participant), { ...merged.get(key(participant)), ...participant }));
  return Array.from(merged.values());
};

type Cached = { value: GroupMetadata; expiresAt: number };

export class GroupMetadataCache {
  private values = new Map<string, Cached>();
  private loading = new Map<string, Promise<GroupMetadata>>();
  constructor(private readonly ttlMs = 5 * 60_000, private readonly now = () => Date.now()) {}
  key(transport: WhatsAppTransport, groupJid: string) { return `${transport}:${groupJid}`; }
  get(transport: WhatsAppTransport, groupJid: string) {
    const item = this.values.get(this.key(transport, groupJid));
    if (!item || item.expiresAt <= this.now()) { if (item) this.values.delete(this.key(transport, groupJid)); return null; }
    return item.value;
  }
  set(value: GroupMetadata) { this.values.set(this.key(value.transport, value.id), { value, expiresAt: this.now() + this.ttlMs }); return value; }
  async getOrLoad(transport: WhatsAppTransport, groupJid: string, loader: () => Promise<GroupMetadata>) {
    const cached = this.get(transport, groupJid);
    if (cached) return { value: cached, loaded: false };
    const key = this.key(transport, groupJid);
    const pending = this.loading.get(key);
    if (pending) return { value: await pending, loaded: false };
    const next = loader().then(value => this.set(value)).finally(() => this.loading.delete(key));
    this.loading.set(key, next);
    return { value: await next, loaded: true };
  }
  invalidate(transport: WhatsAppTransport, groupJid: string) { this.values.delete(this.key(transport, groupJid)); }
}

export const groupMetadataCache = new GroupMetadataCache();
