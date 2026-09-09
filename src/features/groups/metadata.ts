import { authenticatedBridgeHeaders } from '../../integrations/bridge/auth';
import { BridgeApiError } from '../../integrations/chatwoot/errors';
import type { WhatsAppTransport } from '../../integrations/whatsapp/provider';
import { IndexedDbGroupMetadataPersistence, type GroupMetadataPersistence } from './GroupMetadataPersistence';

// This is the canonical participant identity returned by Group Details. The
// composer deliberately consumes this response rather than rebuilding an
// identity from rendered message text.
export interface GroupParticipant {
  jid: string;
  providerId?: string;
  lid?: string;
  phoneJid?: string;
  phone?: string;
  displayName?: string;
  contactId?: number;
  name?: string;
  phoneNumber?: string;
  avatarUrl?: string;
  admin?: string | null;
}
export interface GroupMetadata { id: string; subject?: string; avatarUrl?: string; description?: string; participants: GroupParticipant[]; historicalParticipants?: GroupParticipant[]; memberCount?: number; transport: WhatsAppTransport; canEditDescription: boolean; }
const storedParticipants = (value: unknown): GroupParticipant[] => Array.isArray(value) ? value.flatMap(raw => {
  if (!raw || typeof raw !== 'object') return [];
  const item = raw as Record<string, unknown>;
  if (typeof item.jid !== 'string') return [];
  return [{ jid: item.jid, ...(typeof item.lid === 'string' ? { lid: item.lid } : {}), ...(typeof item.phone_jid === 'string' ? { phoneJid: item.phone_jid } : {}), ...(typeof item.phone === 'string' ? { phoneNumber: item.phone, phone: item.phone } : {}), ...(typeof item.name === 'string' ? { name: item.name } : {}), ...(typeof item.display_name === 'string' ? { displayName: item.display_name } : {}), ...(typeof item.avatar_url === 'string' ? { avatarUrl: item.avatar_url } : {}), ...(typeof item.contact_id === 'number' ? { contactId: item.contact_id } : {}), ...(typeof item.admin === 'string' || item.admin === null ? { admin: item.admin as string | null } : {}) }];
}) : [];
export const persistedGroupMetadata = (attributes: Record<string, unknown>, transport?: WhatsAppTransport | null, subject?: string): GroupMetadata | null => {
  const participants = storedParticipants(attributes.whatsapp_group_participants);
  const id = typeof attributes.whatsapp_group_jid === 'string' ? attributes.whatsapp_group_jid : '';
  const resolvedTransport = transport || (attributes.whatsapp_group_transport === 'waha' || attributes.whatsapp_group_transport === 'evolution' ? attributes.whatsapp_group_transport : null);
  if (!id || !participants.length || !resolvedTransport) return null;
  return { id, transport: resolvedTransport, participants, historicalParticipants: storedParticipants(attributes.whatsapp_group_participant_history), memberCount: participants.length, canEditDescription: resolvedTransport !== 'meta_cloud', ...(subject ? { subject } : {}), ...(typeof attributes.whatsapp_group_avatar_url === 'string' ? { avatarUrl: attributes.whatsapp_group_avatar_url } : {}), ...(typeof attributes.whatsapp_group_description === 'string' ? { description: attributes.whatsapp_group_description } : {}) };
};
const bridgeUrl = (import.meta.env.VITE_BRIDGE_PUBLIC_URL || '').replace(/\/$/, '');
const GROUP_METADATA_TTL_MS = 5 * 60_000;
const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  if (!bridgeUrl) throw new BridgeApiError(503, null, 'O endereço seguro do bridge não está configurado.');
  const response = await fetch(`${bridgeUrl}${path}`, { ...init, headers: { ...authenticatedBridgeHeaders(), ...init.headers } });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new BridgeApiError(response.status, body, body && typeof body === 'object' && typeof body.error === 'string' ? body.error : 'Não foi possível carregar o grupo.');
  return body as T;
};
export class GroupMetadataClient {
  private readonly memory = new Map<string, { group: GroupMetadata; updatedAt: number }>();
  private readonly inFlight = new Map<string, Promise<{ group: GroupMetadata }>>();
  private generation = 0;
  constructor(private readonly persistence: GroupMetadataPersistence = new IndexedDbGroupMetadataPersistence(), private readonly now = () => Date.now()) {}
  private key(accountId: number, inboxId: number, conversationId: number, transport?: WhatsAppTransport | null) { return `${accountId}:${inboxId}:${conversationId}:${transport || ''}`; }
  async cached(accountId: number, inboxId: number, conversationId: number, transport?: WhatsAppTransport | null) {
    const key = this.key(accountId, inboxId, conversationId, transport);
    const memory = this.memory.get(key);
    if (memory) return { group: memory.group, isFresh: this.now() - memory.updatedAt < GROUP_METADATA_TTL_MS };
    const stored = await this.persistence.get(key);
    if (!stored) return null;
    this.memory.set(key, { group: stored.group, updatedAt: stored.updatedAt });
    return { group: stored.group, isFresh: this.now() - stored.updatedAt < GROUP_METADATA_TTL_MS };
  }
  async get(accountId: number, inboxId: number, conversationId: number, transport?: WhatsAppTransport | null, signal?: AbortSignal) {
    const key = this.key(accountId, inboxId, conversationId, transport);
    const cached = await this.cached(accountId, inboxId, conversationId, transport);
    if (cached?.isFresh) return { group: cached.group };
    let pending = this.inFlight.get(key);
    if (!pending) {
      const generation = this.generation;
      pending = request<{ group: GroupMetadata }>(`/groups/metadata?${new URLSearchParams({ accountId: String(accountId), inboxId: String(inboxId), conversationId: String(conversationId), ...(transport ? { transport } : {}) })}`).then(async result => {
        if (generation !== this.generation) return result;
        const updatedAt = this.now();
        this.memory.set(key, { group: result.group, updatedAt });
        await this.persistence.put({ key, accountId, inboxId, conversationId, updatedAt, group: result.group });
        return result;
      }).finally(() => this.inFlight.delete(key));
      this.inFlight.set(key, pending);
    }
    if (!signal) return pending;
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
    return Promise.race([pending, new Promise<never>((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }))]);
  }
  updateDescription(accountId: number, inboxId: number, conversationId: number, transport: WhatsAppTransport, description: string) { return request<{ group: GroupMetadata }>('/groups/description', { method: 'PATCH', body: JSON.stringify({ accountId, inboxId, conversationId, transport, description }) }); }
  addParticipants(input: { accountId: number; inboxId: number; conversationId: number; transport: WhatsAppTransport; mode: 'invite' | 'direct'; contactIds: number[]; directConfirmed: boolean }) { return request<{ group: GroupMetadata; results: Array<{ contactId: number; ok: boolean; error?: string }>; inviteStatus?: string }>('/groups/participants', { method: 'POST', body: JSON.stringify(input) }); }
  leave(accountId: number, inboxId: number, conversationId: number, transport: WhatsAppTransport) { return request<void>('/groups/leave', { method: 'POST', body: JSON.stringify({ accountId, inboxId, conversationId, transport }) }); }
  async clear() { this.generation += 1; this.memory.clear(); this.inFlight.clear(); await this.persistence.clear(); }
}
export const groupMetadataClient = new GroupMetadataClient();
