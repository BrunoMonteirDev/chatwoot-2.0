import { authenticatedBridgeHeaders } from '../bridge/auth';
import type { Inbox } from '../../domain/currentUser';
import { isNativeWhatsAppInbox } from './provider';

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

const bridgeUrl = (import.meta.env.VITE_BRIDGE_PUBLIC_URL || '').replace(/\/$/, '');

export const whatsappConnectionService = {
  async get(accountId: number, inboxId: number, chatType: 'private' | 'group' = 'private'): Promise<OperationalWhatsAppConnection> {
    if (!bridgeUrl) return { applicable: false, sendAllowed: true };
    const query = new URLSearchParams({ accountId: String(accountId), chatType });
    const response = await fetch(`${bridgeUrl}/providers/whatsapp/inboxes/${inboxId}/connection?${query}`, { headers: authenticatedBridgeHeaders() });
    if (!response.ok) throw new Error('Não foi possível verificar a conexão do WhatsApp.');
    return response.json() as Promise<OperationalWhatsAppConnection>;
  },
  getForInbox(accountId: number, inbox: Inbox, chatType: 'private' | 'group' = 'private'): Promise<OperationalWhatsAppConnection> {
    if (isNativeWhatsAppInbox(inbox)) {
      const value = inbox.additionalAttributes.meta_connection_status;
      const status = value === 'connected' || value === 'connecting' || value === 'disconnected' || value === 'error' ? value : 'connected';
      return Promise.resolve({ applicable: true, transport: 'meta_cloud', status, sendAllowed: status === 'connected' });
    }
    return this.get(accountId, inbox.id, chatType);
  },
};
