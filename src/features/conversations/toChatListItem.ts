import type { ConversationSummary, Inbox } from '../../domain/currentUser';
import type { Chat } from '../../types';

const statusMap: Record<string, Chat['status']> = { open: 'aberta', pending: 'pendente', resolved: 'resolvida', snoozed: 'adiada' };
const priorityMap: Record<string, NonNullable<Chat['priority']>> = { high: 'alta', urgent: 'urgente', medium: 'media', low: 'baixa' };

export const toChatListItem = (conversation: ConversationSummary, inboxes: Inbox[]): Chat => {
  const inbox = inboxes.find((item) => item.id === conversation.inboxId);
  return {
    id: String(conversation.id), name: conversation.contactName, avatar: conversation.contactAvatarUrl || conversation.contactName.slice(0, 2).toUpperCase(),
    avatarType: conversation.contactAvatarUrl ? 'image' : conversation.isGroup ? 'group' : 'initials', avatarBg: '#00a884', isGroup: conversation.isGroup, lastMessage: conversation.lastMessage,
    lastMessageByMe: conversation.lastMessageByCurrentUser, time: new Date(conversation.lastActivityAt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    lastActivityAt: new Date(conversation.lastActivityAt * 1000).toISOString(), unreadCount: conversation.unreadCount,
    channelName: inbox?.name || conversation.channelType || 'Canal', assignedAgent: conversation.assigneeName || undefined,
    responsibleUserIds: [...new Set([...(conversation.participantIds || []), ...(conversation.assigneeId ? [conversation.assigneeId] : [])])],
    teamName: conversation.teamName || undefined, tags: conversation.labels.map((label) => ({ label })),
    unassigned: !conversation.assigneeName, status: statusMap[conversation.status] || 'aberta',
    priority: conversation.priority ? priorityMap[conversation.priority] || 'media' : undefined, messages: [],
  };
};
