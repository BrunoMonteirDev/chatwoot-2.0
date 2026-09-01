import type { ConversationSummary, Inbox } from '../../domain/currentUser';

export const previousContactConversations = (conversations: ConversationSummary[], currentConversationId: number | null): ConversationSummary[] => (
  conversations
    .filter((conversation) => conversation.id !== currentConversationId)
    .slice()
    .sort((left, right) => right.lastActivityAt - left.lastActivityAt)
);

export const contactConversationHistoryItem = (conversation: ConversationSummary, inboxes: Inbox[]) => ({
  inboxName: inboxes.find((inbox) => inbox.id === conversation.inboxId)?.name || conversation.channelType || 'Canal',
  status: conversation.status,
  lastActivityAt: conversation.lastActivityAt,
  preview: conversation.lastMessage || 'Atendimento iniciado',
});
