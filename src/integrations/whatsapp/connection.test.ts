// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authSession } from '../chatwoot/authSession';
import { canSendWhatsAppMessage, clearWhatsAppCapabilityCache, persistedWhatsAppConnection, whatsappConnectionService, whatsappSendCapabilityService } from './connection';
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

  it('usa o status persistido da inbox ao abrir grupo sem consultar WAHA', () => {
    const inbox = { id: 7, name: 'WAHA', avatarUrl: null, channelType: 'Channel::Api', channelId: null, webhookUrl: null, inboxIdentifier: null, additionalAttributes: { whatsapp_transports: ['waha'], waha_session_name: 'main', waha_connection_status: 'connected' } };
    expect(persistedWhatsAppConnection(inbox, 'group')).toMatchObject({ transport: 'waha', status: 'connected', sendAllowed: true });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('não converte status ausente em desconectado nem bloqueia por desconhecido', () => {
    const inbox = { id: 8, name: 'WAHA', avatarUrl: null, channelType: 'Channel::Api', channelId: null, webhookUrl: null, inboxIdentifier: null, additionalAttributes: { whatsapp_transports: ['waha'], waha_session_name: 'main' } };
    expect(persistedWhatsAppConnection(inbox, 'group')).toMatchObject({ status: 'unknown', sendAllowed: true });
  });

  it('não deixa snapshot desconectado antigo bloquear enquanto bootstrap central atualiza', () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-09-10T12:10:00Z'));
    const inbox = { id: 8, name: 'WAHA', avatarUrl: null, channelType: 'Channel::Api', channelId: null, webhookUrl: null, inboxIdentifier: null, additionalAttributes: { whatsapp_transports: ['waha'], waha_session_name: 'main', waha_connection_status: 'disconnected', waha_connection_updated_at: '2026-09-10T12:00:00Z' } };
    expect(persistedWhatsAppConnection(inbox, 'group')).toMatchObject({ status: 'unknown', sendAllowed: true });
    expect(persistedWhatsAppConnection({ ...inbox, additionalAttributes: { ...inbox.additionalAttributes, waha_connection_updated_at: '2026-09-10T12:09:30Z' } }, 'group')).toMatchObject({ status: 'disconnected', sendAllowed: false });
  });

  it('compartilha consulta central in-flight por conta, inbox e tipo', async () => {
    let resolve!: (value: Response) => void;
    vi.mocked(fetch).mockReturnValue(new Promise<Response>(next => { resolve = next; }));
    const first = whatsappConnectionService.get(2, 9, 'group');
    const second = whatsappConnectionService.get(2, 9, 'group');
    resolve(new Response(JSON.stringify({ applicable: true, transport: 'waha', status: 'connected', sendAllowed: true }), { status: 200 }));
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('deduplica e reutiliza capability dentro do TTL', async () => {
    const get = vi.spyOn(chatwootApiClient, 'get').mockResolvedValue({ applicable: true, can_send_message: true } as never);
    await Promise.all([whatsappSendCapabilityService.get(2, 29), whatsappSendCapabilityService.get(2, 29)]);
    await whatsappSendCapabilityService.get(2, 29);
    expect(get).toHaveBeenCalledTimes(1);
  });
});
