import type { ConversationMessage } from '../../domain/currentUser';
import type { Attachment, Message } from '../../types';

const dateLabel = (timestamp: number) => new Date(timestamp * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const formatSize = (size: number | null) => size ? `${(size / 1024 / 1024).toFixed(size >= 1024 * 1024 ? 1 : 2)} MB` : undefined;

const toAttachment = (attachment: ConversationMessage['attachments'][number]): Attachment => ({
  id: String(attachment.id),
  type: attachment.kind === 'video' ? 'video' : attachment.kind === 'image' || attachment.kind === 'audio' || attachment.kind === 'file' ? attachment.kind : 'file',
  url: attachment.url,
  previewUrl: attachment.thumbnailUrl || undefined,
  title: attachment.title || undefined,
  subtitle: attachment.contentType || undefined,
  size: formatSize(attachment.size),
});

export const toChatMessages = (items: ConversationMessage[]): Message[] => items.map((message) => ({
  id: String(message.id),
  sender: message.kind === 'outgoing' || message.kind === 'private_note' ? 'me' : 'them',
  senderName: message.senderName || undefined,
  origin: message.origin || undefined,
  text: message.content || undefined,
  time: new Date(message.createdAt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  status: message.status || undefined,
  error: message.error || undefined,
  dateLabel: dateLabel(message.createdAt),
  isPrivate: message.kind === 'private_note',
  isActivity: message.kind === 'activity',
  attachments: message.attachments.map(toAttachment),
}));
