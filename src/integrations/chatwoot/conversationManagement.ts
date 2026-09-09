import type { AccountLabel, AssignableAgent, ConversationPriority, ConversationStatus, ConversationSummary, ConversationTeam } from '../../domain/currentUser';
import { chatwootApiClient } from './client';
import { normalizeAssignableAgent, normalizeConversation, normalizeTeam } from './normalizers';
import type { ChatwootAssignableAgentsResponse, ChatwootAgentDto, ChatwootConversationDto, ChatwootConversationLabelsResponse, ChatwootStatusResponse, ChatwootTeamDto } from './types';
import { labelCatalog } from '../../features/labels/labelCatalog';

export interface ConversationManagementCatalogs {
  agents: AssignableAgent[];
  teams: ConversationTeam[];
  labels: AccountLabel[];
}

const conversationPath = (accountId: number, conversationId: number) =>
  `/api/v1/accounts/${accountId}/conversations/${conversationId}`;

export const conversationManagementService = {
  async listCatalogs(accountId: number, inboxId?: number | null): Promise<ConversationManagementCatalogs> {
    const root = `/api/v1/accounts/${accountId}`;
    const [agents, teams, labels] = await Promise.all([
      inboxId
        ? chatwootApiClient.get<ChatwootAssignableAgentsResponse>(`${root}/assignable_agents?inbox_ids[]=${inboxId}`)
        : Promise.resolve({ payload: [] } as ChatwootAssignableAgentsResponse),
      chatwootApiClient.get<ChatwootTeamDto[]>(`${root}/teams`),
      labelCatalog.list(accountId),
    ]);
    return { agents: agents.payload.map(normalizeAssignableAgent), teams: teams.map(normalizeTeam), labels };
  },

  async setStatus(accountId: number, conversationId: number, status: ConversationStatus): Promise<Pick<ConversationSummary, 'status'>> {
    const response = await chatwootApiClient.post<ChatwootStatusResponse>(`${conversationPath(accountId, conversationId)}/toggle_status`, { status });
    return { status: response.payload.current_status };
  },

  async setPriority(accountId: number, conversationId: number, priority: ConversationPriority): Promise<Pick<ConversationSummary, 'priority'>> {
    await chatwootApiClient.post<void>(`${conversationPath(accountId, conversationId)}/toggle_priority`, { priority });
    return { priority };
  },

  async assignAgent(accountId: number, conversationId: number, agentId: number | null): Promise<Pick<ConversationSummary, 'assigneeId' | 'assigneeName'>> {
    const response = await chatwootApiClient.post<ChatwootAgentDto | null>(`${conversationPath(accountId, conversationId)}/assignments`, {
      assignee_id: agentId,
      assignee_type: 'User',
    });
    const agent = response ? normalizeAssignableAgent(response) : null;
    return { assigneeId: agent?.id ?? null, assigneeName: agent?.name ?? null };
  },

  async assignTeam(accountId: number, conversationId: number, teamId: number | null): Promise<Pick<ConversationSummary, 'teamId' | 'teamName'>> {
    const response = await chatwootApiClient.post<ChatwootTeamDto | null>(`${conversationPath(accountId, conversationId)}/assignments`, { team_id: teamId || 0 });
    const team = response ? normalizeTeam(response) : null;
    return { teamId: team?.id ?? null, teamName: team?.name ?? null };
  },

  async listParticipants(accountId: number, conversationId: number): Promise<AssignableAgent[]> {
    const response = await chatwootApiClient.get<ChatwootAgentDto[]>(`${conversationPath(accountId, conversationId)}/participants`);
    return response.map(normalizeAssignableAgent);
  },

  async setParticipants(accountId: number, conversationId: number, userIds: number[]): Promise<AssignableAgent[]> {
    const response = await chatwootApiClient.patch<ChatwootAgentDto[]>(`${conversationPath(accountId, conversationId)}/participants`, { user_ids: userIds });
    return response.map(normalizeAssignableAgent);
  },

  async setLabels(accountId: number, conversationId: number, labels: string[]): Promise<Pick<ConversationSummary, 'labels'>> {
    const response = await chatwootApiClient.post<ChatwootConversationLabelsResponse>(`${conversationPath(accountId, conversationId)}/labels`, { labels });
    return { labels: response.payload };
  },

  async setCustomAttributes(accountId: number, conversationId: number, customAttributes: Record<string, unknown>): Promise<Pick<ConversationSummary, 'customAttributes'>> {
    const response = await chatwootApiClient.post<{ custom_attributes: Record<string, unknown> }>(`${conversationPath(accountId, conversationId)}/custom_attributes`, { custom_attributes: customAttributes, merge: true });
    return { customAttributes: response.custom_attributes };
  },

  async markRead(accountId: number, conversationId: number): Promise<ConversationSummary> {
    const response = await chatwootApiClient.post<ChatwootConversationDto>(`${conversationPath(accountId, conversationId)}/update_last_seen`);
    return normalizeConversation(response);
  },

  async markUnread(accountId: number, conversationId: number): Promise<ConversationSummary> {
    const response = await chatwootApiClient.post<ChatwootConversationDto>(`${conversationPath(accountId, conversationId)}/unread`);
    return normalizeConversation(response);
  },
};
