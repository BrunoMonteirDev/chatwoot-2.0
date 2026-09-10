import { authenticatedBridgeHeaders } from '../../integrations/bridge/auth';
import { BridgeApiError } from '../../integrations/chatwoot/errors';
import { bridgePublicUrl } from '../../config/runtime';

export interface GroupCreationInbox { id: number; name: string; transport: 'waha' | 'evolution'; }
export interface GroupCreationContact { id: number; name: string; phoneNumber: string; avatarUrl: string | null; }
export interface GroupInvitationResult { contactId: number; ok: boolean; error?: string; }
export interface GroupCreationResult { created: boolean; creationRequestId: string; conversationId?: number; groupId: string; groupJid: string; inbox: { id: number; name: string }; provider: { transport: 'waha' | 'evolution'; session: string }; inviteLink?: string; inviteStatus: 'not_requested' | 'pending' | 'complete' | 'partial' | 'failed'; results: GroupInvitationResult[]; warnings: Array<{ code: string }>; }
const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const bridgeUrl = bridgePublicUrl();
  if (!bridgeUrl) throw new BridgeApiError(503, null, 'O endereço seguro do bridge não está configurado.');
  const response = await fetch(`${bridgeUrl}${path}`, { ...init, headers: { ...authenticatedBridgeHeaders(), ...init.headers } });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new BridgeApiError(response.status, body, body?.error || 'Não foi possível concluir a operação.');
  return body as T;
};
export const groupCreationClient = {
  listInboxes: (accountId: number) => request<{ inboxes: GroupCreationInbox[] }>(`/groups/creation/inboxes?accountId=${accountId}`),
  searchContacts: (accountId: number, query: string, signal?: AbortSignal) => request<{ contacts: GroupCreationContact[] }>(`/groups/creation/contacts?${new URLSearchParams({ accountId: String(accountId), q: query })}`, { signal }),
  createContact: (input: { accountId: number; name: string; phoneNumber: string }) => request<{ contact: GroupCreationContact; existing: boolean }>('/groups/creation/contacts', { method: 'POST', body: JSON.stringify(input) }),
  create: (input: { accountId: number; inboxId: number; creationRequestId: string; name: string; description: string; mode: 'invite' | 'direct'; contactIds: number[]; directConfirmed: boolean }) => request<GroupCreationResult>('/groups/creation', { method: 'POST', body: JSON.stringify(input) }),
  retryInvitations: (input: { accountId: number; inboxId: number; creationRequestId: string; groupId: string; contactIds: number[] }) => request<GroupCreationResult>('/groups/creation/invitations', { method: 'POST', body: JSON.stringify(input) }),
};
