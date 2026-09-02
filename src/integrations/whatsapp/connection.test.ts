// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authSession } from '../chatwoot/authSession';
import { canSendWhatsAppMessage, whatsappConnectionService } from './connection';
import type { Inbox } from '../../domain/currentUser';

const nativeMetaInbox: Inbox = { id: 5, name: 'Meta', avatarUrl: null, channelType: 'Channel::Whatsapp', channelId: 5, webhookUrl: null, inboxIdentifier: null, additionalAttributes: {} };

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

  it('uses native Meta state without preflighting the bridge', async () => {
    await expect(whatsappConnectionService.getForInbox(1, nativeMetaInbox)).resolves.toEqual({ applicable: true, transport: 'meta_cloud', status: 'connected', sendAllowed: true });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('blocks external sends for disconnected native Meta while retaining private notes', async () => {
    const disconnected = { ...nativeMetaInbox, additionalAttributes: { meta_connection_status: 'disconnected' } };
    const connection = await whatsappConnectionService.getForInbox(1, disconnected);
    expect(connection).toMatchObject({ transport: 'meta_cloud', status: 'disconnected', sendAllowed: false });
    expect(canSendWhatsAppMessage(connection, false)).toBe(false);
    expect(canSendWhatsAppMessage(connection, true)).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });
});
