import { authenticatedBridgeHeaders } from '../bridge/auth';
import { chatwootApiClient } from '../chatwoot/client';

export type OperationalWhatsAppConnection = {
  applicable: boolean;
  sendAllowed: boolean;
  transport?: 'evolution' | 'waha' | 'meta_cloud' | null;
  status?: 'connected' | 'connecting' | 'disconnected' | 'error' | 'pending';
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

const bridgeUrl = () => (import.meta.env.VITE_BRIDGE_PUBLIC_URL || '').replace(/\/$/, '');

export const whatsappConnectionService = {
  async get(accountId: number, inboxId: number, chatType: 'private' | 'group' = 'private'): Promise<OperationalWhatsAppConnection> {
    const url = bridgeUrl();
    if (!url) return { applicable: false, sendAllowed: true };
    const query = new URLSearchParams({ accountId: String(accountId), chatType });
    const response = await fetch(`${url}/providers/whatsapp/inboxes/${inboxId}/connection?${query}`, { headers: authenticatedBridgeHeaders() });
    if (!response.ok) throw new Error('Não foi possível verificar a conexão do WhatsApp.');
    return response.json() as Promise<OperationalWhatsAppConnection>;
  },
};

export const whatsappSendCapabilityService = {
  get: (accountId: number, conversationId: number) => chatwootApiClient.get<WhatsAppSendCapability>(
    `/api/v1/accounts/${accountId}/conversations/${conversationId}/send_capability`
  ),
};
