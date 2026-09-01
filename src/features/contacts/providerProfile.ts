import { authenticatedBridgeHeaders } from '../../integrations/bridge/auth';
import { BridgeApiError } from '../../integrations/chatwoot/errors';
import type { WhatsAppTransport } from '../../integrations/whatsapp/provider';

const bridgeUrl = (import.meta.env.VITE_BRIDGE_PUBLIC_URL || '').replace(/\/$/, '');

export const providerProfileClient = {
  async get(inboxId: number, conversationId: number, transport?: WhatsAppTransport | null): Promise<{ name?: string; avatarUrl?: string }> {
    if (!bridgeUrl) throw new BridgeApiError(503, null, 'O endereço seguro do bridge não está configurado.');
    const query = new URLSearchParams({ inboxId: String(inboxId), conversationId: String(conversationId), ...(transport ? { transport } : {}) });
    const response = await fetch(`${bridgeUrl}/contacts/profile?${query}`, { headers: authenticatedBridgeHeaders() });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new BridgeApiError(response.status, body, body && typeof body === 'object' && typeof body.error === 'string' ? body.error : 'Não foi possível carregar o perfil do contato.');
    return body && typeof body === 'object' ? body as { name?: string; avatarUrl?: string } : {};
  },
};
