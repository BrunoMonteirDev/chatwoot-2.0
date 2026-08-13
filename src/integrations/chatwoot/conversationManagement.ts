import type { AccountLabel, AssignableAgent, ConversationPriority, ConversationStatus, ConversationSummary, ConversationTeam } from '../../domain/currentUser';
import { chatwootApiClient } from './client';
import { normalizeAssignableAgent, normalizeConversation, normalizeLabel, normalizeTeam } from './normalizers';
import type { ChatwootAssignableAgentsResponse, ChatwootAgentDto, ChatwootConversationDto, ChatwootConversationLabelsResponse, ChatwootLabelsResponse, ChatwootStatusResponse, ChatwootTeamDto } from './types';

export interface ConversationManagementCatalogs {
  agents: AssignableAgent[];
  teams: ConversationTeam[];
  labels: AccountLabel[];
}

const conversationPath = (accountId: number, conversationId: number) =>
  `/api/v1/accounts/${accountId}/conversations/${conversationId}`;

export const conversationManagementService = {
  async listCatalogs(accountId: number, inboxId: number): Promise<ConversationManagementCatalogs> {
    const root = `/api/v1/accounts/${accountId}`;
    const [agents, teams, labels] = await Promise.all([
      chatwootApiClient.get<ChatwootAssignableAgentsResponse>(`${root}/assignable_agents?inbox_ids[]=${inboxId}`),
      chatwootApiClient.get<ChatwootTeamDto[]>(`${root}/teams`),
      chatwootApiClient.get<ChatwootLabelsResponse>(`${root}/labels`),
    ]);
    return { agents: agents.payload.map(normalizeAssignableAgent), teams: teams.map(normalizeTeam), labels: labels.payload.map(normalizeLabel) };
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

  async setLabels(accountId: number, conversationId: number, labels: string[]): Promise<Pick<ConversationSummary, 'labels'>> {
    const response = await chatwootApiClient.post<ChatwootConversationLabelsResponse>(`${conversationPath(accountId, conversationId)}/labels`, { labels });
    return { labels: response.payload };
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
