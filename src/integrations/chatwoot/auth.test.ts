// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authService } from './auth';
import { authSession } from './authSession';
import { ChatwootApiError } from './errors';

const sessionHeaders = {
  'access-token': 'token-new',
  'token-type': 'Bearer',
  client: 'client-new',
  expiry: '9999999999',
  uid: 'agent@example.test',
};

describe('authService login', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => vi.unstubAllGlobals());

  it('persiste os headers Devise quando sign_in responde 200', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ data: { id: 1 } }), { status: 200, headers: sessionHeaders }));

    await authService.login({ email: 'agent@example.test', password: 'safe-test-password' });

    expect(fetch).toHaveBeenCalledOnce();
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('/auth/sign_in');
    expect(init?.method).toBe('POST');
    expect(authSession.get()).toEqual({ accessToken: 'token-new', tokenType: 'Bearer', client: 'client-new', expiry: '9999999999', uid: 'agent@example.test' });
  });

  it('entrega as sessões do 409 em vez de transformar o limite em erro genérico', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ sessions_limit_reached: true, sessions: [{ id: 17, browser_name: 'Chrome' }] }), { status: 409 }));

    await expect(authService.login({ email: 'agent@example.test', password: 'safe-test-password' })).resolves.toMatchObject({
      sessions_limit_reached: true,
      sessions: [{ id: 17 }],
    });
  });

  it('repete o login revogando somente a sessão escolhida', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ data: { id: 1 } }), { status: 200, headers: sessionHeaders }));

    await authService.login({ email: 'agent@example.test', password: 'safe-test-password' }, 17);

    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(body).toMatchObject({ email: 'agent@example.test', revoke_session_id: 17 });
    expect(body).not.toHaveProperty('revoke_all_sessions');
  });

  it('permite revogar todas as sessões no retry explícito', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ data: { id: 1 } }), { status: 200, headers: sessionHeaders }));

    await authService.login({ email: 'agent@example.test', password: 'safe-test-password' }, 'all');

    const body = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(body).toMatchObject({ revoke_all_sessions: true });
    expect(body).not.toHaveProperty('revoke_session_id');
  });

  it('continua rejeitando credenciais inválidas', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ errors: ['Invalid login credentials'] }), { status: 401 }));

    await expect(authService.login({ email: 'agent@example.test', password: 'invalid' })).rejects.toBeInstanceOf(ChatwootApiError);
  });
});
