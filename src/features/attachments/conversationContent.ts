import type { ConversationAttachmentSummary } from '../../domain/currentUser';
import type { Message } from '../../types';

const URL_PATTERN = /https?:\/\/[^\s<>()]+/g;
export const contentGroups = (attachments: ConversationAttachmentSummary[], messages: Message[]) => ({
  media: attachments.filter(item => item.kind === 'image' || item.kind === 'video'),
  documents: attachments.filter(item => item.kind === 'file' || item.kind === 'other'),
  links: [...new Set(messages.flatMap(message => message.text?.match(URL_PATTERN) || []))],
});

export const attachmentsWithinDates = (attachments: ConversationAttachmentSummary[], from: string, to: string) => {
  const fromTime = from ? new Date(`${from}T00:00:00`).getTime() / 1000 : null;
  const toTime = to ? new Date(`${to}T23:59:59`).getTime() / 1000 : null;
  return attachments.filter((attachment) => (fromTime === null || attachment.createdAt >= fromTime) && (toTime === null || attachment.createdAt <= toTime));
};

export const linksMatchingSearch = (links: string[], search: string) => {
  const normalizedSearch = search.trim().toLocaleLowerCase();
  if (!normalizedSearch) return links;

  return links.filter(link => link.toLocaleLowerCase().includes(normalizedSearch));
};
