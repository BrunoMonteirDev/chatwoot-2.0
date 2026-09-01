import { authenticatedBridgeHeaders } from '../../integrations/bridge/auth';
import { BridgeApiError } from '../../integrations/chatwoot/errors';
import type { WhatsAppTransport } from '../../integrations/whatsapp/provider';
import { normalizeBrazilianPhone } from '../../../phone';

const bridgeUrl = (import.meta.env.VITE_BRIDGE_PUBLIC_URL || '').replace(/\/$/, '');
const canonicalPhoneDigits = (value: string | null | undefined) => {
  const raw = value?.replace(/\D/g, '') || '';
  return normalizeBrazilianPhone(/^(?:[1-9]\d{9}|[1-9]\d{10})$/.test(raw) ? `55${raw}` : raw).replace(/\D/g, '');
};

export const isPhoneDefaultContactName = (name: string | null | undefined, phoneNumber: string | null | undefined) => {
  const nameDigits = canonicalPhoneDigits(name);
  const phoneDigits = canonicalPhoneDigits(phoneNumber);
  if (!nameDigits || !phoneDigits) return false;
  if (nameDigits === phoneDigits) return true;
  if (nameDigits.startsWith('55') && phoneDigits.startsWith('55') && nameDigits.replace(/9/g, '') === phoneDigits.replace(/9/g, '')) return true;
  const withoutOneNine = (value: string) => [...value].flatMap((digit, index) => digit === '9' ? [value.slice(0, index) + value.slice(index + 1)] : []);
  return withoutOneNine(nameDigits).includes(phoneDigits) || withoutOneNine(phoneDigits).includes(nameDigits);
};

export const providerProfileClient = {
  async get(accountId: number, inboxId: number, conversationId: number, transport?: WhatsAppTransport | null, force = false): Promise<{ name?: string; avatarUrl?: string }> {
    if (!bridgeUrl) throw new BridgeApiError(503, null, 'O endereço seguro do bridge não está configurado.');
    const query = new URLSearchParams({ accountId: String(accountId), inboxId: String(inboxId), conversationId: String(conversationId), ...(transport ? { transport } : {}), ...(force ? { force: 'true' } : {}) });
    const response = await fetch(`${bridgeUrl}/contacts/profile?${query}`, { headers: authenticatedBridgeHeaders(accountId) });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new BridgeApiError(response.status, body, body && typeof body === 'object' && typeof body.error === 'string' ? body.error : 'Não foi possível carregar o perfil do contato.');
    return body && typeof body === 'object' ? body as { name?: string; avatarUrl?: string } : {};
  },
};
