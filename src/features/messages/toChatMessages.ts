import type { ConversationMessage } from '../../domain/currentUser';
import type { Attachment, Message, MessageReaction } from '../../types';
import { participantColor, participantIdentity, participantLabel, participantPhone } from '../groups/participant';

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

export const toChatMessages = (items: ConversationMessage[]): Message[] => items.map((message) => {
  const jid = typeof message.contentAttributes.whatsapp_participant_jid === 'string' ? message.contentAttributes.whatsapp_participant_jid : null;
  const phone = typeof message.contentAttributes.whatsapp_participant_phone === 'string' ? message.contentAttributes.whatsapp_participant_phone : null;
  const name = typeof message.contentAttributes.whatsapp_participant_name === 'string' ? message.contentAttributes.whatsapp_participant_name : message.senderName || undefined;
  const identity = participantIdentity(jid, phone);
  return ({
  id: String(message.id),
  sender: message.kind === 'outgoing' || message.kind === 'private_note' ? 'me' : 'them',
  // Chatwoot correctly identifies the group as the conversation contact. The
  // real author of an incoming group message is carried separately by the
  // bridge so a group does not look like a direct conversation with itself.
  senderName: jid || phone ? participantLabel(name, jid, phone) : name,
  ...(jid || phone ? { senderPhone: participantPhone(jid, phone), senderIdentity: identity, senderColor: participantColor(identity) } : {}),
  senderEmail: message.senderEmail || undefined,
  senderAvatarUrl: message.senderAvatarUrl || undefined,
  origin: message.origin || undefined,
  text: message.content || undefined,
  time: new Date(message.createdAt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  status: message.status || undefined,
  error: message.error || undefined,
  dateLabel: dateLabel(message.createdAt),
  isPrivate: message.kind === 'private_note',
  isActivity: message.kind === 'activity',
  replyTo: replyForMessage(message, items),
  attachments: message.attachments.map(toAttachment),
  reactions: reactionsForMessage(message),
  sourceId: message.sourceId,
  whatsappTransport: message.contentAttributes.whatsapp_transport === 'evolution' || message.contentAttributes.whatsapp_transport === 'waha' || message.contentAttributes.whatsapp_transport === 'meta_cloud'
    ? message.contentAttributes.whatsapp_transport
    : null,
  whatsappRemoteJid: typeof message.contentAttributes.whatsapp_remote_jid === 'string' ? message.contentAttributes.whatsapp_remote_jid : null,
  whatsappFromMe: typeof message.contentAttributes.whatsapp_from_me === 'boolean'
    ? message.contentAttributes.whatsapp_from_me
    : message.kind === 'outgoing',
  isEdited: message.contentAttributes.whatsapp_edited === true,
  isRevoked: message.contentAttributes.whatsapp_revoked === true,
  isDeleted: message.contentAttributes.deleted === true,
  isTemplate: message.kind === 'template',
  whatsappPreviousContent: typeof message.contentAttributes.whatsapp_previous_content === 'string' ? message.contentAttributes.whatsapp_previous_content : null,
  isForwarded: message.contentAttributes.whatsapp_is_forwarded === true,
  });
});

const reactionsForMessage = (message: ConversationMessage): MessageReaction[] => {
  const value = message.contentAttributes.whatsapp_reactions;
  if (!Array.isArray(value)) return [];
  return value.flatMap((item): MessageReaction[] => {
    if (!item || typeof item !== 'object') return [];
    const reaction = item as Record<string, unknown>;
    if (typeof reaction.emoji !== 'string' || !reaction.emoji || typeof reaction.sender_id !== 'string' || (reaction.transport !== 'evolution' && reaction.transport !== 'waha' && reaction.transport !== 'meta_cloud')) return [];
    return [{
      emoji: reaction.emoji,
      senderId: reaction.sender_id,
      transport: reaction.transport,
      ...(reaction.origin === 'contact' || reaction.origin === 'mobile' || reaction.origin === 'platform' ? { origin: reaction.origin } : {}),
    }];
  });
};

const replyForMessage = (message: ConversationMessage, allMessages: ConversationMessage[]) => {
  const replyId = message.contentAttributes.in_reply_to;
  const externalId = message.contentAttributes.in_reply_to_external_id;
  const original = typeof replyId === 'number'
    ? allMessages.find(item => item.id === replyId)
    : typeof externalId === 'string'
      ? allMessages.find(item => item.sourceId === externalId)
      : undefined;
  if (!original) return undefined;
  const attachment = original.attachments[0];
  const mediaLabel = attachment?.kind === 'image' ? 'Foto'
    : attachment?.kind === 'video' ? 'Vídeo'
      : attachment?.kind === 'audio' ? 'Áudio'
        : attachment ? 'Documento' : 'Mensagem';
  return {
    id: String(original.id),
    externalId: original.sourceId,
    senderName: original.kind === 'outgoing' || original.kind === 'private_note' ? 'Você' : original.senderName || 'Contato',
    text: original.content || mediaLabel,
    ...(attachment?.kind === 'image' && attachment.url ? { mediaPreviewUrl: attachment.thumbnailUrl || attachment.url } : {}),
  };
};
