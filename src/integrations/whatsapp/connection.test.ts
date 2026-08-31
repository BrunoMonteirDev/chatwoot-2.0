// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authSession } from '../chatwoot/authSession';
import { canSendWhatsAppMessage, whatsappConnectionService } from './connection';

describe('operational WhatsApp connection', () => {
  beforeEach(() => {
    sessionStorage.clear();
    authSession.set({ accessToken: 'token', tokenType: 'Bearer', client: 'client', expiry: '1', uid: 'agent@example.test' });
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

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
});
