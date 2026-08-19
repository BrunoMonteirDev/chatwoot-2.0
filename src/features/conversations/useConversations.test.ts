import { describe, expect, it } from 'vitest';
import type { ConversationSummary } from '../../domain/currentUser';
import { mergeRealtimeConversation } from './useConversations';

const conversation = (overrides: Partial<ConversationSummary> = {}): ConversationSummary => ({
  id: 1, inboxId: 7, channelType: null, contactName: 'Maria', contactId: 17, contactAvatarUrl: null, lastMessage: 'Olá', lastMessageByCurrentUser: false, isGroup: false,
  lastActivityAt: 100, updatedAt: 100, unreadCount: 0, status: 'open', priority: null, assigneeId: null, assigneeName: null, teamId: null, teamName: null, labels: [], ...overrides,
});

describe('mergeRealtimeConversation', () => {
  it('atualiza e reordena a conversa, ignorando evento fora de ordem', () => {
    const current = [conversation({ id: 1, lastActivityAt: 100, updatedAt: 100 }), conversation({ id: 2, lastActivityAt: 150, updatedAt: 150 })];
    const merged = mergeRealtimeConversation(current, conversation({ id: 1, lastActivityAt: 200, updatedAt: 200, status: 'resolved' }), 'todas');
    expect(merged.map(item => item.id)).toEqual([1, 2]);
    expect(merged[0].status).toBe('resolved');
    expect(mergeRealtimeConversation(merged, conversation({ id: 1, updatedAt: 199, status: 'open' }), 'todas')[0].status).toBe('resolved');
  });

  it('não adiciona conversa criada fora da inbox selecionada', () => {
    expect(mergeRealtimeConversation([], conversation({ inboxId: 8 }), '7')).toEqual([]);
  });
});
