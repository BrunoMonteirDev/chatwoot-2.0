import type { ConversationMessage } from '../../domain/currentUser';
import { chatwootApiClient } from './client';
import { normalizeMessage } from './normalizers';
import type { ChatwootMessageDto, ChatwootMessagesResponse } from './types';

export interface ListMessagesParams {
  accountId: number;
  conversationId: number;
  before?: number;
  signal?: AbortSignal;
}

export interface CreateMessageParams {
  accountId: number;
  conversationId: number;
  content: string;
  private: boolean;
  echoId: string;
  files?: File[];
  inReplyTo?: number;
  whatsappMentions?: string[];
  whatsappMentionReplacements?: Array<{ token: string; text: string }>;
}

export interface MessageHistoryPage {
  messages: ConversationMessage[];
  hasOlderMessages: boolean;
}

export interface ForwardMessageParams {
  accountId: number;
  sourceConversationId: number;
  sourceMessageId: number;
  destinationConversationId: number;
  idempotencyToken: string;
}

// MessageFinder returns 20 items for the latest and for `before`, ordered oldest → newest.
const MESSAGE_PAGE_SIZE = 20;

export const messageService = {
  async list({ accountId, conversationId, before, signal }: ListMessagesParams): Promise<MessageHistoryPage> {
    const query = new URLSearchParams();
    if (before) query.set('before', String(before));
    const suffix = query.size ? `?${query}` : '';
    const response = await chatwootApiClient.get<ChatwootMessagesResponse>(
      `/api/v1/accounts/${accountId}/conversations/${conversationId}/messages${suffix}`,
      { signal }
    );
    const messages = response.payload.map(normalizeMessage);
    return { messages, hasOlderMessages: messages.length === MESSAGE_PAGE_SIZE };
  },

  async create({ accountId, conversationId, content, private: isPrivate, echoId, files = [], inReplyTo, whatsappMentions = [], whatsappMentionReplacements = [] }: CreateMessageParams): Promise<ConversationMessage> {
    const payload = files.length
      ? buildAttachmentPayload(content, isPrivate, echoId, files, inReplyTo)
      : { content, private: isPrivate, echo_id: echoId, ...((inReplyTo || whatsappMentions.length || whatsappMentionReplacements.length) ? { content_attributes: { ...(inReplyTo ? { in_reply_to: inReplyTo } : {}), ...(whatsappMentions.length ? { whatsapp_mentions: whatsappMentions } : {}), ...(whatsappMentionReplacements.length ? { whatsapp_mention_replacements: whatsappMentionReplacements } : {}) } } : {}) };
    const response = await chatwootApiClient.post<ChatwootMessageDto>(
      `/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`,
      payload
    );
    return normalizeMessage(response);
  },
  async remove(accountId: number, conversationId: number, messageId: number): Promise<void> {
    await chatwootApiClient.delete(`/api/v1/accounts/${accountId}/conversations/${conversationId}/messages/${messageId}`);
  },
  async forward({ accountId, sourceConversationId, sourceMessageId, destinationConversationId, idempotencyToken }: ForwardMessageParams): Promise<ConversationMessage> {
    const response = await chatwootApiClient.post<ChatwootMessageDto>(
      `/api/v1/accounts/${accountId}/conversations/${sourceConversationId}/messages/forward`,
      { id: sourceMessageId, destination_conversation_id: destinationConversationId, idempotency_token: idempotencyToken }
    );
    return normalizeMessage(response);
  },
};

const buildAttachmentPayload = (content: string, isPrivate: boolean, echoId: string, files: File[], inReplyTo?: number): FormData => {
  const formData = new FormData();
  if (content) formData.append('content', content);
  files.forEach((file) => formData.append('attachments[]', file));
  formData.append('private', String(isPrivate));
  formData.append('echo_id', echoId);
  if (inReplyTo) formData.append('content_attributes', JSON.stringify({ in_reply_to: inReplyTo }));
  return formData;
};
