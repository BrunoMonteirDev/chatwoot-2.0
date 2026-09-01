import { afterEach, describe, expect, it, vi } from 'vitest';
import { chatwootBridge } from './chatwoot';

afterEach(() => vi.unstubAllGlobals());

describe('chatwootBridge media messages', () => {
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

  it('encaminha uma mensagem histórica WAHA ao endpoint silencioso com timestamp e autor do grupo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 42, created: true }), { status: 201 })));
    await chatwootBridge.importHistoricalWhatsAppMessage(31, {
      sourceId: 'waha:3EB0', transport: 'waha', threadId: '120@g.us', timestamp: 1727745026, content: 'histórico',
      direction: 'incoming', remoteJid: '120@g.us', quotedMessageId: '3EB0Q', status: 'read', mediaType: 'image',
      context: { chatType: 'group', participantJid: '5511999999999@c.us', participantName: 'Ana' },
    });
    const form = (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as FormData;
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain('/whatsapp/conversations/31/history_messages');
    expect(form.get('source_id')).toBe('waha:3EB0');
    expect(form.get('timestamp')).toBe('1727745026');
    expect(form.get('transport')).toBe('waha');
    expect(form.get('quoted_message_id')).toBe('3EB0Q');
    expect(form.get('participant_name')).toBe('Ana');
  });
});
