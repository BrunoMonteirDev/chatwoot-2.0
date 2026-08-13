import { describe, expect, it } from 'vitest';
import type { ConversationMessage } from '../../domain/currentUser';
import { mergeRealtimeMessage } from './useConversationMessages';

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
});
