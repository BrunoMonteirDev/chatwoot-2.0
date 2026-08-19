import { afterEach, describe, expect, it, vi } from 'vitest';
import { chatwootBridge } from './chatwoot';

afterEach(() => vi.unstubAllGlobals());

describe('chatwootBridge media messages', () => {
  it('envia reply recebido à mensagem original pelo source_id Evolution', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 1 }), { status: 200 })));
    await chatwootBridge.createIncomingMessage('inbox', 'whatsapp:5511', 31, 'Resposta do cliente', 'reply-42', 'original-41');
    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    expect(body).toMatchObject({
      source_id: 'evolution:reply-42', echo_id: 'evolution:reply-42',
      content_attributes: { whatsapp_transport: 'evolution', in_reply_to_external_id: 'evolution:original-41', evolution_quoted_message_id: 'original-41' },
    });
  });

  it('preserva reply fromMe como outgoing mobile', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 2 }), { status: 200 })));
    await chatwootBridge.createMobileOutgoingMessage(31, 'Resposta pelo aparelho', 'mobile-reply', 'original-41');
    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    expect(body.content_attributes).toEqual({
      whatsapp_transport: 'evolution', evolution_origin: 'mobile', in_reply_to_external_id: 'evolution:original-41', evolution_quoted_message_id: 'original-41',
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

  it('mantém o reply quando a mensagem recebida é mídia', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 3 }), { status: 200 })));
    await chatwootBridge.createIncomingMediaMessage(31, '', 'media-reply', {
      buffer: Buffer.from('image-bytes'), contentType: 'image/jpeg', fileName: 'foto.jpg',
    }, 'original-media');
    const form = (vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as FormData;
    expect(form.get('content_attributes')).toBe(JSON.stringify({
      whatsapp_transport: 'evolution', in_reply_to_external_id: 'evolution:original-media', evolution_quoted_message_id: 'original-media',
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
});
