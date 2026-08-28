// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authSession } from './authSession';
import { contactService } from './contacts';

const contactPayload = {
  id: 9, name: 'Maria', thumbnail: null, phone_number: '+5511999999999', email: 'maria@example.test', identifier: 'wa-9',
  additional_attributes: { company_name: 'Acme', city: 'São Paulo' }, custom_attributes: { plan: 'enterprise' },
};

describe('contactService', () => {
  beforeEach(() => {
    sessionStorage.clear(); localStorage.clear();
    authSession.set({ accessToken: 'token', tokenType: 'Bearer', client: 'client', expiry: '1', uid: 'agent@example.test' });
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it('lista contatos da account usando paginação e o envelope do ContactsController', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      meta: { count: 1, current_page: 1 },
      payload: [{ ...contactPayload, blocked: true, created_at: 100, last_activity_at: 200 }],
    }), { status: 200 }));

    await expect(contactService.list({ accountId: 2 })).resolves.toMatchObject({
      totalCount: 1,
      currentPage: 1,
      contacts: [{ id: 9, blocked: true, createdAt: 100, lastActivityAt: 200 }],
    });
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/v1/accounts/2/contacts?page=1&sort=-last_activity_at&include_contact_inboxes=false');
  });

  it('cria contato com os campos permitidos e normaliza o envelope de criação', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ payload: { contact: contactPayload } }), { status: 200 }));

    await expect(contactService.create({ accountId: 2, name: 'Maria', phoneNumber: '+5511999999999', email: 'maria@example.test' }))
      .resolves.toMatchObject({ id: 9, name: 'Maria' });
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/v1/accounts/2/contacts');
    expect((vi.mocked(fetch).mock.calls[0][1] as RequestInit).method).toBe('POST');
    expect(JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string)).toEqual({
      name: 'Maria', phone_number: '+5511999999999', email: 'maria@example.test',
    });
  });

  it('normaliza o contato e persiste somente os campos suportados pelo controller', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ payload: contactPayload }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ payload: { ...contactPayload, name: 'Maria Silva', additional_attributes: { company_name: 'Nova Acme', city: 'São Paulo' }, custom_attributes: { plan: 'pro' } } }), { status: 200 }));
    const contact = await contactService.get(2, 9);
    await expect(contactService.update(2, contact, { name: 'Maria Silva', companyName: 'Nova Acme', customAttributes: { plan: 'pro' } })).resolves.toMatchObject({ name: 'Maria Silva', companyName: 'Nova Acme' });
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/v1/accounts/2/contacts/9');
    expect((vi.mocked(fetch).mock.calls[1][1] as RequestInit).method).toBe('PATCH');
    expect(JSON.parse((vi.mocked(fetch).mock.calls[1][1] as RequestInit).body as string)).toEqual({ name: 'Maria Silva', additional_attributes: { company_name: 'Nova Acme', city: 'São Paulo' }, custom_attributes: { plan: 'pro' } });
  });

  it('atualiza o bloqueio e exclui pelo contrato do ContactsController', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ payload: { ...contactPayload, blocked: true } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    await expect(contactService.update(2, { id: 9, name: 'Maria', avatarUrl: null, phoneNumber: null, email: null, identifier: null, companyName: null, city: null, country: null, blocked: false, lastActivityAt: null, createdAt: null, additionalAttributes: {}, customAttributes: {} }, { blocked: true }))
      .resolves.toMatchObject({ blocked: true });
    await expect(contactService.remove(2, 9)).resolves.toBeUndefined();
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/v1/accounts/2/contacts/9');
    expect(JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string)).toEqual({ blocked: true, additional_attributes: {} });
    expect((vi.mocked(fetch).mock.calls[1][1] as RequestInit).method).toBe('DELETE');
    expect(vi.mocked(fetch).mock.calls[1][0]).toBe('/api/v1/accounts/2/contacts/9');
  });

  it('usa o envelope note exigido pelo NotesController', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ id: 4, content: 'Cliente VIP', created_at: 100, user: { name: 'Ana' } }), { status: 200 }));
    await expect(contactService.createNote(2, 9, 'Cliente VIP')).resolves.toMatchObject({ id: 4, authorName: 'Ana' });
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/v1/accounts/2/contacts/9/notes');
    expect(JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string)).toEqual({ note: { content: 'Cliente VIP' } });
  });

  it('lista notas pelo endpoint aninhado do contato', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([
      { id: 4, content: 'Cliente VIP', created_at: 100, user: { available_name: 'Ana' } },
    ]), { status: 200 }));

    await expect(contactService.listNotes(2, 9)).resolves.toMatchObject([{ id: 4, content: 'Cliente VIP', authorName: 'Ana' }]);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/v1/accounts/2/contacts/9/notes');
  });

  it('lista o catálogo e substitui as etiquetas de um contato pelos contratos do LabelConcern', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ payload: [{ id: 1, title: 'vip', color: '#f59e0b' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ payload: ['vip'] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ payload: ['vip', 'novo'] }), { status: 200 }));

    await expect(contactService.listAvailableLabels(2)).resolves.toMatchObject([{ id: 1, title: 'vip', color: '#f59e0b' }]);
    await expect(contactService.listLabels(2, 9)).resolves.toEqual(['vip']);
    await expect(contactService.setLabels(2, 9, ['vip', 'novo'])).resolves.toEqual(['vip', 'novo']);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/v1/accounts/2/labels');
    expect(vi.mocked(fetch).mock.calls[1][0]).toBe('/api/v1/accounts/2/contacts/9/labels');
    expect(vi.mocked(fetch).mock.calls[2][0]).toBe('/api/v1/accounts/2/contacts/9/labels');
    expect(JSON.parse((vi.mocked(fetch).mock.calls[2][1] as RequestInit).body as string)).toEqual({ labels: ['vip', 'novo'] });
  });

  it('agenda etiquetas em lote pelo endpoint oficial de bulk actions', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 200 }));

    await expect(contactService.bulkUpdateLabels(2, [9, 10], 'add', ['vip'])).resolves.toBeUndefined();
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/v1/accounts/2/bulk_actions');
    expect(JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string)).toEqual({
      type: 'Contact', ids: [9, 10], labels: { add: ['vip'] },
    });
  });
});
