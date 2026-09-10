import { authenticatedBridgeHeaders } from '../bridge/auth';
import { chatwootApiClient } from '../chatwoot/client';
import type { Inbox } from '../../domain/currentUser';
import { bridgePublicUrl } from '../../config/runtime';
import { WHATSAPP_TRANSPORT_STATUSES, whatsappConfigurationForInbox } from './provider';

export type OperationalWhatsAppConnection = {
  applicable: boolean;
  sendAllowed: boolean;
  transport?: 'evolution' | 'waha' | 'meta_cloud' | null;
  status?: 'connected' | 'connecting' | 'disconnected' | 'error' | 'pending' | 'unknown';
  observedAt?: string;
};

export type WhatsAppSendCapability = {
  applicable: boolean;
  can_send_message: boolean;
  can_send_freeform: boolean;
  requires_template: boolean;
  template_required: boolean;
  send_block_reason: 'waha_disconnected' | 'waha_missing' | 'meta_disconnected' | 'reauthorization_required' | 'outside_window_template' | string | null;
  required_transport: 'waha' | 'meta_cloud' | null;
  connection_state: string;
};

export const WHATSAPP_CONNECTION_STALE_MS = 2 * 60_000;

// Private notes are Chatwoot-only and must remain available even when the
// selected WhatsApp transport is offline.
export const canSendWhatsAppMessage = (connection: OperationalWhatsAppConnection | null | undefined, isPrivate: boolean) =>
  isPrivate || !connection?.applicable || connection.sendAllowed;

export const canSendCapabilityMessage = (capability: WhatsAppSendCapability | null | undefined, isPrivate: boolean) =>
  isPrivate || !capability?.applicable || capability.can_send_freeform;

// The bridge connection endpoint resolves only legacy Channel::Api inboxes.
// Official Channel::Whatsapp inboxes, including Hybrid and Meta-only inboxes,
// are governed by their Rails-provided operational state and server routing.
export const usesLegacyWhatsAppConnection = (channelType: string | null | undefined) => channelType === 'Channel::Api';

export const persistedWhatsAppConnection = (inbox: Inbox, chatType: 'private' | 'group'): OperationalWhatsAppConnection => {
  const configuration = whatsappConfigurationForInbox(inbox);
  if (!configuration) return { applicable: false, sendAllowed: true };
  const transport = chatType === 'private'
    ? (configuration.transports.includes('meta_cloud') ? 'meta_cloud' : configuration.transports[0])
    : configuration.transports.find(item => item !== 'meta_cloud');
  if (!transport) return { applicable: true, transport: null, status: 'disconnected', sendAllowed: false };
  const statusKey = transport === 'meta_cloud' ? 'meta_connection_status' : `${transport}_connection_status`;
  const rawStatus = inbox.additionalAttributes[statusKey];
  let status = WHATSAPP_TRANSPORT_STATUSES.includes(rawStatus as typeof WHATSAPP_TRANSPORT_STATUSES[number])
    ? rawStatus as typeof WHATSAPP_TRANSPORT_STATUSES[number] : 'unknown';
  const observedAt = Date.parse(String(inbox.additionalAttributes[`${transport}_connection_updated_at`] || ''));
  if ((status === 'disconnected' || status === 'error') && Number.isFinite(observedAt) && Date.now() - observedAt > WHATSAPP_CONNECTION_STALE_MS) status = 'unknown';
  return { applicable: true, transport, status, sendAllowed: status === 'connected' || status === 'unknown' || status === 'pending' };
};

export const whatsappConnectionService = {
  get(accountId: number, inboxId: number, chatType: 'private' | 'group' = 'private'): Promise<OperationalWhatsAppConnection> {
    const key = `${accountId}:${inboxId}:${chatType}`;
    const existing = connectionRequests.get(key);
    if (existing) return existing;
    const url = bridgePublicUrl();
    if (!url) return Promise.resolve({ applicable: false, sendAllowed: true });
    const query = new URLSearchParams({ accountId: String(accountId), chatType });
    const pending = fetch(`${url}/providers/whatsapp/inboxes/${inboxId}/connection?${query}`, { headers: authenticatedBridgeHeaders() })
      .then(response => {
        if (!response.ok) throw new Error('Não foi possível verificar a conexão do WhatsApp.');
        return response.json() as Promise<OperationalWhatsAppConnection>;
      })
      .finally(() => connectionRequests.delete(key));
    connectionRequests.set(key, pending);
    return pending;
  },
};

const connectionRequests = new Map<string, Promise<OperationalWhatsAppConnection>>();

const capabilityCache = new Map<string, { value: WhatsAppSendCapability; expiresAt: number }>();
const capabilityRequests = new Map<string, Promise<WhatsAppSendCapability>>();
let capabilityCacheGeneration = 0;
export const clearWhatsAppCapabilityCache = () => { capabilityCacheGeneration += 1; capabilityCache.clear(); capabilityRequests.clear(); };
export const whatsappSendCapabilityService = {
  get: (accountId: number, conversationId: number) => {
    const key = `${accountId}:${conversationId}`;
    const cached = capabilityCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value);
    let pending = capabilityRequests.get(key);
    if (!pending) {
      const generation = capabilityCacheGeneration;
      pending = chatwootApiClient.get<WhatsAppSendCapability>(`/api/v1/accounts/${accountId}/conversations/${conversationId}/send_capability`)
        .then(value => { if (generation === capabilityCacheGeneration) capabilityCache.set(key, { value, expiresAt: Date.now() + 30_000 }); return value; })
        .finally(() => capabilityRequests.delete(key));
      capabilityRequests.set(key, pending);
    }
    return pending;
  },
};
