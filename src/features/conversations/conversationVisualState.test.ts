import { describe, expect, it } from 'vitest';
import type { ContactProfile, ConversationMessage, ConversationSummary } from '../../domain/currentUser';
import { contactForConversation, conversationVisualKey, isCurrentHeaderResponse, messagesForConversation } from './conversationVisualState';

const conversation = (id: number, contactId: number): ConversationSummary => ({ id, contactId, inboxId: 5, channelType: 'Channel::Api', contactName: `Conversa ${id}`, contactAvatarUrl: null, lastMessage: '', lastMessageByCurrentUser: false, lastActivityAt: 1, updatedAt: 1, unreadCount: 0, status: 'open', priority: null, assigneeId: null, assigneeName: null, participantIds: [], teamId: null, teamName: null, labels: [], isGroup: false });
const contact = (id: number): ContactProfile => ({ id, name: `Contato ${id}`, avatarUrl: `${id}.jpg`, phoneNumber: null, email: null, identifier: null, companyName: null, city: null, country: null, blocked: false, lastActivityAt: null, createdAt: null, additionalAttributes: {}, customAttributes: {} });
const message = (conversationId: number): ConversationMessage => ({ id: conversationId, conversationId, kind: 'incoming', contentType: 'text', content: '', createdAt: 1, updatedAt: null, status: 'sent', senderName: null, senderAvatarUrl: null, origin: null, attachments: [], contentAttributes: {} });

describe('conversation visual state', () => {
  it('makes a previous contact ineligible synchronously after conversation changes', () => {
    expect(contactForConversation(contact(10), conversation(1, 10))?.id).toBe(10);
    expect(contactForConversation(contact(10), conversation(2, 20))).toBeNull();
  });

  it('never exposes messages from the previous conversation during a transition', () => {
    expect(messagesForConversation([message(1)], 2)).toEqual([]);
  });

  it('rejects late header responses by account, inbox, conversation and group JID', () => {
    const active = conversationVisualKey(1, conversation(3, 30), null);
    expect(isCurrentHeaderResponse(active, conversationVisualKey(1, conversation(2, 20), 'b@g.us'), 'b@g.us', 'b@g.us')).toBe(false);
    const groupB = conversationVisualKey(1, conversation(2, 20), 'b@g.us');
    expect(isCurrentHeaderResponse(groupB, groupB, 'b@g.us', 'a@g.us')).toBe(false);
    expect(isCurrentHeaderResponse(groupB, groupB, 'b@g.us', 'b@g.us')).toBe(true);
  });
});
