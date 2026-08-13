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
}

export interface MessageHistoryPage {
  messages: ConversationMessage[];
  hasOlderMessages: boolean;
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

  async create({ accountId, conversationId, content, private: isPrivate, echoId, files = [] }: CreateMessageParams): Promise<ConversationMessage> {
    const payload = files.length
      ? buildAttachmentPayload(content, isPrivate, echoId, files)
      : { content, private: isPrivate, echo_id: echoId };
    const response = await chatwootApiClient.post<ChatwootMessageDto>(
      `/api/v1/accounts/${accountId}/conversations/${conversationId}/messages`,
      payload
    );
    return normalizeMessage(response);
  },
  async remove(accountId: number, conversationId: number, messageId: number): Promise<void> {
    await chatwootApiClient.delete(`/api/v1/accounts/${accountId}/conversations/${conversationId}/messages/${messageId}`);
  },
};

const buildAttachmentPayload = (content: string, isPrivate: boolean, echoId: string, files: File[]): FormData => {
  const formData = new FormData();
  if (content) formData.append('content', content);
  files.forEach((file) => formData.append('attachments[]', file));
  formData.append('private', String(isPrivate));
  formData.append('echo_id', echoId);
  return formData;
};
