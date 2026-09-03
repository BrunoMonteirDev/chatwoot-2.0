import { authenticatedBridgeHeaders } from '../bridge/auth';

export type OperationalWhatsAppConnection = {
  applicable: boolean;
  sendAllowed: boolean;
  transport?: 'evolution' | 'waha' | 'meta_cloud' | null;
  status?: 'connected' | 'connecting' | 'disconnected' | 'error' | 'pending';
};

// Private notes are Chatwoot-only and must remain available even when the
// selected WhatsApp transport is offline.
export const canSendWhatsAppMessage = (connection: OperationalWhatsAppConnection | null | undefined, isPrivate: boolean) =>
  isPrivate || !connection?.applicable || connection.sendAllowed;

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
