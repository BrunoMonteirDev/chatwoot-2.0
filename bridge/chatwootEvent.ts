export interface OutgoingAttachment { url: string; fileType: string; contentType?: string; fileName?: string; }
export interface OutgoingChatwootMessage { messageId: number; conversationId: number; inboxId: number; sourceId: string; number: string; chatType: 'private' | 'group'; content: string; attachments: OutgoingAttachment[]; quotedMessageId?: string; quotedExternalId?: string; }

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue => value && typeof value === 'object' ? value as RecordValue : {};
const groupJidForSourceId = (sourceId: string) => {
  const encoded = sourceId.match(/^whatsapp:group:(.+)$/)?.[1];
  if (!encoded) return undefined;
  try {
    const groupJid = decodeURIComponent(encoded);
    return groupJid.endsWith('@g.us') ? groupJid : undefined;
  } catch {
    return undefined;
  }
};

export const parseOutgoingChatwootMessage = (payload: unknown): OutgoingChatwootMessage | null => {
  const root = record(payload);
  const conversation = record(root.conversation);
  const contactInbox = record(conversation.contact_inbox);
  const meta = record(conversation.meta);
  const sender = record(meta.sender);
  const messageId = root.id;
  const conversationId = conversation.id;
  const inboxId = conversation.inbox_id;
  const sourceId = contactInbox.source_id;
  const content = root.content;
  const attachments = Array.isArray(root.attachments) ? root.attachments.map((item): OutgoingAttachment | null => {
    const attachment = record(item);
    const url = typeof attachment.data_url === 'string' ? attachment.data_url : '';
    const fileType = typeof attachment.file_type === 'string' ? attachment.file_type : 'file';
    if (!url) return null;
    return {
      url,
      fileType,
      ...(typeof attachment.content_type === 'string' ? { contentType: attachment.content_type } : {}),
      ...(typeof attachment.fallback_title === 'string' ? { fileName: attachment.fallback_title } : {}),
    };
  }).filter((item): item is OutgoingAttachment => item !== null) : [];
  const messageSourceId = root.source_id;
  const contentAttributes = record(root.content_attributes);
  const quotedExternalId = typeof contentAttributes.in_reply_to_external_id === 'string' ? contentAttributes.in_reply_to_external_id : undefined;
  const quotedMessageId = quotedExternalId?.replace(/^evolution:/, '');
  if (root.event !== 'message_created' || root.message_type !== 'outgoing' || root.private === true || typeof messageSourceId === 'string' && /^(evolution|waha|meta):/.test(messageSourceId) || !Number.isInteger(messageId) || !Number.isInteger(conversationId) || !Number.isInteger(inboxId) || typeof sourceId !== 'string' || (typeof content !== 'string' && attachments.length === 0) || (typeof content === 'string' && !content.trim() && attachments.length === 0)) return null;
  const sourceNumber = sourceId.match(/^whatsapp:(\d{8,15})$/)?.[1];
  const groupJid = groupJidForSourceId(sourceId);
  // Contacts created by the Chatwoot dashboard receive a generated API source
  // id. Their phone remains available in meta.sender, so use it as a safe
  // fallback for the Evolution destination.
  const senderNumber = typeof sender.phone_number === 'string'
    ? sender.phone_number.replace(/\D/g, '')
    : undefined;
  const number = groupJid || sourceNumber || (senderNumber?.match(/^\d{8,15}$/) ? senderNumber : undefined);
  if (!number) return null;
  return { messageId: Number(messageId), conversationId: Number(conversationId), inboxId: Number(inboxId), sourceId, number, chatType: groupJid ? 'group' : 'private', content: typeof content === 'string' ? content.trim() : '', attachments, ...(quotedMessageId ? { quotedMessageId } : {}), ...(quotedExternalId ? { quotedExternalId } : {}) };
};
