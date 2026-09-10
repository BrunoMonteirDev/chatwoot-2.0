import { afterEach, describe, expect, it, vi } from 'vitest';
import { chatwootBridge } from './chatwoot';

afterEach(() => vi.unstubAllGlobals());

describe('chatwootBridge media messages', () => {
  it('descobre dinamicamente todas as accounts da credencial técnica', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ accounts: [{ id: 47 }, { id: 73 }, { id: 47 }, { id: 'invalid' }] }), { status: 200 })));
    await expect(chatwootBridge.listServiceAccountIds()).resolves.toEqual([47, 73]);
    expect(vi.mocked(fetch).mock.calls.at(-1)?.[0]).toContain('/api/v1/profile');
  });

  it('lista inboxes pelo endpoint estritamente account-scoped', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ payload: [{ id: 608, channel_type: 'Channel::Api' }] }), { status: 200 })));
    await expect(chatwootBridge.listAccountInboxes(47)).resolves.toEqual([{ id: 608, channel_type: 'Channel::Api' }]);
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain('/api/v1/accounts/47/inboxes');
  });

  it('corrige o callback WAHA da inbox no escopo da account sem hardcode de domínio', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ payload: [{ id: 608, channel_type: 'Channel::Api', webhook_url: 'http://unreachable.invalid/webhooks/chatwoot' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 608 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(chatwootBridge.withAccount(47, () => chatwootBridge.ensureApiInboxWebhook(608, 'http://docker-gateway.test:3100/webhooks/chatwoot'))).resolves.toBe(true);

    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/v1/accounts/47/inboxes');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/api/v1/accounts/47/inboxes/608');
    expect(JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string)).toEqual({ channel: { webhook_url: 'http://docker-gateway.test:3100/webhooks/chatwoot' } });
  });

  it('não regrava callback WAHA que já está correto', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ payload: [{ id: 608, channel_type: 'Channel::Api', webhook_url: 'https://bridge.synthetic.example/webhooks/chatwoot' }] }), { status: 200 })));
    await expect(chatwootBridge.withAccount(47, () => chatwootBridge.ensureApiInboxWebhook(608, 'https://bridge.synthetic.example/webhooks/chatwoot'))).resolves.toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('descobre somente grupos persistidos da inbox e pagina sem misturar contas/inboxes', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { payload: [
        { id: 1, inbox_id: 20, status: 'open', meta: { sender: { id: 55, name: 'Pendente', additional_attributes: {} } }, contact_inbox: { source_id: 'legacy-uuid' }, messages: [{ content_attributes: { whatsapp_remote_jid: '222@g.us' } }] },
        { id: 2, inbox_id: 21, status: 'open', meta: { sender: { id: 56, name: 'Outra inbox', additional_attributes: { whatsapp_group_jid: '333@g.us' } } } },
        { id: 3, inbox_id: 20, status: 'open', meta: { sender: { id: 57, name: 'Privado' } }, contact_inbox: { source_id: 'whatsapp:5511999999999' } },
      ] } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { payload: [{ id: 4, inbox_id: 20, status: 'open', meta: { sender: { id: 58, name: 'Sincronizado', additional_attributes: { whatsapp_group_jid: '444@g.us', whatsapp_group_participants: [{ jid: '1@lid' }], whatsapp_group_metadata_synced_at: '2026-01-01T00:00:00.000Z' } } } }] } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { payload: [] } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(chatwootBridge.withAccount(7, () => chatwootBridge.listPersistedGroupContacts(20))).resolves.toEqual([
      expect.objectContaining({ contactId: 55, groupJid: '222@g.us', participants: [] }),
      expect.objectContaining({ contactId: 58, groupJid: '444@g.us', participants: [{ jid: '1@lid' }], syncedAt: '2026-01-01T00:00:00.000Z' }),
    ]);
    expect(fetchMock.mock.calls.every(call => String(call[0]).includes('/accounts/7/conversations?inbox_id=20'))).toBe(true);
  });

  it('aceita uma API inbox WAHA no lookup account-scoped de grupos', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ payload: [{ id: 5, channel_type: 'Channel::Api', inbox_identifier: 'api-5', additional_attributes: { whatsapp_transports: ['waha'], waha_session_name: 'web-5' } }] }), { status: 200 })));
    await expect(chatwootBridge.findWhatsAppInboxByIdForSession(1, 5, new Headers())).resolves.toMatchObject({ id: 5, configuration: { transports: ['waha'], wahaSessionName: 'web-5' } });
  });

  it('aceita uma inbox Meta nativa somente com configuração híbrida WAHA server-side', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ payload: [{ id: 5, channel_type: 'Channel::Whatsapp', additional_attributes: { hybrid_enabled: true, hybrid_waha_session: 'hybrid-a1-i5' } }] }), { status: 200 })));
    await expect(chatwootBridge.findWhatsAppInboxByIdForSession(1, 5, new Headers())).resolves.toMatchObject({ id: 5, configuration: { mode: 'hybrid', transports: ['meta_cloud', 'waha'], wahaSessionName: 'hybrid-a1-i5' } });
  });

  it('rejeita Meta nativa sem binding híbrido e nunca consulta provider', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ payload: [{ id: 5, channel_type: 'Channel::Whatsapp', additional_attributes: { hybrid_enabled: false } }] }), { status: 200 })));
    await expect(chatwootBridge.findWhatsAppInboxByIdForSession(1, 5, new Headers())).rejects.toThrow('não possui WAHA híbrido');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('não encontra inbox pertencente a outra account no payload account-scoped', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ payload: [{ id: 9, channel_type: 'Channel::Whatsapp', additional_attributes: { hybrid_enabled: true, hybrid_waha_session: 'other' } }] }), { status: 200 })));
    await expect(chatwootBridge.findWhatsAppInboxByIdForSession(1, 5, new Headers())).rejects.toThrow('não pertence a esta conta');
  });

  it('resolve o contato com a sessão do usuário e preserva o escopo de account/inbox', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 66, inbox_id: 5, meta: { sender: { id: 8, name: 'Bruno', phone_number: '+554484532595' } }, contact_inbox: { source_id: '554484532595' },
    }), { status: 200 })));
    await expect(chatwootBridge.conversationContactTargetForSession(1, 66, 5, new Headers({ uid: 'agent@example.test' }))).resolves.toMatchObject({ contactId: 8, phoneNumber: '+554484532595', name: 'Bruno' });
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain('/api/v1/accounts/1/conversations/66');
  });

  it('bloqueia conversa de outra inbox no lookup de perfil autenticado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 66, inbox_id: 9 }), { status: 200 })));
    await expect(chatwootBridge.conversationContactTargetForSession(1, 66, 5, new Headers())).rejects.toThrow('não pertence à inbox');
  });

  it('resolve o JID do grupo pelo contato quando o serializer da conversa omite contact_inbox', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 81, inbox_id: 5, meta: { sender: { id: 65, name: 'Equipe' } } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ payload: { id: 65, contact_inboxes: [{ source_id: 'whatsapp:group:120363@g.us', inbox: { id: 5 } }] } }), { status: 200 })));
    await expect(chatwootBridge.conversationGroupTargetDetailsForSession(1, 81, 5, new Headers())).resolves.toMatchObject({ groupJid: '120363@g.us', contactId: 65 });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('reutiliza Contact da mesma account pelo telefone e preserva o nome editado', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => url.includes('/bridge/access_token')
      ? Promise.resolve(new Response(JSON.stringify({ api_access_token: 'service-token' }), { status: 200 }))
      : Promise.resolve(new Response(JSON.stringify({ payload: [{ id: 44, name: 'João editado', phone_number: '+5544999999999', thumbnail: 'manual.jpg' }] }), { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);
    await expect(chatwootBridge.withAccount(1, () => chatwootBridge.findOrCreateGroupParticipantContact(5, { phoneNumber: '+5544999999999', name: 'Nome WAHA', avatarUrl: 'waha.jpg' })))
      .resolves.toMatchObject({ id: 44, name: 'João editado', avatarUrl: 'manual.jpg', existing: true });
    expect(fetchMock.mock.calls.some(call => String(call[0]).endsWith('/contacts'))).toBe(false);
  });

  it('cria Contact account-scoped somente quando o telefone ainda não existe', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => url.includes('/contacts/search')
      ? Promise.resolve(new Response(JSON.stringify({ payload: [] }), { status: 200 }))
      : Promise.resolve(new Response(JSON.stringify({ payload: { contact: { id: 45, name: 'Maria', phone_number: '+5544888888888' }, existing: false } }), { status: 200 })));
    vi.stubGlobal('fetch', fetchMock);
    await expect(chatwootBridge.withAccount(2, () => chatwootBridge.findOrCreateGroupParticipantContact(7, { phoneNumber: '+5544888888888', name: 'Maria' })))
      .resolves.toMatchObject({ id: 45, name: 'Maria', existing: false });
    expect(fetchMock.mock.calls.every(call => String(call[0]).includes('/accounts/2/'))).toBe(true);
    const createCall = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'POST');
    expect(createCall).toBeDefined();
    expect(JSON.parse((createCall?.[1] as RequestInit).body as string)).toMatchObject({ inbox_id: 7, phone_number: '+5544888888888' });
  });

  it('reconsulta e reutiliza Contact quando duas sincronizações criam o mesmo telefone', async () => {
    const empty = new Response(JSON.stringify({ payload: [] }), { status: 200 });
    const found = new Response(JSON.stringify({ payload: [{ id: 46, name: 'Maria existente', phone_number: '+554484532595' }] }), { status: 200 });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(empty.clone()).mockResolvedValueOnce(empty.clone())
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'Phone number has already been taken' }), { status: 422 }))
      .mockResolvedValueOnce(found.clone()).mockResolvedValueOnce(found.clone());
    vi.stubGlobal('fetch', fetchMock);
    await expect(chatwootBridge.withAccount(2, () => chatwootBridge.findOrCreateGroupParticipantContact(7, { phoneNumber: '+554484532595', name: 'Maria' })))
      .resolves.toMatchObject({ id: 46, name: 'Maria existente', existing: true });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('reutiliza por E.164 exato no quick create e preserva o Contact existente', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ payload: [{ id: 77, name: 'Nome editado', phone_number: '+5544999999999', thumbnail: 'avatar.jpg', custom_attributes: { vip: true } }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(chatwootBridge.createOrFindContactForSession(3, { name: 'Novo nome', phoneNumber: '5544999999999' }, new Headers({ uid: 'agent@example.test' }))).resolves.toMatchObject({ id: 77, name: 'Nome editado', avatarUrl: 'avatar.jpg', existing: true });
    expect(fetchMock).toHaveBeenCalledTimes(1); expect(String(fetchMock.mock.calls[0][0])).toContain('/accounts/3/contacts/search');
  });

  it('não une por telefone parcial ao criar Contact', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ payload: [{ id: 70, name: 'Outro', phone_number: '+5511999999999' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ payload: { contact: { id: 78, name: 'Novo', phone_number: '+5544999999999' }, existing: false } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(chatwootBridge.createOrFindContactForSession(3, { name: 'Novo', phoneNumber: '5544999999999' }, new Headers())).resolves.toMatchObject({ id: 78, existing: false });
    expect(JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string)).toEqual({ name: 'Novo', phone_number: '+5544999999999' });
  });

  it('cria uma única Conversation account+inbox+groupJid e persiste o subject', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url.includes('/bridge/access_token')) return Promise.resolve(new Response(JSON.stringify({ api_access_token: 'service-token' }), { status: 200 }));
      if (url.endsWith('/contacts') && init?.method === 'POST') return Promise.resolve(new Response(JSON.stringify({ payload: { contact: { id: 55, name: 'Equipe' } } }), { status: 200 }));
      if (url.includes('/contacts/55/conversations')) return Promise.resolve(new Response(JSON.stringify({ payload: [] }), { status: 200 }));
      if (url.endsWith('/conversations') && init?.method === 'POST') return Promise.resolve(new Response(JSON.stringify({ id: 91, inbox_id: 20, meta: { sender: { id: 55 } } }), { status: 200 }));
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(chatwootBridge.withAccount(1, () => chatwootBridge.ensureGroupConversation(20, '120363@g.us', 'Equipe real', 'waha'))).resolves.toMatchObject({ conversationId: 91, contactId: 55, sourceId: 'whatsapp:group:120363@g.us' });
    const conversationCreates = fetchMock.mock.calls.filter(([url, init]) => String(url).endsWith('/conversations') && (init as RequestInit)?.method === 'POST');
    expect(conversationCreates).toHaveLength(1); expect(JSON.parse((conversationCreates[0][1] as RequestInit).body as string)).toMatchObject({ inbox_id: 20, contact_id: 55, source_id: 'whatsapp:group:120363@g.us', idempotent: true });
    const contactPatch = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith('/contacts/55') && (init as RequestInit)?.method === 'PATCH');
    expect(JSON.parse((contactPatch?.[1] as RequestInit).body as string)).toMatchObject({ name: 'Equipe real', additional_attributes: { whatsapp_group_jid: '120363@g.us', whatsapp_group_transport: 'waha' } });
  });

  it('reutiliza a conversa da mesma inbox quando o contato foi criado manualmente', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ payload: [
      { id: 86, inbox_id: 106, status: 'open', last_activity_at: 100 },
    ] }), { status: 200 })));

    await expect(chatwootBridge.findOrCreateConversation('inbox-token', 'whatsapp:554484532595', 4, 106))
      .resolves.toMatchObject({ id: 86 });
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain('/contacts/4/conversations');
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it('reconsulta a API autenticada depois de criar a conversa pública para usar o ID interno', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ payload: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 19 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ payload: [{ id: 87, inbox_id: 106 }] }), { status: 200 })));

    await expect(chatwootBridge.findOrCreateConversation('inbox-token', 'whatsapp:554484532595', 4, 106)).resolves.toMatchObject({ id: 87 });
    expect(vi.mocked(fetch).mock.calls[1][0]).toContain('/contacts/whatsapp%3A554484532595/conversations');
    expect(JSON.parse((vi.mocked(fetch).mock.calls[1][1] as RequestInit).body as string)).toEqual({ idempotent: true });
    expect(vi.mocked(fetch).mock.calls[2][0]).toContain('/contacts/4/conversations');
  });

  it('escapa o ponto de um source id de grupo para a rota pública do Chatwoot', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ payload: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 19 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ payload: [{ id: 87, inbox_id: 106 }] }), { status: 200 })));

    await chatwootBridge.findOrCreateConversation('inbox-token', 'whatsapp:group:120363@g.us', 4, 106);

    expect(vi.mocked(fetch).mock.calls[1][0])
      .toContain('/contacts/whatsapp%3Agroup%3A120363%40g%2Eus/conversations');
  });

  it('encontra o source id da inbox no formato atual da API do Chatwoot', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ payload: [{
      id: 4, phone_number: '+554484532595', contact_inboxes: [
        { source_id: 'source-outra-inbox', inbox: { id: 2 } },
        { source_id: 'source-inbox-whatsapp', inbox: { id: 106 } },
      ],
    }] }), { status: 200 })));

    await expect(chatwootBridge.findContactSourceByPhone(106, '+554484532595'))
      .resolves.toBe('source-inbox-whatsapp');
  });

  it('busca o contato brasileiro pelo número canônico mesmo quando recebe o nono dígito', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ payload: [{
      id: 4, phone_number: '+554484532595', contact_inboxes: [{ source_id: 'source-inbox-whatsapp', inbox: { id: 106 } }],
    }] }), { status: 200 })));

    await expect(chatwootBridge.findContactSourceByPhone(106, '+5544984532595'))
      .resolves.toBe('source-inbox-whatsapp');
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain('q=%2B5544');
  });

  it('atualiza perfil WAHA existente sem perder a codificação de JID de grupo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 4 }), { status: 200 })));
    await chatwootBridge.updatePublicContact('inbox-token', 'whatsapp:group:120@g.us', { name: 'Equipe', avatarUrl: 'https://pps.whatsapp.net/avatar.jpg' });
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain('/contacts/whatsapp%3Agroup%3A120%40g%2Eus');
    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({ name: 'Equipe', avatar_url: 'https://pps.whatsapp.net/avatar.jpg' });
  });

  it('persiste somente os campos de perfil resolvidos no contato interno', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ payload: { id: 4 } }), { status: 200 })));
    await chatwootBridge.saveContactProfile(4, { avatarUrl: 'https://pps.whatsapp.net/avatar.jpg' });
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain('/contacts/4');
    expect(JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string)).toEqual({ avatar_url: 'https://pps.whatsapp.net/avatar.jpg' });
  });

  it('envia reply recebido à mensagem original pelo source_id Evolution', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 1 }), { status: 200 })));
    await chatwootBridge.createIncomingMessage('inbox', 'whatsapp:5511', 31, 'Resposta do cliente', 'reply-42', 'original-41', undefined, undefined, 19);
    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    expect(body).toMatchObject({
      source_id: 'evolution:reply-42', echo_id: 'evolution:reply-42',
      idempotent: true,
      content_attributes: { whatsapp_transport: 'evolution', in_reply_to: 19, in_reply_to_external_id: 'evolution:original-41', evolution_quoted_message_id: 'original-41' },
    });
  });

  it('envia o Contact participante como sender sem alterar o conteúdo do grupo', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ api_access_token: 'service-token', account_id: 1 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 1 }), { status: 200 })));
    await chatwootBridge.withAccount(1, () => chatwootBridge.createIncomingTransportMessage('inbox', 'group', 31, 'waha', 'Mensagem original', 'message-1', undefined, '120363@g.us', undefined, { chatType: 'group', participantJid: '123@lid', participantContactId: 91 }));
    const body = JSON.parse((vi.mocked(fetch).mock.calls.at(-1)?.[1] as RequestInit).body as string);
    expect(body).toMatchObject({ content: 'Mensagem original', message_type: 'incoming', sender_type: 'Contact', sender_id: 91, content_attributes: { whatsapp_participant_contact_id: 91 } });
    expect(body.content).not.toContain('Ricardo');
  });

  it('preserva reply fromMe como outgoing mobile', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 2 }), { status: 200 })));
    await chatwootBridge.createMobileOutgoingMessage(31, 'Resposta pelo aparelho', 'mobile-reply', 'original-41', undefined, undefined, 19);
    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    expect(body.content_attributes).toEqual({
      whatsapp_transport: 'evolution', evolution_origin: 'mobile', in_reply_to: 19, in_reply_to_external_id: 'evolution:original-41', evolution_quoted_message_id: 'original-41',
    });
  });

  it('cria attachment incoming multipart com nome, MIME e IDs externos', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 1 }), { status: 200 })));
    await chatwootBridge.createIncomingMediaMessage(31, 'Legenda', 'media-42', {
      buffer: Buffer.from('image-bytes'), contentType: 'image/jpeg', fileName: 'foto.jpg',
    });
    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    const form = init.body as FormData;
    expect(init.method).toBe('POST');
    expect(new Headers(init.headers).get('Content-Type')).toBeNull();
    expect(form.get('content')).toBe('Legenda');
    expect(form.get('message_type')).toBe('incoming');
    expect(form.get('source_id')).toBe('evolution:media-42');
    expect(form.get('idempotent')).toBe('true');
    expect((form.get('attachments[]') as File).name).toBe('foto.jpg');
    expect((form.get('attachments[]') as File).type).toBe('image/jpeg');
  });

  it('cria mídia fromMe como outgoing mobile, que o webhook de saída ignora', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 2 }), { status: 200 })));
    await chatwootBridge.createMobileOutgoingMediaMessage(31, '', 'mobile-media', {
      buffer: Buffer.from('audio-bytes'), contentType: 'audio/ogg', fileName: 'audio.ogg',
    });
    const form = (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as FormData;
    expect(form.get('message_type')).toBe('outgoing');
    expect(form.get('source_id')).toBe('evolution:mobile-media');
    expect(form.get('content_attributes')).toBe(JSON.stringify({ whatsapp_transport: 'evolution', evolution_origin: 'mobile' }));
  });

  it('marca mídia WAHA enviada pelo celular como saída mobile', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 2 }), { status: 200 })));
    await chatwootBridge.createMobileOutgoingTransportMediaMessage(31, 'waha', '', 'mobile-waha-media', {
      buffer: Buffer.from('audio-bytes'), contentType: 'audio/ogg', fileName: 'audio.ogg',
    });
    const form = (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as FormData;
    expect(form.get('message_type')).toBe('outgoing');
    expect(form.get('source_id')).toBe('waha:mobile-waha-media');
    expect(form.get('content_attributes')).toBe(JSON.stringify({ whatsapp_transport: 'waha', whatsapp_origin: 'mobile' }));
    expect(form.get('idempotent')).toBe('true');
  });

  it('mantém o reply quando a mensagem recebida é mídia', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 3 }), { status: 200 })));
    await chatwootBridge.createIncomingMediaMessage(31, '', 'media-reply', {
      buffer: Buffer.from('image-bytes'), contentType: 'image/jpeg', fileName: 'foto.jpg',
    }, 'original-media', undefined, undefined, 19);
    const form = (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as FormData;
    expect(form.get('content_attributes')).toBe(JSON.stringify({
      whatsapp_transport: 'evolution', in_reply_to: 19, in_reply_to_external_id: 'evolution:original-media', evolution_quoted_message_id: 'original-media',
    }));
  });

  it('vincula uma mensagem enviada pela plataforma ao ID Evolution real para receber reactions', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 42 }), { status: 200 })));
    await chatwootBridge.updateWhatsAppMessageTransport(31, 42, {
      sourceId: 'evolution:BAE5', transport: 'evolution', remoteJid: '5511999999999@s.whatsapp.net', fromMe: true,
    });
    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain('/conversations/31/messages/42/whatsapp_transport_metadata');
    expect(JSON.parse(init.body as string)).toEqual({ source_id: 'evolution:BAE5', transport: 'evolution', remote_jid: '5511999999999@s.whatsapp.net', from_me: true });
  });

  it('persiste reaction na mensagem Evolution alvo sem criar uma nova mensagem', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 42 }), { status: 200 })));
    await chatwootBridge.updateWhatsAppReaction(31, 'evolution:BAE5', {
      senderId: 'contact:5511999999999', emoji: '👍', transport: 'evolution', origin: 'contact', eventId: 'event-1',
    });
    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain('/conversations/31/messages/whatsapp_reaction');
    expect(JSON.parse(init.body as string)).toEqual({ source_id: 'evolution:BAE5', reaction: { sender_id: 'contact:5511999999999', emoji: '👍', transport: 'evolution', origin: 'contact', event_id: 'event-1' } });
  });

  it('escopa edit e revoke pelo inbox real ao persistir mutações externas', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => new Response(JSON.stringify({ id: 42, content: 'Original', content_attributes: {} }), { status: 200 })));

    await chatwootBridge.withAccount(47, () => chatwootBridge.editWhatsAppMessageBySourceId(608, 'waha:SYNTHETIC', 'Corrigida'));
    await chatwootBridge.withAccount(47, () => chatwootBridge.revokeWhatsAppMessageBySourceId(608, 'waha:SYNTHETIC'));

    const editBody = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    const revokeBody = JSON.parse((vi.mocked(fetch).mock.calls[1][1] as RequestInit).body as string);
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain('/api/v1/accounts/47/whatsapp/messages/edit');
    expect(editBody).toEqual({ inbox_id: 608, source_id: 'waha:SYNTHETIC', content: 'Corrigida' });
    expect(revokeBody).toEqual({ inbox_id: 608, source_id: 'waha:SYNTHETIC' });
  });

  it('encaminha uma mensagem histórica WAHA ao endpoint silencioso com timestamp e autor do grupo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 42, created: true }), { status: 201 })));
    await chatwootBridge.withAccount(1, () => chatwootBridge.importHistoricalWhatsAppMessage(31, {
      sourceId: 'waha:3EB0', transport: 'waha', threadId: '120@g.us', timestamp: 1727745026, content: 'histórico',
      direction: 'incoming', remoteJid: '120@g.us', quotedMessageId: '3EB0Q', status: 'read', mediaType: 'image',
      context: { chatType: 'group', participantJid: '5511999999999@c.us', participantName: 'Ana' },
    }));
    const form = (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as FormData;
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain('/whatsapp/conversations/31/history_messages');
    expect(form.get('source_id')).toBe('waha:3EB0');
    expect(form.get('timestamp')).toBe('1727745026');
    expect(form.get('transport')).toBe('waha');
    expect(form.get('quoted_message_id')).toBe('3EB0Q');
    expect(form.get('participant_name')).toBe('Ana');
  });
});
