import { describe, expect, it } from 'vitest';
import type { ConversationSummary } from '../../domain/currentUser';
import { conversationForActiveRoute } from './directConversation';

const conversation = (id: number): ConversationSummary => ({ id, inboxId: 7, channelType: null, contactName: 'Maria', contactId: 9, contactAvatarUrl: null, lastMessage: 'Olá', lastMessageByCurrentUser: false, lastActivityAt: 100, updatedAt: 100, unreadCount: 0, status: 'open', priority: null, assigneeId: null, assigneeName: null, participantIds: [], teamId: null, teamName: null, labels: [], isGroup: false });

describe('conversationForActiveRoute', () => {
  it('uses a directly loaded conversation when it is outside the current list page', () => {
    expect(conversationForActiveRoute([conversation(1)], conversation(99), '99')?.id).toBe(99);
  });

  it('keeps a directly loaded conversation open when active filters exclude it from the list', () => {
    const filteredList = [conversation(1)];
    expect(conversationForActiveRoute(filteredList, conversation(99), '99')?.id).toBe(99);
  });
});
