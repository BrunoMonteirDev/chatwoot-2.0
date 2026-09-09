import type { ContactProfile, ConversationMessage, ConversationSummary } from '../../domain/currentUser';

export const contactForConversation = (contact: ContactProfile | null, conversation: ConversationSummary | null) =>
  contact && conversation?.contactId === contact.id ? contact : null;

export const messagesForConversation = (messages: ConversationMessage[], conversationId: number | null) =>
  conversationId ? messages.filter(message => message.conversationId === conversationId) : [];

export const conversationVisualKey = (accountId: number | null, conversation: ConversationSummary | null, groupJid?: string | null) =>
  `${accountId || ''}:${conversation?.inboxId || ''}:${conversation?.id || ''}:${groupJid || ''}`;

export const isCurrentHeaderResponse = (activeKey: string, requestKey: string, expectedGroupJid?: string | null, responseGroupJid?: string) =>
  activeKey === requestKey && (!expectedGroupJid || !responseGroupJid || expectedGroupJid === responseGroupJid);
