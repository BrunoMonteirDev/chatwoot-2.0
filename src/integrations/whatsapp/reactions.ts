const bridgeUrl = (import.meta.env.VITE_BRIDGE_PUBLIC_URL || '').replace(/\/$/, '');
import { authenticatedBridgeHeaders } from '../bridge/auth';
import { chatwootApiClient } from '../chatwoot/client';

export type WhatsAppReactionTransport = 'evolution' | 'waha' | 'meta_cloud';

export interface SendWhatsAppReactionInput {
  accountId: number;
  inboxId: number;
  conversationId: number;
  messageId: number;
  sourceId: string;
  remoteJid: string;
  targetFromMe: boolean;
  participantJid?: string | null;
  providerMessageKey?: string | null;
  transport: WhatsAppReactionTransport;
  emoji: string;
}

export class WhatsAppReactionError extends Error {}

export const whatsappReactionService = {
  async send(input: SendWhatsAppReactionInput): Promise<void> {
    if (!bridgeUrl) throw new WhatsAppReactionError('Ações do WhatsApp exigem um bridge configurado para este ambiente.');
    const response = await fetch(`${bridgeUrl}/operations/reactions`, {
      method: 'POST',
      headers: authenticatedBridgeHeaders(),
      body: JSON.stringify(input),
    });
    if (response.ok) return;
    const body: unknown = await response.json().catch(() => ({}));
    const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
      ? body.error
      : 'Não foi possível enviar a reação ao WhatsApp.';
    throw new WhatsAppReactionError(message);
  },
};

export const nativeWhatsAppReactionService = {
  send: (accountId: number, conversationId: number, messageId: number, emoji: string) =>
    chatwootApiClient.post(`/api/v1/accounts/${accountId}/conversations/${conversationId}/messages/${messageId}/native_whatsapp_reaction`, { emoji }),
};

// Official Hybrid reactions use the authenticated Rails endpoint. The browser
// never supplies a WAHA session: Rails resolves it from the official channel.
export const routedWhatsAppReactionService = {
  send: (input: SendWhatsAppReactionInput, officialHybrid: boolean): Promise<void> => {
    if (officialHybrid) return nativeWhatsAppReactionService.send(input.accountId, input.conversationId, input.messageId, input.emoji);
    return whatsappReactionService.send(input);
  },
};

// Compatibility for existing Meta callers; the endpoint is provider-neutral
// and now also dispatches official Hybrid WAHA reactions server-side.
export const nativeMetaReactionService = nativeWhatsAppReactionService;

export const fallbackRemoteJid = (phoneNumber: string | null | undefined) => {
  const digits = phoneNumber?.replace(/\D/g, '') || '';
  return /^\d{8,15}$/.test(digits) ? `${digits}@s.whatsapp.net` : null;
};
