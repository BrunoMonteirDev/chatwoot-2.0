import { authenticatedBridgeHeaders } from '../bridge/auth';
import type { WhatsAppReactionTransport } from './reactions';

const bridgeUrl = (import.meta.env.VITE_BRIDGE_PUBLIC_URL || '').replace(/\/$/, '');
export class WhatsAppMessageMutationError extends Error {}
export type WhatsAppMessageMutationInput = { accountId: number; inboxId: number; sourceId: string; remoteJid: string; targetFromMe: boolean; participantJid?: string | null; transport: WhatsAppReactionTransport; content?: string };

export const whatsappMessageMutationService = {
  async send(operation: 'edit' | 'revoke', input: WhatsAppMessageMutationInput): Promise<{ content: string; content_attributes: Record<string, unknown> }> {
    if (!bridgeUrl) throw new WhatsAppMessageMutationError('Ações do WhatsApp exigem um bridge configurado para este ambiente.');
    const response = await fetch(`${bridgeUrl}/operations/messages/${operation}`, { method: 'POST', headers: { ...authenticatedBridgeHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    const body: unknown = await response.json().catch(() => ({}));
    if (!response.ok) throw new WhatsAppMessageMutationError(body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string' ? (body as { error: string }).error : 'Não foi possível atualizar a mensagem no WhatsApp.');
    return body as { content: string; content_attributes: Record<string, unknown> };
  },
};
