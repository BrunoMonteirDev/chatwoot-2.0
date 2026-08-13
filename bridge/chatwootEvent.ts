export interface OutgoingAttachment { url: string; fileType: string; contentType?: string; fileName?: string; }
export interface OutgoingChatwootMessage { messageId: number; inboxId: number; sourceId: string; number: string; content: string; attachments: OutgoingAttachment[]; }

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue => value && typeof value === 'object' ? value as RecordValue : {};

export const parseOutgoingChatwootMessage = (payload: unknown): OutgoingChatwootMessage | null => {
  const root = record(payload);
  const conversation = record(root.conversation);
  const contactInbox = record(conversation.contact_inbox);
  const meta = record(conversation.meta);
  const sender = record(meta.sender);
  const messageId = root.id;
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
  if (root.event !== 'message_created' || root.message_type !== 'outgoing' || root.private === true || typeof messageSourceId === 'string' && messageSourceId.startsWith('evolution:') || !Number.isInteger(messageId) || !Number.isInteger(inboxId) || typeof sourceId !== 'string' || (typeof content !== 'string' && attachments.length === 0) || (typeof content === 'string' && !content.trim() && attachments.length === 0)) return null;
  const sourceNumber = sourceId.match(/^whatsapp:(\d{8,15})$/)?.[1];
  // Contacts created by the Chatwoot dashboard receive a generated API source
  // id. Their phone remains available in meta.sender, so use it as a safe
  // fallback for the Evolution destination.
  const senderNumber = typeof sender.phone_number === 'string'
    ? sender.phone_number.replace(/\D/g, '')
    : undefined;
  const number = sourceNumber || (senderNumber?.match(/^\d{8,15}$/) ? senderNumber : undefined);
  if (!number) return null;
  return { messageId: Number(messageId), inboxId: Number(inboxId), sourceId, number, content: typeof content === 'string' ? content.trim() : '', attachments };
};
