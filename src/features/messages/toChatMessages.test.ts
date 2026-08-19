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
    const item = baseMessage({ attachments: [{ id: 1, kind: 'image', url: 'https://example.test/a.jpg', thumbnailUrl: null, title: null, contentType: 'image/jpeg', size: 1 }] });
    const original = baseMessage({ id: 4, content: 'Original', contentAttributes: {} });
    const mapped = toChatMessages([original, item])[1];

    expect(mapped).toMatchObject({
      sourceId: 'evolution:BAE5', whatsappTransport: 'evolution', whatsappRemoteJid: '5511999999999@s.whatsapp.net',
      reactions: [{ senderId: 'self', emoji: '❤️', transport: 'evolution' }], replyTo: { id: '4' }, attachments: [{ type: 'image' }],
    });
  });
});
