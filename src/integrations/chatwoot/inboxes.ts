import type { AssignableAgent, Inbox } from '../../domain/currentUser';
import type { EvolutionInboxMetadata } from '../evolution/inbox';
import type { MetaCloudInboxMetadata } from '../whatsapp/provider';
import type { WhatsAppTransport } from '../whatsapp/provider';
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

  createWhatsAppApiInbox(accountId: number, params: CreateEvolutionInboxParams): Promise<Inbox> {
    return this.createEvolutionInbox(accountId, params);
  },

  async saveEvolutionMetadata(accountId: number, inboxId: number, metadata: EvolutionInboxMetadata, webhookUrl?: string): Promise<Inbox> {
    const response = await chatwootApiClient.patch<ChatwootInboxDto>(`${root(accountId)}/inboxes/${inboxId}`, {
      channel: { additional_attributes: metadata, ...(webhookUrl ? { webhook_url: webhookUrl } : {}) },
    });
    return normalizeInbox(response);
  },

  async saveWhatsAppTransport(accountId: number, inbox: Inbox, transport: WhatsAppTransport, patch: Record<string, unknown>, webhookUrl?: string): Promise<Inbox> {
    const current = inbox.additionalAttributes;
    const declared = Array.isArray(current.whatsapp_transports) ? current.whatsapp_transports.filter((item): item is WhatsAppTransport => item === 'evolution' || item === 'meta_cloud') : [];
    const transports = [...new Set([...declared, ...(current.evolution_provider === 'evolution' ? ['evolution' as const] : []), ...(current.whatsapp_provider === 'meta_cloud' ? ['meta_cloud' as const] : []), transport])];
    const mode = transports.length === 2 ? 'hybrid' : transports[0] === 'meta_cloud' ? 'official' : 'web';
    const response = await chatwootApiClient.patch<ChatwootInboxDto>(`${root(accountId)}/inboxes/${inbox.id}`, {
      channel: { additional_attributes: { ...current, ...patch, whatsapp_mode: mode, whatsapp_transports: transports }, ...(webhookUrl ? { webhook_url: webhookUrl } : {}) },
    });
    return normalizeInbox(response);
  },

  async saveMetaCloudMetadata(accountId: number, inboxId: number, metadata: MetaCloudInboxMetadata, webhookUrl?: string): Promise<Inbox> {
    const response = await chatwootApiClient.patch<ChatwootInboxDto>(`${root(accountId)}/inboxes/${inboxId}`, {
      channel: { additional_attributes: metadata, ...(webhookUrl ? { webhook_url: webhookUrl } : {}) },
    });
    return normalizeInbox(response);
  },

  delete(accountId: number, inboxId: number): Promise<void> {
    return chatwootApiClient.delete(`${root(accountId)}/inboxes/${inboxId}`);
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
