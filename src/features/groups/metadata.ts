import { authenticatedBridgeHeaders } from '../../integrations/bridge/auth';
import { BridgeApiError } from '../../integrations/chatwoot/errors';
import type { WhatsAppTransport } from '../../integrations/whatsapp/provider';

export interface GroupParticipant { jid: string; name?: string; phoneNumber?: string; avatarUrl?: string; admin?: string | null; }
export interface GroupMetadata { id: string; subject?: string; description?: string; participants: GroupParticipant[]; transport: WhatsAppTransport; canEditDescription: boolean; }
const bridgeUrl = (import.meta.env.VITE_BRIDGE_PUBLIC_URL || '').replace(/\/$/, '');
const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  if (!bridgeUrl) throw new BridgeApiError(503, null, 'O endereço seguro do bridge não está configurado.');
  const response = await fetch(`${bridgeUrl}${path}`, { ...init, headers: { ...authenticatedBridgeHeaders(), ...init.headers } });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new BridgeApiError(response.status, body, body && typeof body === 'object' && typeof body.error === 'string' ? body.error : 'Não foi possível carregar o grupo.');
  return body as T;
};
export const groupMetadataClient = {
  get: (inboxId: number, conversationId: number, transport?: WhatsAppTransport | null) => request<{ group: GroupMetadata }>(`/groups/metadata?${new URLSearchParams({ inboxId: String(inboxId), conversationId: String(conversationId), ...(transport ? { transport } : {}) })}`),
  updateDescription: (inboxId: number, conversationId: number, transport: WhatsAppTransport, description: string) => request<{ group: GroupMetadata }>('/groups/description', { method: 'PATCH', body: JSON.stringify({ inboxId, conversationId, transport, description }) }),
  addParticipant: (inboxId: number, conversationId: number, transport: WhatsAppTransport, participant: string) => request<{ group: GroupMetadata }>('/groups/participants', { method: 'POST', body: JSON.stringify({ inboxId, conversationId, transport, participant }) }),
  leave: (inboxId: number, conversationId: number, transport: WhatsAppTransport) => request<void>('/groups/leave', { method: 'POST', body: JSON.stringify({ inboxId, conversationId, transport }) }),
};
