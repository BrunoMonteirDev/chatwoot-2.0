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

  it('preserva conteúdo e estado revogado após normalização e mantém replies sem expor o original', () => {
    const revoked = baseMessage({ id: 4, content: 'Conteúdo original', contentAttributes: { whatsapp_revoked: true, whatsapp_previous_content: 'Conteúdo original' } });
    const reply = baseMessage({ id: 5, contentAttributes: { in_reply_to: 4 } });
    const [mapped, mappedReply] = toChatMessages([revoked, reply]);

    expect(mapped).toMatchObject({ isRevoked: true, text: 'Conteúdo original', whatsappPreviousContent: 'Conteúdo original' });
    expect(mappedReply.replyTo).toMatchObject({ id: '4', text: 'Essa mensagem foi excluída' });
  });

  it('identifica participante de grupo por JID, mantém cor estável e mostra somente o nome conhecido', () => {
    const item = baseMessage({ contentAttributes: { whatsapp_remote_jid: '120363@g.us', whatsapp_participant_jid: '5511999999999@s.whatsapp.net', whatsapp_participant_name: 'Ana' } });
    const [first] = toChatMessages([item]); const [second] = toChatMessages([item]);
    expect(first.senderName).toBe('Ana');
    expect(first.senderColor).toBe(second.senderColor);
    expect(first.senderIdentity).toBe('5511999999999@s.whatsapp.net');
  });

  it('usa nome sobre LID e nunca expõe LID bruto como fallback', () => {
    const [item] = toChatMessages([baseMessage({ contentAttributes: { whatsapp_remote_jid: '120363@g.us', whatsapp_participant_jid: '12345@lid', whatsapp_participant_name: 'Ana' } })]);
    expect(item.senderName).toBe('Ana');
    expect(item.senderIdentity).toBe('12345@lid');
    expect(toChatMessages([baseMessage({ senderName: null, contentAttributes: { whatsapp_remote_jid: '120363@g.us', whatsapp_participant_jid: '12345@lid' } })])[0].senderName).toBeUndefined();
  });

  it('não mostra autor em conversa privada e o restaura somente ao voltar a grupo', () => {
    const privateMessage = baseMessage({ senderName: 'Ana', senderPhoneNumber: '+5544999999999', contentAttributes: { whatsapp_remote_jid: '5544999999999@c.us' } });
    expect(toChatMessages([privateMessage])[0].senderName).toBeUndefined();
    expect(toChatMessages([{ ...privateMessage, contentAttributes: { whatsapp_remote_jid: '120363@g.us', whatsapp_participant_phone: '+5544999999999' } }])[0].senderName).toBe('+5544999999999');
  });

  it('nunca usa o nome do grupo e distingue dois participantes da mesma conversa', () => {
    const group = { whatsapp_remote_jid: '120363000000000000@g.us' };
    const messages = toChatMessages([
      baseMessage({ id: 1, senderName: 'Equipe Marketing', contentAttributes: { ...group, whatsapp_participant_jid: '5511999999999@c.us', whatsapp_participant_name: 'Ana' } }),
      baseMessage({ id: 2, senderName: 'Equipe Marketing', contentAttributes: { ...group, whatsapp_participant_jid: '5521999999999@c.us', whatsapp_participant_name: 'Bruno' } }),
      baseMessage({ id: 3, senderName: 'Equipe Marketing', contentAttributes: { ...group, whatsapp_participant_jid: '5531999999999@c.us' } }),
    ]);
    expect(messages.map(message => message.senderName)).toEqual(['Ana', 'Bruno', '+5531999999999']);
    expect(messages.map(message => message.senderName)).not.toContain('Equipe Marketing');
  });

  it('prioriza o Contact sender atual em grupo e mantém o conteúdo original', () => {
    const [message] = toChatMessages([baseMessage({ senderId: 91, senderName: 'Ricardo editado', senderPhoneNumber: '+5544988687221', senderAvatarUrl: 'https://example.test/avatar.jpg', content: 'Mensagem sem prefixo', contentAttributes: { whatsapp_remote_jid: '120363@g.us', whatsapp_participant_jid: '123@lid', whatsapp_participant_name: 'Nome antigo' } })]);
    expect(message).toMatchObject({ senderName: 'Ricardo editado', senderPhone: '+5544988687221', senderIdentity: 'contact:91', senderAvatarUrl: 'https://example.test/avatar.jpg', text: 'Mensagem sem prefixo' });
  });

  it('não aceita o Contact do grupo como autor e usa o alias do participante', () => {
    const [message] = toChatMessages([baseMessage({ senderId: 65, senderName: 'Equipe', senderPhoneNumber: null, contentAttributes: { whatsapp_remote_jid: '120363@g.us', whatsapp_participant_jid: '123@lid', whatsapp_participant_name: 'Ricardo' } })]);
    expect(message.senderName).toBe('Ricardo');
    expect(message.senderIdentity).toBe('123@lid');
  });

  it('expõe o marcador normalizado de mensagem encaminhada', () => {
    expect(toChatMessages([baseMessage({ contentAttributes: { whatsapp_is_forwarded: true } })])[0].isForwarded).toBe(true);
    expect(toChatMessages([baseMessage({ contentAttributes: {} })])[0].isForwarded).toBe(false);
  });
});
