// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authSession } from './authSession';
import { ChatwootApiClient } from './client';

describe('ChatwootApiClient', () => {
  beforeEach(() => {
    sessionStorage.clear(); localStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => vi.unstubAllGlobals());

  it('envia a sessão e captura headers Devise rotacionados', async () => {
    authSession.set({ accessToken: 'old', tokenType: 'Bearer', client: 'client', expiry: '1', uid: 'agent@example.test' });
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'access-token': 'new', 'token-type': 'Bearer', client: 'client', expiry: '2', uid: 'agent@example.test' },
    }));

    await new ChatwootApiClient('').get('/api/v1/profile');

    const [, request] = vi.mocked(fetch).mock.calls[0];
    expect(new Headers((request as RequestInit).headers).get('access-token')).toBe('old');
    expect(authSession.get()?.accessToken).toBe('new');
    expect(authSession.get()?.expiry).toBe('2');
  });
});
