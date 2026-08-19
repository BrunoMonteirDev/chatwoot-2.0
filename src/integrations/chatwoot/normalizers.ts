import type { AccountLabel, AssignableAgent, CannedResponse, ContactNote, ContactProfile, ConversationAttachment, ConversationMessage, ConversationSummary, ConversationTeam, CurrentAccount, CurrentUser, Inbox } from '../../domain/currentUser';
import type { ChatwootAccountDto, ChatwootAgentDto, ChatwootAttachmentDto, ChatwootCannedResponseDto, ChatwootContactDto, ChatwootContactNoteDto, ChatwootConversationDto, ChatwootInboxDto, ChatwootLabelDto, ChatwootMessageDto, ChatwootProfileDto, ChatwootTeamDto } from './types';

const normalizeAccount = (account: ChatwootAccountDto): CurrentAccount => ({
  id: account.id,
  name: account.name,
  role: account.role,
  permissions: account.permissions ?? [],
  availability: account.availability,
});

export const normalizeProfile = (profile: ChatwootProfileDto): CurrentUser => ({
  id: profile.id,
  name: profile.name,
  displayName: profile.display_name || profile.name,
  email: profile.email,
  avatarUrl: profile.avatar_url,
  role: profile.role,
  isSuperAdmin: profile.type === 'SuperAdmin',
  pubsubToken: profile.pubsub_token,
  accounts: profile.accounts.map(normalizeAccount),
  activeAccountId: profile.account_id,
});

export const normalizeInbox = (inbox: ChatwootInboxDto): Inbox => ({
  id: inbox.id,
  name: inbox.name,
  avatarUrl: inbox.avatar_url,
  channelType: inbox.channel_type,
  channelId: inbox.channel_id ?? null,
  webhookUrl: inbox.webhook_url ?? null,
  inboxIdentifier: inbox.inbox_identifier ?? null,
  additionalAttributes: inbox.additional_attributes ?? {},
});

export const normalizeConversation = (conversation: ChatwootConversationDto): ConversationSummary => {
  const preview = conversation.messages[0];
  const message = preview?.content?.trim() || (preview?.attachments?.length ? 'Anexo' : 'Sem mensagens');
  return {
    id: conversation.id,
    inboxId: conversation.inbox_id,
    channelType: conversation.meta?.channel ?? null,
    contactName: conversation.meta?.sender?.name || 'Contato sem nome',
    contactId: conversation.meta?.sender?.id ?? null,
    contactAvatarUrl: conversation.meta?.sender?.thumbnail ?? null,
    lastMessage: preview?.private ? `🔒 Nota: ${message}` : message,
    lastMessageByCurrentUser: preview?.message_type === 1,
    lastActivityAt: conversation.last_activity_at,
    updatedAt: conversation.updated_at || conversation.last_activity_at,
    unreadCount: conversation.unread_count,
    status: conversation.status,
    priority: conversation.priority,
    assigneeId: conversation.meta?.assignee?.id ?? null,
    assigneeName: conversation.meta?.assignee?.available_name || conversation.meta?.assignee?.name || null,
    teamId: conversation.meta?.team?.id ?? null,
    teamName: conversation.meta?.team?.name || null,
    labels: conversation.labels || [],
    isGroup: conversation.meta?.sender?.additional_attributes?.whatsapp_chat_type === 'group',
  };
};

// ActionCable emits `channel` at the root while the REST serializer places it in `meta`.
// Normalize both contracts at this boundary so React never consumes either DTO shape.
export const normalizeRealtimeConversation = (conversation: ChatwootConversationDto & { channel?: string | null }): ConversationSummary =>
  normalizeConversation({ ...conversation, meta: { ...conversation.meta, channel: conversation.meta?.channel ?? conversation.channel ?? null } });

export const normalizeAssignableAgent = (agent: ChatwootAgentDto): AssignableAgent => ({
  id: agent.id,
  name: agent.available_name || agent.name || 'Agente sem nome',
  avatarUrl: agent.thumbnail || null,
});

