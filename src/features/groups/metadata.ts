import { authenticatedBridgeHeaders } from '../../integrations/bridge/auth';
import { BridgeApiError } from '../../integrations/chatwoot/errors';
import type { WhatsAppTransport } from '../../integrations/whatsapp/provider';

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
  if (!id || !participants.length || !transport) return null;
  return { id, transport, participants, historicalParticipants: storedParticipants(attributes.whatsapp_group_participant_history), memberCount: participants.length, canEditDescription: transport !== 'meta_cloud', ...(subject ? { subject } : {}), ...(typeof attributes.whatsapp_group_avatar_url === 'string' ? { avatarUrl: attributes.whatsapp_group_avatar_url } : {}), ...(typeof attributes.whatsapp_group_description === 'string' ? { description: attributes.whatsapp_group_description } : {}) };
};
const bridgeUrl = (import.meta.env.VITE_BRIDGE_PUBLIC_URL || '').replace(/\/$/, '');
const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  if (!bridgeUrl) throw new BridgeApiError(503, null, 'O endereço seguro do bridge não está configurado.');
  const response = await fetch(`${bridgeUrl}${path}`, { ...init, headers: { ...authenticatedBridgeHeaders(), ...init.headers } });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new BridgeApiError(response.status, body, body && typeof body === 'object' && typeof body.error === 'string' ? body.error : 'Não foi possível carregar o grupo.');
  return body as T;
};
export const groupMetadataClient = {
  get: (accountId: number, inboxId: number, conversationId: number, transport?: WhatsAppTransport | null, signal?: AbortSignal) =>
    request<{ group: GroupMetadata }>(`/groups/metadata?${new URLSearchParams({ accountId: String(accountId), inboxId: String(inboxId), conversationId: String(conversationId), ...(transport ? { transport } : {}) })}`, { signal }),
  updateDescription: (inboxId: number, conversationId: number, transport: WhatsAppTransport, description: string) => request<{ group: GroupMetadata }>('/groups/description', { method: 'PATCH', body: JSON.stringify({ inboxId, conversationId, transport, description }) }),
  addParticipant: (inboxId: number, conversationId: number, transport: WhatsAppTransport, participant: string) => request<{ group: GroupMetadata }>('/groups/participants', { method: 'POST', body: JSON.stringify({ inboxId, conversationId, transport, participant }) }),
  leave: (inboxId: number, conversationId: number, transport: WhatsAppTransport) => request<void>('/groups/leave', { method: 'POST', body: JSON.stringify({ inboxId, conversationId, transport }) }),
};
