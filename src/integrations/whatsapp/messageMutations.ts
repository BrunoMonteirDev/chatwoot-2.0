import { authenticatedBridgeHeaders } from '../bridge/auth';
import type { WhatsAppReactionTransport } from './reactions';
import { bridgePublicUrl } from '../../config/runtime';
import type { ProviderMessageMutationCapabilities } from '../../features/messages/capabilities';

export class WhatsAppMessageMutationError extends Error {}
export type WhatsAppMessageMutationInput = { accountId: number; inboxId: number; sourceId: string; remoteJid: string; targetFromMe: boolean; participantJid?: string | null; transport: WhatsAppReactionTransport; content?: string };
export type WhatsAppMessageMutationCapabilityInput = Pick<WhatsAppMessageMutationInput, 'accountId' | 'inboxId' | 'sourceId' | 'targetFromMe'>;

export const whatsappMessageMutationService = {
  async capabilities(input: WhatsAppMessageMutationCapabilityInput): Promise<ProviderMessageMutationCapabilities | null> {
    const bridgeUrl = bridgePublicUrl();
    if (!bridgeUrl) return null;
    try {
      const response = await fetch(`${bridgeUrl}/operations/messages/capabilities`, { method: 'POST', headers: { ...authenticatedBridgeHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      if (!response.ok) return null;
      return await response.json() as ProviderMessageMutationCapabilities;
    } catch {
      // An unavailable capability lookup must not become a speculative block.
      return null;
    }
  },
  async send(operation: 'edit' | 'revoke', input: WhatsAppMessageMutationInput): Promise<{ content: string; content_attributes: Record<string, unknown> }> {
    const bridgeUrl = bridgePublicUrl();
    if (!bridgeUrl) throw new WhatsAppMessageMutationError('Ações do WhatsApp exigem um bridge configurado para este ambiente.');
    const response = await fetch(`${bridgeUrl}/operations/messages/${operation}`, { method: 'POST', headers: { ...authenticatedBridgeHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    const body: unknown = await response.json().catch(() => ({}));
    if (!response.ok) throw new WhatsAppMessageMutationError(body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string' ? (body as { error: string }).error : 'Não foi possível atualizar a mensagem no WhatsApp.');
    return body as { content: string; content_attributes: Record<string, unknown> };
  },
};
