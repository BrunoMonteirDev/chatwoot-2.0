import type { ConversationAttachmentSummary } from '../../domain/currentUser';
import { chatwootApiClient } from './client';
import type { ChatwootConversationAttachmentsResponse } from './types';

const kindFor = (fileType: string): ConversationAttachmentSummary['kind'] => fileType === 'image' ? 'image' : fileType === 'video' ? 'video' : fileType === 'audio' ? 'audio' : fileType === 'file' ? 'file' : 'other';

export const conversationAttachmentService = {
  async list(accountId: number, conversationId: number, page: number, signal?: AbortSignal) {
    const response = await chatwootApiClient.get<ChatwootConversationAttachmentsResponse>(`/api/v1/accounts/${accountId}/conversations/${conversationId}/attachments?page=${page}`, { signal });
    return { totalCount: response.meta.total_count, attachments: response.payload.map((item): ConversationAttachmentSummary => ({ id: item.id, messageId: item.message_id ?? null, kind: kindFor(item.file_type), url: item.data_url || '', thumbnailUrl: item.thumb_url || null, title: item.extension || null, size: item.file_size ?? null, createdAt: item.created_at })) };
  },
};
