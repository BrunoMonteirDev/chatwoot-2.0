// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authSession } from './authSession';
import { conversationService } from './conversations';

describe('conversationService', () => {
  beforeEach(() => {
    sessionStorage.clear(); localStorage.clear();
    authSession.set({ accessToken: 'token', tokenType: 'Bearer', client: 'client', expiry: '1', uid: 'agent@example.test' });
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it('envia account, inbox, página e normaliza o envelope da lista', async () => {
    const payload = {
      data: {
        meta: {},
        payload: [{
          id: 31, inbox_id: 7, status: 'open', priority: 'high', unread_count: 2, last_activity_at: 100,
          labels: ['vip'], messages: [{ content: 'Olá', message_type: 0 }],
          meta: { sender: { name: 'Maria', thumbnail: null }, channel: 'Channel::Whatsapp', assignee: { available_name: 'Ana' }, team: { name: 'Suporte' } },
        }],
      },
    };
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));

    await expect(conversationService.list({ accountId: 2, inboxId: 7, page: 1 })).resolves.toMatchObject({ hasNextPage: false, conversations: [{ id: 31, contactName: 'Maria', unreadCount: 2, assigneeName: 'Ana' }] });
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/v1/accounts/2/conversations?page=1&status=all&sort_by=last_activity_at_desc&inbox_id=7');
  });

  it('mantém team_id e todas as etiquetas ao paginar e troca a consulta ao mudar o filtro', async () => {
    vi.mocked(fetch).mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ data: { meta: {}, payload: [] } }), { status: 200 })));

    await conversationService.list({ accountId: 2, inboxId: 7, teamId: 11, labels: ['vip', 'urgente'], page: 1 });
    await conversationService.list({ accountId: 2, inboxId: 7, teamId: 11, labels: ['vip', 'urgente'], page: 2 });
    await conversationService.list({ accountId: 2, inboxId: 7, teamId: 12, labels: ['vip', 'urgente'], page: 1 });

    const urls = vi.mocked(fetch).mock.calls.map(([url]) => new URL(String(url), 'https://chatwoot.test').searchParams);
    expect(urls[0].get('page')).toBe('1');
    expect(urls[1].get('page')).toBe('2');
    expect(urls[0].get('team_id')).toBe('11');
    expect(urls[1].get('team_id')).toBe('11');
    expect(urls[2].get('team_id')).toBe('12');
    expect(urls[0].getAll('labels[]')).toEqual(['vip', 'urgente']);
    expect(urls[1].getAll('labels[]')).toEqual(['vip', 'urgente']);
  });

  it('cria uma conversa com contact_id e inbox_id reais', async () => {
    const payload = {
      id: 32, inbox_id: 7, status: 'open', priority: null, unread_count: 0, last_activity_at: 100,
      labels: [], messages: [], meta: { sender: { id: 9, name: 'Maria', thumbnail: null }, channel: 'Channel::Whatsapp' },
    };
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));

    await expect(conversationService.create({ accountId: 2, contactId: 9, inboxId: 7 })).resolves.toMatchObject({ id: 32, contactId: 9, inboxId: 7 });
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/v1/accounts/2/conversations');
    expect(JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string)).toEqual({ contact_id: 9, inbox_id: 7, idempotent: true });
  });

  it('abre uma conversa diretamente pelo ID para links e recarregamentos', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      id: 44, inbox_id: 7, status: 'open', priority: null, unread_count: 0, last_activity_at: 100,
      labels: [], messages: [], meta: { sender: { id: 9, name: 'Maria', thumbnail: null }, channel: 'Channel::Whatsapp' },
    }), { status: 200 }));

    await expect(conversationService.get(2, 44)).resolves.toMatchObject({ id: 44, contactId: 9, inboxId: 7 });
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/v1/accounts/2/conversations/44');
  });

  it('lista o histórico de um contato pelo endpoint e envelope específicos', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      payload: [{
        id: 31, inbox_id: 7, status: 'open', priority: null, unread_count: 0, last_activity_at: 100,
        labels: [], messages: [], meta: { sender: { id: 9, name: 'Maria', thumbnail: null }, channel: 'Channel::Whatsapp' },
      }],
    }), { status: 200 }));

    await expect(conversationService.listByContact(2, 9)).resolves.toMatchObject([{ id: 31, contactId: 9 }]);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/v1/accounts/2/contacts/9/conversations');
  });

  it('reutiliza a conversa mais recente da mesma inbox', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ payload: [
      { id: 31, inbox_id: 7, status: 'resolved', priority: null, unread_count: 0, last_activity_at: 100, labels: [], messages: [], meta: { sender: { id: 9, name: 'Maria' } } },
      { id: 32, inbox_id: 7, status: 'open', priority: null, unread_count: 0, last_activity_at: 200, labels: [], messages: [], meta: { sender: { id: 9, name: 'Maria' } } },
    ] }), { status: 200 }));

    await expect(conversationService.findReusable({ accountId: 2, contactId: 9, inboxId: 7 })).resolves.toMatchObject({ id: 32 });
  });

  it('exclui a conversa pelo endpoint do Chatwoot', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));
    await expect(conversationService.remove(2, 31)).resolves.toBeUndefined();
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/v1/accounts/2/conversations/31');
    expect((vi.mocked(fetch).mock.calls[0][1] as RequestInit).method).toBe('DELETE');
  });
});