export const normalizeTeam = (team: ChatwootTeamDto): ConversationTeam => ({ id: team.id, name: team.name });

export const normalizeLabel = (label: ChatwootLabelDto): AccountLabel => ({
  id: label.id,
  title: label.title,
  color: label.color || null,
});

export const normalizeCannedResponse = (response: ChatwootCannedResponseDto): CannedResponse => ({
  id: response.id,
  shortCode: response.short_code,
  content: response.content,
});

export const normalizeContact = (contact: ChatwootContactDto): ContactProfile => ({
  id: contact.id,
  name: contact.name || 'Contato sem nome',
  avatarUrl: contact.thumbnail || null,
  phoneNumber: contact.phone_number || null,
  email: contact.email || null,
  identifier: contact.identifier || null,
  companyName: typeof contact.additional_attributes?.company_name === 'string' ? contact.additional_attributes.company_name : null,
  city: typeof contact.additional_attributes?.city === 'string' ? contact.additional_attributes.city : null,
  country: typeof contact.additional_attributes?.country === 'string' ? contact.additional_attributes.country : null,
  blocked: Boolean(contact.blocked),
  lastActivityAt: contact.last_activity_at ?? null,
  createdAt: contact.created_at ?? null,
  additionalAttributes: contact.additional_attributes || {},
  customAttributes: contact.custom_attributes || {},
});

export const normalizeContactNote = (note: ChatwootContactNoteDto): ContactNote => ({
  id: note.id,
  content: note.content,
  authorName: note.user?.available_name || note.user?.name || null,
  createdAt: note.created_at,
});

const attachmentKind = (fileType: string): ConversationAttachment['kind'] => {
  if (fileType === 'image' || fileType === 'audio' || fileType === 'video' || fileType === 'file') return fileType;
  return 'other';
};

const normalizeAttachment = (attachment: ChatwootAttachmentDto): ConversationAttachment => ({
  id: attachment.id,
  kind: attachmentKind(attachment.file_type),
  url: attachment.data_url || '',
  thumbnailUrl: attachment.thumb_url || null,
  title: attachment.fallback_title || attachment.extension || null,
  contentType: attachment.content_type || null,
  size: attachment.file_size || null,
});

export const normalizeMessage = (message: ChatwootMessageDto): ConversationMessage => {
  const kind: ConversationMessage['kind'] = message.message_type === 2
    ? 'activity'
    : message.private
      ? 'private_note'
      : message.message_type === 1
        ? 'outgoing'
        : message.message_type === 3
          ? 'template'
          : 'incoming';

  return {
    id: message.id,
    conversationId: message.conversation_id,
    kind,
    contentType: typeof message.content_type === 'number'
      ? ({ 0: 'text', 1: 'input_text', 2: 'input_textarea', 3: 'input_email', 4: 'input_select', 5: 'cards', 6: 'form', 7: 'article', 8: 'incoming_email', 9: 'input_csat', 10: 'integrations', 11: 'sticker', 12: 'voice_call' }[message.content_type] || 'text')
      : message.content_type,
    content: message.content || '',
    createdAt: message.created_at,
    updatedAt: message.updated_at ?? null,
    status: message.status === 0 || message.status === 'sent' ? 'sent'
      : message.status === 1 || message.status === 'delivered' ? 'delivered'
        : message.status === 2 || message.status === 'read' ? 'read'
          : message.status === 3 || message.status === 'failed' ? 'failed' : null,
    echoId: message.echo_id,
    sourceId: message.source_id ?? null,
    senderName: message.sender?.available_name || message.sender?.name || null,
    senderAvatarUrl: message.sender?.thumbnail || null,
    origin: message.content_attributes?.evolution_origin === 'mobile'
      ? 'mobile'
      : kind === 'outgoing'
        ? 'platform'
        : null,
    attachments: (message.attachments || []).map(normalizeAttachment),
    contentAttributes: message.content_attributes || {},
  };
};
