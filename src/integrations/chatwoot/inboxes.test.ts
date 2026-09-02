// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authSession } from './authSession';
import { inboxService } from './inboxes';

describe('inboxService', () => {
  beforeEach(() => {
    sessionStorage.clear(); localStorage.clear();
    authSession.set({ accessToken: 'token', tokenType: 'Bearer', client: 'client', expiry: '1', uid: 'agent@example.test' });
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it('usa o endpoint account-scoped e normaliza o envelope payload', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ payload: [{ id: 5, name: 'Vendas', avatar_url: null, channel_type: 'Channel::Api' }] }), { status: 200 }));

    await expect(inboxService.list(12)).resolves.toEqual([{ id: 5, name: 'Vendas', avatarUrl: null, channelType: 'Channel::Api', channelId: null, webhookUrl: null, inboxIdentifier: null, additionalAttributes: {} }]);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/v1/accounts/12/inboxes');
  });

  it('cria Channel::Api e persiste a referência da Evolution no canal', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 5, name: 'WhatsApp', avatar_url: null, channel_type: 'Channel::Api' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 5, name: 'WhatsApp', avatar_url: null, channel_type: 'Channel::Api', additional_attributes: { evolution_provider: 'evolution', evolution_instance_name: 'cw-12-vendas' } }), { status: 200 }));

    await inboxService.createEvolutionInbox(12, { name: 'WhatsApp', webhookUrl: 'https://bridge.example.test/webhooks/chatwoot' });
    await inboxService.saveEvolutionMetadata(12, 5, { evolution_provider: 'evolution', evolution_instance_name: 'cw-12-vendas' }, 'https://bridge.example.test/webhooks/chatwoot');

    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/v1/accounts/12/inboxes');
    expect(vi.mocked(fetch).mock.calls[0][1]).toMatchObject({ body: JSON.stringify({ name: 'WhatsApp', channel: { type: 'api', webhook_url: 'https://bridge.example.test/webhooks/chatwoot' } }) });
    expect(vi.mocked(fetch).mock.calls[1][0]).toBe('/api/v1/accounts/12/inboxes/5');
    expect(vi.mocked(fetch).mock.calls[1][1]).toMatchObject({ method: 'PATCH', body: JSON.stringify({ channel: { additional_attributes: { evolution_provider: 'evolution', evolution_instance_name: 'cw-12-vendas' }, webhook_url: 'https://bridge.example.test/webhooks/chatwoot' } }) });
  });

  it('usa somente o endpoint nativo para criar uma inbox oficial', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ app_id: 'app-id', configuration_id: 'config-id', api_version: 'v22.0' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, id: 8, channel_type: 'whatsapp' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ payload: [{ id: 8, name: 'Oficial', avatar_url: null, channel_type: 'Channel::Whatsapp' }] }), { status: 200 }));

    await expect(inboxService.nativeWhatsAppEmbeddedSignupConfig(12)).resolves.toEqual({ appId: 'app-id', configurationId: 'config-id', graphApiVersion: 'v22.0' });
    await expect(inboxService.createNativeWhatsAppInbox(12, { code: 'code', businessId: 'business', wabaId: 'waba', phoneNumberId: 'phone', onboardingMode: 'coexistence' })).resolves.toMatchObject({ id: 8, channelType: 'Channel::Whatsapp' });

    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/v1/accounts/12/whatsapp/authorization/config');
    expect(vi.mocked(fetch).mock.calls[1][0]).toBe('/api/v1/accounts/12/whatsapp/authorization');
    expect(vi.mocked(fetch).mock.calls[1][1]).toMatchObject({ method: 'POST', body: JSON.stringify({ code: 'code', business_id: 'business', waba_id: 'waba', onboarding_mode: 'coexistence', phone_number_id: 'phone' }) });
    expect(vi.mocked(fetch).mock.calls.filter(call => String(call[0]) === '/api/v1/accounts/12/inboxes' && (call[1] as RequestInit | undefined)?.method === 'POST')).toHaveLength(0);
  });

  it('lista e substitui membros reais da inbox', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 2, name: 'Ana', thumbnail: null }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ payload: [{ id: 2, name: 'Ana', thumbnail: null }] }), { status: 200 }));
    await inboxService.listAgents(12);
    await inboxService.setMembers(12, 5, [2]);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/v1/accounts/12/agents');
    expect(vi.mocked(fetch).mock.calls[1][0]).toBe('/api/v1/accounts/12/inbox_members');
    expect(vi.mocked(fetch).mock.calls[1][1]).toMatchObject({ method: 'PATCH', body: JSON.stringify({ inbox_id: 5, user_ids: [2] }) });
  });

  it('altera o nome da caixa pela API da conta', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ id: 5, name: 'WhatsApp Vendas', avatar_url: null, channel_type: 'Channel::Api' }), { status: 200 }));
    await expect(inboxService.updateName(12, 5, 'WhatsApp Vendas')).resolves.toMatchObject({ id: 5, name: 'WhatsApp Vendas' });
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/v1/accounts/12/inboxes/5');
    expect(vi.mocked(fetch).mock.calls[0][1]).toMatchObject({ method: 'PATCH', body: JSON.stringify({ name: 'WhatsApp Vendas' }) });
  });

  it('adiciona um transport sem apagar o outro ou expor credenciais', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ id: 5, name: 'WhatsApp', avatar_url: null, channel_type: 'Channel::Api', additional_attributes: {} }), { status: 200 }));
    const inbox = { id: 5, name: 'WhatsApp', avatarUrl: null, channelType: 'Channel::Api', channelId: 1, webhookUrl: null, inboxIdentifier: 'token', additionalAttributes: { whatsapp_transports: ['meta_cloud'], meta_waba_id: 'waba', meta_phone_number_id: 'phone' } };
    await inboxService.saveWhatsAppTransport(12, inbox, 'evolution', { evolution_provider: 'evolution', evolution_instance_name: 'cw-x' });
    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    expect(body.channel.additional_attributes).toMatchObject({ whatsapp_mode: 'official', whatsapp_transports: ['meta_cloud', 'evolution'], meta_waba_id: 'waba', evolution_instance_name: 'cw-x' });
    expect(JSON.stringify(body)).not.toContain('accessToken');
  });

  it('exclui a inbox pelo endpoint da conta sem tentar apagar a instância Evolution', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 200 }));
    await expect(inboxService.delete(12, 5)).resolves.toBeUndefined();
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/v1/accounts/12/inboxes/5');
    expect((vi.mocked(fetch).mock.calls[0][1] as RequestInit).method).toBe('DELETE');
  });
});
