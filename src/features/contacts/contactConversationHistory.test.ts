import { describe, expect, it } from 'vitest';
import type { ConversationSummary, Inbox } from '../../domain/currentUser';
import { contactConversationHistoryItem, previousContactConversations } from './contactConversationHistory';

const conversation = (id: number, inboxId: number, lastActivityAt: number, status = 'resolved'): ConversationSummary => ({
  id, inboxId, channelType: 'Channel::Whatsapp', contactName: 'Maria', contactId: 9, contactAvatarUrl: null,
  lastMessage: `Mensagem ${id}`, lastMessageByCurrentUser: false, lastActivityAt, updatedAt: lastActivityAt,
  unreadCount: 0, status, priority: null, assigneeId: null, assigneeName: null, participantIds: [], teamId: null, teamName: null, labels: [], isGroup: false,
});

const inbox = (id: number, name: string): Inbox => ({ id, name, avatarUrl: null, channelType: 'Channel::Whatsapp', channelId: null, webhookUrl: null, inboxIdentifier: null, additionalAttributes: {} });

describe('contact conversation history', () => {
  it('excludes the current conversation and orders prior conversations by recent activity', () => {
    expect(previousContactConversations([conversation(1, 10, 100), conversation(2, 11, 300), conversation(3, 12, 200)], 2).map((item) => item.id)).toEqual([3, 1]);
  });

  it('provides inbox, status, activity date and preview for each item', () => {
    expect(contactConversationHistoryItem(conversation(3, 12, 200, 'pending'), [inbox(12, 'Suporte')]))
      .toEqual({ inboxName: 'Suporte', status: 'pending', lastActivityAt: 200, preview: 'Mensagem 3' });
  });
});
