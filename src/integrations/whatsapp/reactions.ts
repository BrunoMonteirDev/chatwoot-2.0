const bridgeUrl = (import.meta.env.VITE_BRIDGE_PUBLIC_URL || '').replace(/\/$/, '');
import { authenticatedBridgeHeaders } from '../bridge/auth';

export type WhatsAppReactionTransport = 'evolution' | 'waha' | 'meta_cloud';

export interface SendWhatsAppReactionInput {
  accountId: number;
  inboxId: number;
  conversationId: number;
  sourceId: string;
  remoteJid: string;
  targetFromMe: boolean;
  participantJid?: string | null;
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

export const fallbackRemoteJid = (phoneNumber: string | null | undefined) => {
  const digits = phoneNumber?.replace(/\D/g, '') || '';
  return /^\d{8,15}$/.test(digits) ? `${digits}@s.whatsapp.net` : null;
};
