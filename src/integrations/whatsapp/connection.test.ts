// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authSession } from '../chatwoot/authSession';
import { canSendWhatsAppMessage, clearWhatsAppCapabilityCache, whatsappConnectionService, whatsappSendCapabilityService } from './connection';
import { chatwootApiClient } from '../chatwoot/client';

describe('operational WhatsApp connection', () => {
  beforeEach(() => {
    sessionStorage.clear();
    authSession.set({ accessToken: 'token', tokenType: 'Bearer', client: 'client', expiry: '1', uid: 'agent@example.test' });
    vi.stubGlobal('fetch', vi.fn());
    clearWhatsAppCapabilityCache();
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('consulta a inbox e mantém o transporte efetivamente selecionado', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ applicable: true, transport: 'meta_cloud', status: 'disconnected', sendAllowed: false }), { status: 200 }));
    await expect(whatsappConnectionService.get(2, 7, 'private')).resolves.toMatchObject({ transport: 'meta_cloud', sendAllowed: false });
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain('/providers/whatsapp/inboxes/7/connection?accountId=2&chatType=private');
  });

  it('bloqueia composer externo offline e mantém nota privada disponível', () => {
    const offline = { applicable: true, transport: 'waha' as const, status: 'disconnected' as const, sendAllowed: false };
    expect(canSendWhatsAppMessage(offline, false)).toBe(false);
    expect(canSendWhatsAppMessage(offline, true)).toBe(true);
    expect(canSendWhatsAppMessage({ applicable: false, sendAllowed: true }, false)).toBe(true);
  });

  it('deduplica e reutiliza capability dentro do TTL', async () => {
    const get = vi.spyOn(chatwootApiClient, 'get').mockResolvedValue({ applicable: true, can_send_message: true } as never);
    await Promise.all([whatsappSendCapabilityService.get(2, 29), whatsappSendCapabilityService.get(2, 29)]);
    await whatsappSendCapabilityService.get(2, 29);
    expect(get).toHaveBeenCalledTimes(1);
  });
});
