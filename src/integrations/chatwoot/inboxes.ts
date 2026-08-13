import type { AssignableAgent, Inbox } from '../../domain/currentUser';
import type { EvolutionInboxMetadata } from '../evolution/inbox';
import { chatwootApiClient } from './client';
import { normalizeAssignableAgent, normalizeInbox } from './normalizers';
import type { ChatwootAgentDto, ChatwootInboxesResponse, ChatwootInboxDto } from './types';

const root = (accountId: number) => `/api/v1/accounts/${accountId}`;

export interface CreateEvolutionInboxParams { name: string; webhookUrl: string; }

export const inboxService = {
  async list(accountId: number): Promise<Inbox[]> {
    const response = await chatwootApiClient.get<ChatwootInboxesResponse>(`${root(accountId)}/inboxes`);
    return response.payload.map(normalizeInbox);
  },

  async createEvolutionInbox(accountId: number, { name, webhookUrl }: CreateEvolutionInboxParams): Promise<Inbox> {
    const response = await chatwootApiClient.post<ChatwootInboxDto>(`${root(accountId)}/inboxes`, {
      name,
      channel: { type: 'api', webhook_url: webhookUrl },
    });
    return normalizeInbox(response);
  },

  async saveEvolutionMetadata(accountId: number, inboxId: number, metadata: EvolutionInboxMetadata, webhookUrl?: string): Promise<Inbox> {
    const response = await chatwootApiClient.patch<ChatwootInboxDto>(`${root(accountId)}/inboxes/${inboxId}`, {
      channel: { additional_attributes: metadata, ...(webhookUrl ? { webhook_url: webhookUrl } : {}) },
    });
    return normalizeInbox(response);
  },

  async listAgents(accountId: number): Promise<AssignableAgent[]> {
    const response = await chatwootApiClient.get<ChatwootAgentDto[]>(`${root(accountId)}/agents`);
    return response.map(normalizeAssignableAgent);
  },

  async listMembers(accountId: number, inboxId: number): Promise<AssignableAgent[]> {
    const response = await chatwootApiClient.get<{ payload: ChatwootAgentDto[] }>(`${root(accountId)}/inbox_members/${inboxId}`);
    return response.payload.map(normalizeAssignableAgent);
  },

  async setMembers(accountId: number, inboxId: number, userIds: number[]): Promise<AssignableAgent[]> {
    const response = await chatwootApiClient.patch<{ payload: ChatwootAgentDto[] }>(`${root(accountId)}/inbox_members`, {
      inbox_id: inboxId,
      user_ids: userIds,
    });
    return response.payload.map(normalizeAssignableAgent);
  },
};
