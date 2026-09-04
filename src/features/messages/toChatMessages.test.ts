import { describe, expect, it } from 'vitest';
import type { ConversationMessage } from '../../domain/currentUser';
import { toChatMessages } from './toChatMessages';

const baseMessage = (overrides: Partial<ConversationMessage> = {}): ConversationMessage => ({
  id: 12, conversationId: 31, kind: 'incoming', contentType: 'text', content: 'Foto', createdAt: 100, updatedAt: null,
  status: 'sent', senderName: 'Ana', senderAvatarUrl: null, origin: null, attachments: [], sourceId: 'evolution:BAE5',
  contentAttributes: { whatsapp_transport: 'evolution', whatsapp_remote_jid: '5511999999999@s.whatsapp.net', in_reply_to: 4, whatsapp_reactions: [{ sender_id: 'self', emoji: '❤️', transport: 'evolution', origin: 'platform' }] },
  ...overrides,
});

describe('toChatMessages reactions', () => {
  it('mantém reactions e metadados internos em mensagem com reply e attachment', () => {
    const item = baseMessage({ attachments: [{ id: 1, kind: 'image', url: 'https://example.test/a.jpg', thumbnailUrl: null, title: null, contentType: 'image/jpeg', size: 1, width: null, height: null }] });
    const original = baseMessage({ id: 4, content: 'Original', contentAttributes: {} });
    const mapped = toChatMessages([original, item])[1];

    expect(mapped).toMatchObject({
      sourceId: 'evolution:BAE5', whatsappTransport: 'evolution', whatsappRemoteJid: '5511999999999@s.whatsapp.net',
      reactions: [{ senderId: 'self', emoji: '❤️', transport: 'evolution' }], replyTo: { id: '4' }, attachments: [{ type: 'image' }],
    });
  });

  it('usa miniatura e rótulo de foto na citação de uma imagem', () => {
    const original = baseMessage({ id: 4, content: '', contentAttributes: {}, attachments: [{ id: 1, kind: 'image', url: 'https://example.test/photo.jpg', thumbnailUrl: 'https://example.test/thumb.jpg', title: null, contentType: 'image/jpeg', size: 1, width: null, height: null }] });
    const reply = baseMessage({ contentAttributes: { in_reply_to: 4 } });
    expect(toChatMessages([original, reply])[1].replyTo).toMatchObject({ id: '4', text: 'Foto', mediaPreviewUrl: 'https://example.test/thumb.jpg' });
  });

  it('preserva o conteúdo anterior de uma mensagem editada para consulta', () => {
    const item = baseMessage({ content: 'Texto corrigido', contentAttributes: { whatsapp_edited: true, whatsapp_previous_content: 'Texto original' } });
    expect(toChatMessages([item])[0]).toMatchObject({ isEdited: true, whatsappPreviousContent: 'Texto original' });
  });

  it('identifica participante de grupo por JID, mantém cor estável e mostra nome e número', () => {
    const item = baseMessage({ contentAttributes: { whatsapp_participant_jid: '5511999999999@s.whatsapp.net', whatsapp_participant_name: 'Ana' } });
    const [first] = toChatMessages([item]); const [second] = toChatMessages([item]);
    expect(first.senderName).toBe('Ana · +55 11 99999-9999');
    expect(first.senderColor).toBe(second.senderColor);
    expect(first.senderIdentity).toBe('5511999999999@s.whatsapp.net');
  });

  it('nunca expõe LID quando nome e número não estão disponíveis', () => {
    const [item] = toChatMessages([baseMessage({ contentAttributes: { whatsapp_participant_jid: '12345@lid', whatsapp_participant_name: 'Ana' } })]);
    expect(item.senderName).toBe('Ana');
    expect(item.senderIdentity).toBe('12345@lid');
    expect(toChatMessages([baseMessage({ senderName: null, contentAttributes: { whatsapp_participant_jid: '12345@lid' } })])[0].senderName).toBe('Participante');
  });

  it('expõe o marcador normalizado de mensagem encaminhada', () => {
    expect(toChatMessages([baseMessage({ contentAttributes: { whatsapp_is_forwarded: true } })])[0].isForwarded).toBe(true);
    expect(toChatMessages([baseMessage({ contentAttributes: {} })])[0].isForwarded).toBe(false);
  });
});
