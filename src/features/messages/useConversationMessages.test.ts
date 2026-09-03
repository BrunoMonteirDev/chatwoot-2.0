import { describe, expect, it } from 'vitest';
import type { ConversationMessage } from '../../domain/currentUser';
import { mergeRealtimeMessage, optimisticReactionList, PendingMessageFiles, usesRailsReaction } from './useConversationMessages';

const message = (overrides: Partial<ConversationMessage> = {}): ConversationMessage => ({
  id: 10, conversationId: 31, kind: 'outgoing', contentType: 'text', content: 'Olá', createdAt: 100,
  status: 'sending', echoId: 'echo-1', updatedAt: null, senderName: null, senderAvatarUrl: null, origin: 'platform', attachments: [], contentAttributes: {}, ...overrides,
});

describe('mergeRealtimeMessage', () => {
  it('reconcilia uma mensagem otimista pelo echo_id sem duplicar', () => {
    const merged = mergeRealtimeMessage([message({ id: -1 })], message({ id: 99, status: 'sent' }));
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ id: 99, status: 'sent' });
  });

  it('ignora duplicatas por id e mantém a ordenação ao receber outra mensagem', () => {
    const first = message({ id: 99, echoId: undefined, status: 'sent' });
    const duplicate = mergeRealtimeMessage([first], first);
    const withEarlier = mergeRealtimeMessage(duplicate, message({ id: 98, echoId: undefined, createdAt: 90 }));
    expect(withEarlier).toHaveLength(2);
    expect(withEarlier.map(item => item.id)).toEqual([98, 99]);
  });

  it('troca e remove apenas a reaction do próprio atendente', () => {
    const initial = [{ sender_id: 'self', emoji: '❤️', transport: 'evolution', origin: 'platform' }, { sender_id: 'contact:5511', emoji: '👍', transport: 'evolution', origin: 'contact' }];
    expect(optimisticReactionList(initial, 'evolution', '😂')).toEqual([
      { sender_id: 'contact:5511', emoji: '👍', transport: 'evolution', origin: 'contact' },
      { sender_id: 'self', emoji: '😂', transport: 'evolution', origin: 'platform' },
    ]);
    expect(optimisticReactionList(initial, 'evolution', '❤️')).toEqual([
      { sender_id: 'contact:5511', emoji: '👍', transport: 'evolution', origin: 'contact' },
    ]);
  });

  it('mantém anexos originais disponíveis para o retry pelo echo_id', () => {
    const pending = new PendingMessageFiles();
    const audio = new File(['audio'], 'nota.ogg', { type: 'audio/ogg; codecs=opus' });

    pending.save('echo-audio', [audio]);
    expect(pending.get('echo-audio')).toEqual([audio]);
    pending.delete('echo-audio');
    expect(pending.get('echo-audio')).toEqual([]);
  });

  it('envia somente reactions WAHA de inbox oficial Hybrid ao Rails', () => {
    expect(usesRailsReaction('waha', 'Channel::Whatsapp')).toBe(true);
    expect(usesRailsReaction('waha', 'Channel::Api')).toBe(false);
    expect(usesRailsReaction('evolution', 'Channel::Whatsapp')).toBe(false);
  });
});
