import { authenticatedBridgeHeaders } from '../../integrations/bridge/auth';
import { BridgeApiError } from '../../integrations/chatwoot/errors';

export interface GroupCreationInbox { id: number; name: string; transport: 'waha' | 'evolution'; }
export interface GroupCreationContact { id: number; name: string; phoneNumber: string; avatarUrl: string | null; }
export interface GroupInvitationResult { contactId: number; ok: boolean; error?: string; }
export interface GroupCreationResult { groupId: string; inviteLink?: string; results: GroupInvitationResult[]; }
const bridgeUrl = (import.meta.env.VITE_BRIDGE_PUBLIC_URL || '').replace(/\/$/, '');
const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const response = await fetch(`${bridgeUrl}${path}`, { ...init, headers: { ...authenticatedBridgeHeaders(), ...init.headers } });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new BridgeApiError(response.status, body, body?.error || 'Não foi possível concluir a operação.');
  return body as T;
};
export const groupCreationClient = {
  listInboxes: (accountId: number) => request<{ inboxes: GroupCreationInbox[] }>(`/groups/creation/inboxes?accountId=${accountId}`),
  searchContacts: (accountId: number, query: string, signal?: AbortSignal) => request<{ contacts: GroupCreationContact[] }>(`/groups/creation/contacts?${new URLSearchParams({ accountId: String(accountId), q: query })}`, { signal }),
  create: (input: { accountId: number; inboxId: number; name: string; description: string; mode: 'invite' | 'direct'; contactIds: number[] }) => request<GroupCreationResult>('/groups/creation', { method: 'POST', body: JSON.stringify(input) }),
  retryInvitations: (input: { accountId: number; inboxId: number; groupId: string; name: string; contactIds: number[] }) => request<GroupCreationResult>('/groups/creation/invitations', { method: 'POST', body: JSON.stringify(input) }),
};
