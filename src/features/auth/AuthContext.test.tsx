// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authSession } from '../../integrations/chatwoot/authSession';
import { ChatwootApiError } from '../../integrations/chatwoot/errors';
import { authService } from '../../integrations/chatwoot/auth';
import type { ChatwootProfileDto } from '../../integrations/chatwoot/types';
import { groupMetadataClient } from '../groups/metadata';
import { messageHistoryCache } from '../messages/MessageHistoryCache';
import { AuthProvider, useAuth } from './AuthContext';

const profile: ChatwootProfileDto = {
  account_id: 1, avatar_url: null, display_name: 'Agent', email: 'agent@example.test', id: 9, name: 'Agent', pubsub_token: 'pubsub', role: 'administrator', uid: 'agent@example.test',
  accounts: [
    { id: 1, name: 'One', status: 'active', onboarding_step: null, active_at: null, role: 'administrator', permissions: [], availability: null, availability_status: null, auto_offline: false, api_and_webhooks: true },
    { id: 2, name: 'Two', status: 'active', onboarding_step: null, active_at: null, role: 'administrator', permissions: [], availability: null, availability_status: null, auto_offline: false, api_and_webhooks: true },
  ],
};
const session = { accessToken: 'token', tokenType: 'Bearer', client: 'client', expiry: '9999999999', uid: 'agent@example.test' };
type Context = ReturnType<typeof useAuth>;

describe('AuthContext login lifecycle', () => {
  let container: HTMLDivElement;
  let root: Root;
  let context: Context;
  const Probe = () => { context = useAuth(); return null; };
  const render = async () => {
    await act(async () => { root.render(<AuthProvider><Probe /></AuthProvider>); });
    await act(async () => { await Promise.resolve(); });
  };

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear(); sessionStorage.clear();
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    vi.spyOn(messageHistoryCache, 'clear').mockResolvedValue();
    vi.spyOn(groupMetadataClient, 'clear').mockResolvedValue();
    vi.spyOn(authService, 'validateSession').mockResolvedValue({});
    vi.spyOn(authService, 'getProfile').mockResolvedValue(profile);
    vi.spyOn(authService, 'setActiveAccount').mockResolvedValue();
    vi.spyOn(authService, 'logout').mockResolvedValue();
  });

  afterEach(() => {
    act(() => root.unmount()); container.remove(); vi.restoreAllMocks();
  });

  it('autentica e carrega o usuário após sign_in válido', async () => {
    vi.spyOn(authService, 'login').mockImplementation(async () => { authSession.set(session); return { data: profile }; });
    await render();

    await act(async () => { await context.login({ email: 'agent@example.test', password: 'safe-test-password' }); });

    expect(authSession.get()).toEqual(session);
    expect(context.status).toBe('authenticated');
    expect(context.user?.id).toBe(9);
    expect(context.currentAccount?.id).toBe(1);
  });

  it('mantém o login funcional quando a limpeza do IndexedDB falha', async () => {
    vi.mocked(messageHistoryCache.clear).mockRejectedValue(new DOMException('Unavailable', 'InvalidStateError'));
    vi.mocked(groupMetadataClient.clear).mockRejectedValue(new Error('IndexedDB unavailable'));
    vi.spyOn(authService, 'login').mockImplementation(async () => { authSession.set(session); return { data: profile }; });
    await render();

    await act(async () => { await context.login({ email: 'agent@example.test', password: 'safe-test-password' }); });

    expect(context.status).toBe('authenticated');
    expect(authSession.get()).toEqual(session);
  });

  it('limpa a sessão local no logout mesmo se o backend falhar', async () => {
    authSession.set(session);
    vi.mocked(authService.logout).mockRejectedValue(new Error('offline'));
    await render();

    await act(async () => { await context.logout(); });

    expect(authSession.get()).toBeNull();
    expect(context.status).toBe('unauthenticated');
  });

  it('troca de account sem apagar a autenticação', async () => {
    authSession.set(session);
    await render();
    expect(context.status).toBe('authenticated');

    await act(async () => { await context.selectAccount(2); });

    expect(authService.setActiveAccount).toHaveBeenCalledWith(2);
    expect(context.currentAccount?.id).toBe(2);
    expect(authSession.get()).toEqual(session);
  });

  it('continua rejeitando credencial inválida e remove sessão residual', async () => {
    authSession.set(session);
    vi.spyOn(authService, 'login').mockRejectedValue(new ChatwootApiError({ status: 401, statusText: 'Unauthorized', body: { errors: ['Invalid credentials'] }, message: 'Invalid credentials' }));
    await render();

    let caught: unknown;
    await act(async () => {
      try { await context.login({ email: 'agent@example.test', password: 'invalid' }); } catch (cause) { caught = cause; }
    });

    expect(caught).toBeInstanceOf(ChatwootApiError);
    expect(authSession.get()).toBeNull();
    expect(context.status).toBe('unauthenticated');
  });
});
