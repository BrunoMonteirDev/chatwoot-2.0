// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authSession } from './authSession';
import { cannedResponseService } from './cannedResponses';

describe('cannedResponseService', () => {
  beforeEach(() => {
    sessionStorage.clear(); localStorage.clear();
    authSession.set({ accessToken: 'token', tokenType: 'Bearer', client: 'client', expiry: '1', uid: 'agent@example.test' });
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => vi.unstubAllGlobals());

  it('consulta a account com a busca oficial e normaliza a lista direta', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([
      { id: 8, short_code: 'saudacao', content: 'Olá {{ contact.name }}' },
    ]), { status: 200 }));

    await expect(cannedResponseService.list({ accountId: 2, search: 'saudação' })).resolves.toEqual([
      { id: 8, shortCode: 'saudacao', content: 'Olá {{ contact.name }}' },
    ]);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/v1/accounts/2/canned_responses?search=sauda%C3%A7%C3%A3o');
    expect((vi.mocked(fetch).mock.calls[0][1] as RequestInit).headers).toBeInstanceOf(Headers);
  });

  it('não envia query string quando não há filtro', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    await cannedResponseService.list({ accountId: 2 });
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/v1/accounts/2/canned_responses');
  });
});
