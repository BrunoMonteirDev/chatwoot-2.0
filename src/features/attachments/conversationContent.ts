import type { ConversationAttachmentSummary } from '../../domain/currentUser';
import type { Message } from '../../types';

const URL_PATTERN = /https?:\/\/[^\s<>()]+/g;
export const contentGroups = (attachments: ConversationAttachmentSummary[], messages: Message[]) => ({
  media: attachments.filter(item => item.kind === 'image' || item.kind === 'video'),
  documents: attachments.filter(item => item.kind === 'file' || item.kind === 'other'),
  links: [...new Set(messages.flatMap(message => message.text?.match(URL_PATTERN) || []))],
});
