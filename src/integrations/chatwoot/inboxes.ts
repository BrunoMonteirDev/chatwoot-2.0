import type { AgentPermissionAssignment, AssignableAgent, ConversationTeam, CustomRole, Inbox, PermissionProfile } from '../../domain/currentUser';
import type { EvolutionInboxMetadata } from '../evolution/inbox';
import type { MetaCloudInboxMetadata } from '../whatsapp/provider';
import type { WhatsAppTransport } from '../whatsapp/provider';
import { chatwootApiClient } from './client';
import { normalizeAssignableAgent, normalizeCustomRole, normalizeInbox, normalizeTeam } from './normalizers';
import type { ChatwootAgentDto, ChatwootAgentPermissionAssignmentDto, ChatwootCustomRoleDto, ChatwootInboxesResponse, ChatwootInboxDto, ChatwootPermissionProfileDto, ChatwootTeamDto } from './types';

const root = (accountId: number) => `/api/v1/accounts/${accountId}`;

export interface CreateEvolutionInboxParams { name: string; webhookUrl: string; }
export interface SaveAgentParams { name: string; email?: string; role: 'agent' | 'administrator'; availability: 'online' | 'offline' | 'busy'; customRoleId?: number | null; }
export interface SaveCustomRoleParams { name: string; description: string; permissions: string[]; }
export interface SavePermissionProfileParams { name: string; description: string; kind: 'inbox' | 'system'; inboxPermissions: string[]; systemPermissions: string[]; }
const normalizePermissionProfile = (dto: ChatwootPermissionProfileDto): PermissionProfile => ({ id: dto.id, name: dto.name, description: dto.description || null, kind: dto.kind || 'inbox', inboxPermissions: dto.inbox_permissions || [], systemPermissions: dto.system_permissions || [], isDefault: Boolean(dto.default) });

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

  async updateName(accountId: number, inboxId: number, name: string): Promise<Inbox> {
    const response = await chatwootApiClient.patch<ChatwootInboxDto>(`${root(accountId)}/inboxes/${inboxId}`, { name });
    return normalizeInbox(response);
  },

  async saveEvolutionMetadata(accountId: number, inboxId: number, metadata: EvolutionInboxMetadata, webhookUrl?: string): Promise<Inbox> {
    const response = await chatwootApiClient.patch<ChatwootInboxDto>(`${root(accountId)}/inboxes/${inboxId}`, {
      channel: { additional_attributes: metadata, ...(webhookUrl ? { webhook_url: webhookUrl } : {}) },
    });
    return normalizeInbox(response);
  },

  async saveWhatsAppTransport(accountId: number, inbox: Inbox, transport: WhatsAppTransport, patch: Record<string, unknown>, webhookUrl?: string): Promise<Inbox> {
    const current = inbox.additionalAttributes;
    const declared = Array.isArray(current.whatsapp_transports) ? current.whatsapp_transports.filter((item): item is WhatsAppTransport => item === 'evolution' || item === 'waha' || item === 'meta_cloud') : [];
    const transports = [...new Set([...declared, ...(current.evolution_provider === 'evolution' ? ['evolution' as const] : []), ...(current.whatsapp_provider === 'meta_cloud' ? ['meta_cloud' as const] : []), transport])];
    const mode = transports.length > 1 ? 'hybrid' : transports[0] === 'meta_cloud' ? 'official' : 'web';
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

  async createAgent(accountId: number, params: SaveAgentParams): Promise<AssignableAgent> {
    const response = await chatwootApiClient.post<ChatwootAgentDto>(`${root(accountId)}/agents`, {
      agent: { name: params.name, email: params.email, role: params.role, availability: params.availability },
      custom_role_id: params.customRoleId ?? null,
    });
    return normalizeAssignableAgent(response);
  },

  async updateAgent(accountId: number, agentId: number, params: SaveAgentParams): Promise<AssignableAgent> {
    const response = await chatwootApiClient.patch<ChatwootAgentDto>(`${root(accountId)}/agents/${agentId}`, {
      agent: { name: params.name, role: params.role, availability: params.availability },
      custom_role_id: params.customRoleId ?? null,
    });
    return normalizeAssignableAgent(response);
  },

  deleteAgent(accountId: number, agentId: number): Promise<void> {
    return chatwootApiClient.delete(`${root(accountId)}/agents/${agentId}`);
  },

  async listCustomRoles(accountId: number): Promise<CustomRole[]> {
    const response = await chatwootApiClient.get<ChatwootCustomRoleDto[]>(`${root(accountId)}/custom_roles`);
    return response.map(normalizeCustomRole);
  },

  async createCustomRole(accountId: number, params: SaveCustomRoleParams): Promise<CustomRole> {
    const response = await chatwootApiClient.post<ChatwootCustomRoleDto>(`${root(accountId)}/custom_roles`, { custom_role: params });
    return normalizeCustomRole(response);
  },

  async updateCustomRole(accountId: number, roleId: number, params: SaveCustomRoleParams): Promise<CustomRole> {
    const response = await chatwootApiClient.patch<ChatwootCustomRoleDto>(`${root(accountId)}/custom_roles/${roleId}`, { custom_role: params });
    return normalizeCustomRole(response);
  },

  deleteCustomRole(accountId: number, roleId: number): Promise<void> {
    return chatwootApiClient.delete(`${root(accountId)}/custom_roles/${roleId}`);
  },

  async listPermissionProfiles(accountId: number): Promise<PermissionProfile[]> {
    return (await chatwootApiClient.get<ChatwootPermissionProfileDto[]>(`${root(accountId)}/permission_profiles`)).map(normalizePermissionProfile);
  },
  async createPermissionProfile(accountId: number, params: SavePermissionProfileParams): Promise<PermissionProfile> {
    const response = await chatwootApiClient.post<ChatwootPermissionProfileDto>(`${root(accountId)}/permission_profiles`, { permission_profile: { name: params.name, description: params.description, kind: params.kind, inbox_permissions: params.inboxPermissions, system_permissions: params.systemPermissions } });
    return normalizePermissionProfile(response);
  },
  async updatePermissionProfile(accountId: number, id: number, params: SavePermissionProfileParams): Promise<PermissionProfile> {
    const response = await chatwootApiClient.patch<ChatwootPermissionProfileDto>(`${root(accountId)}/permission_profiles/${id}`, { permission_profile: { name: params.name, description: params.description, kind: params.kind, inbox_permissions: params.inboxPermissions, system_permissions: params.systemPermissions } });
    return normalizePermissionProfile(response);
  },
  deletePermissionProfile(accountId: number, id: number): Promise<void> { return chatwootApiClient.delete(`${root(accountId)}/permission_profiles/${id}`); },
  async getAgentPermissionAssignment(accountId: number, agentId: number): Promise<AgentPermissionAssignment> {
    const dto = await chatwootApiClient.get<ChatwootAgentPermissionAssignmentDto>(`${root(accountId)}/agents/${agentId}/permission_assignment`);
    return { agentId: dto.agent_id, permissionProfileId: dto.permission_profile_id || null, inboxes: dto.inboxes.map(inbox => ({ inboxId: inbox.inbox_id, inboxName: inbox.inbox_name, permissionProfileId: inbox.permission_profile_id || null })) };
  },
  async saveAgentPermissionAssignment(accountId: number, agentId: number, assignment: Omit<AgentPermissionAssignment, 'agentId'>): Promise<AgentPermissionAssignment> {
    const dto = await chatwootApiClient.patch<ChatwootAgentPermissionAssignmentDto>(`${root(accountId)}/agents/${agentId}/permission_assignment`, { permission_assignment: { permission_profile_id: assignment.permissionProfileId, inbox_assignments: assignment.inboxes.map(inbox => ({ inbox_id: inbox.inboxId, permission_profile_id: inbox.permissionProfileId })) } });
    return { agentId: dto.agent_id, permissionProfileId: dto.permission_profile_id || null, inboxes: dto.inboxes.map(inbox => ({ inboxId: inbox.inbox_id, inboxName: inbox.inbox_name, permissionProfileId: inbox.permission_profile_id || null })) };
  },

  async listTeams(accountId: number): Promise<ConversationTeam[]> {
    const response = await chatwootApiClient.get<ChatwootTeamDto[]>(`${root(accountId)}/teams`);
    return response.map(normalizeTeam);
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
