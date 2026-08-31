import type { ConversationSummary } from '../../domain/currentUser';
import { chatwootApiClient } from './client';
import { normalizeConversation } from './normalizers';
import type { ChatwootContactConversationsResponse, ChatwootConversationDto, ChatwootConversationsResponse } from './types';

export interface ConversationServerFilters { teamId?: number | null; labels?: string[]; }
export interface ListConversationsParams extends ConversationServerFilters { accountId: number; inboxId?: number; page: number; signal?: AbortSignal; }
export interface ConversationPage { conversations: ConversationSummary[]; hasNextPage: boolean; }
export interface CreateConversationParams { accountId: number; contactId: number; inboxId: number; }

export const conversationService = {
  async list({ accountId, inboxId, teamId, labels = [], page, signal }: ListConversationsParams): Promise<ConversationPage> {
    const query = new URLSearchParams({ page: String(page), status: 'all', sort_by: 'last_activity_at_desc' });
    if (inboxId) query.set('inbox_id', String(inboxId));
    if (teamId) query.set('team_id', String(teamId));
    labels.forEach((label) => query.append('labels[]', label));
    const response = await chatwootApiClient.get<ChatwootConversationsResponse>(`/api/v1/accounts/${accountId}/conversations?${query}`, { signal });
    const conversations = response.data.payload.map(normalizeConversation);
    return { conversations, hasNextPage: conversations.length === 25 };
  },

  async create({ accountId, contactId, inboxId }: CreateConversationParams): Promise<ConversationSummary> {
    const response = await chatwootApiClient.post<ChatwootConversationDto>(
      `/api/v1/accounts/${accountId}/conversations`,
      { contact_id: contactId, inbox_id: inboxId, idempotent: true }
    );
    return normalizeConversation(response);
  },

  async get(accountId: number, conversationId: number): Promise<ConversationSummary> {
    const response = await chatwootApiClient.get<ChatwootConversationDto>(
      `/api/v1/accounts/${accountId}/conversations/${conversationId}`
    );
    return normalizeConversation(response);
  },

  async remove(accountId: number, conversationId: number): Promise<void> {
    await chatwootApiClient.delete<void>(`/api/v1/accounts/${accountId}/conversations/${conversationId}`);
  },

  async listByContact(accountId: number, contactId: number, signal?: AbortSignal): Promise<ConversationSummary[]> {
    const response = await chatwootApiClient.get<ChatwootContactConversationsResponse>(
      `/api/v1/accounts/${accountId}/contacts/${contactId}/conversations`,
      { signal }
    );
    return response.payload.map(normalizeConversation);
  },

  async findReusable({ accountId, contactId, inboxId }: CreateConversationParams): Promise<ConversationSummary | null> {
    const conversations = await this.listByContact(accountId, contactId);
    return conversations
      .filter(conversation => conversation.inboxId === inboxId)
      .sort((left, right) => right.lastActivityAt - left.lastActivityAt)[0] || null;
  },
};
