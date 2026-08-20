// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authSession } from './authSession';
import { conversationManagementService } from './conversationManagement';

describe('conversationManagementService', () => {
  beforeEach(() => {
    sessionStorage.clear();
    authSession.set({ accessToken: 'token', tokenType: 'Bearer', client: 'client', expiry: '1', uid: 'agent@example.test' });
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it('usa display_id da conversa e os contratos de status, prioridade, atribuição e labels', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ payload: { current_status: 'resolved' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response('', { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 8, available_name: 'Ana', thumbnail: null }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 9, name: 'Suporte' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ payload: ['vip'] }), { status: 200 }));

    await expect(conversationManagementService.setStatus(2, 31, 'resolved')).resolves.toEqual({ status: 'resolved' });
    await expect(conversationManagementService.setPriority(2, 31, 'urgent')).resolves.toEqual({ priority: 'urgent' });
    await expect(conversationManagementService.assignAgent(2, 31, 8)).resolves.toEqual({ assigneeId: 8, assigneeName: 'Ana' });
    await expect(conversationManagementService.assignTeam(2, 31, 9)).resolves.toEqual({ teamId: 9, teamName: 'Suporte' });
    await expect(conversationManagementService.setLabels(2, 31, ['vip'])).resolves.toEqual({ labels: ['vip'] });

    expect(vi.mocked(fetch).mock.calls.map(([url, init]) => [url, init && JSON.parse((init as RequestInit).body as string)])).toEqual([
      ['/api/v1/accounts/2/conversations/31/toggle_status', { status: 'resolved' }],
      ['/api/v1/accounts/2/conversations/31/toggle_priority', { priority: 'urgent' }],
      ['/api/v1/accounts/2/conversations/31/assignments', { assignee_id: 8, assignee_type: 'User' }],
      ['/api/v1/accounts/2/conversations/31/assignments', { team_id: 9 }],
      ['/api/v1/accounts/2/conversations/31/labels', { labels: ['vip'] }],
    ]);
  });

  it('consulta e atualiza responsáveis compartilhados pela API nativa de participantes', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 8, available_name: 'Ana' }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 8, available_name: 'Ana' }, { id: 9, available_name: 'Bruno' }]), { status: 200 }));

    await expect(conversationManagementService.listParticipants(2, 31)).resolves.toEqual([{ id: 8, name: 'Ana', avatarUrl: null }]);
    await expect(conversationManagementService.setParticipants(2, 31, [8, 9])).resolves.toEqual([
      { id: 8, name: 'Ana', avatarUrl: null }, { id: 9, name: 'Bruno', avatarUrl: null },
    ]);

    expect(vi.mocked(fetch).mock.calls.map(([url, init]) => [url, init?.method, init?.body && JSON.parse(init.body as string)])).toEqual([
      ['/api/v1/accounts/2/conversations/31/participants', 'GET', undefined],
      ['/api/v1/accounts/2/conversations/31/participants', 'PATCH', { user_ids: [8, 9] }],
    ]);
  });
});
