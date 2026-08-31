import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CurrentAccount, CurrentUser } from '../../domain/currentUser';
import { authSession } from '../../integrations/chatwoot/authSession';
import { ChatwootApiError } from '../../integrations/chatwoot/errors';
import { authService } from '../../integrations/chatwoot/auth';
import { normalizeProfile } from '../../integrations/chatwoot/normalizers';
import type { AuthCredentials, MfaRequiredResponse, MfaVerificationCredentials } from '../../integrations/chatwoot/types';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated' | 'error';

interface AuthContextValue {
  status: AuthStatus;
  user: CurrentUser | null;
  currentAccount: CurrentAccount | null;
  selectAccount(accountId: number): Promise<void>;
  error: string | null;
  login(credentials: AuthCredentials, revokeSessionId?: number | 'all'): Promise<MfaRequiredResponse | null>;
  verifyMfa(credentials: MfaVerificationCredentials): Promise<void>;
  logout(): Promise<void>;
  retryBootstrap(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    const profile = normalizeProfile(await authService.getProfile());
    setUser(profile);
    setSelectedAccountId(profile.activeAccountId ?? profile.accounts[0]?.id ?? null);
    setStatus('authenticated');
    setError(null);
  }, []);

  const clearAuthentication = useCallback(() => {
    authSession.clear();
    setUser(null);
    setSelectedAccountId(null);
    setStatus('unauthenticated');
  }, []);

  const bootstrap = useCallback(async (showLoading: boolean) => {
    if (!authSession.get()) {
      clearAuthentication();
      return;
    }
    if (showLoading) setStatus('loading');
    try {
      await authService.validateSession();
      await loadProfile();
    } catch (cause) {
      if (cause instanceof ChatwootApiError && cause.status !== 401) {
        // Refreshes triggered by realtime cache invalidation must not replace
        // a working chat with the full-screen session checker on a transient
        // network/API failure.
        if (showLoading) {
          setError(cause.message);
          setStatus('error');
        }
        return;
      }
      clearAuthentication();
    }
  }, [clearAuthentication, loadProfile]);

  useEffect(() => { void bootstrap(true); }, [bootstrap]);

  const login = useCallback(async (credentials: AuthCredentials): Promise<MfaRequiredResponse | null> => {
    setError(null);
    try {
      // A stale token must not be sent with a new sign-in attempt.
      authSession.clear();
      const result = await authService.login(credentials);
      if ('mfa_required' in result) {
        setStatus('unauthenticated');
        return result;
      }
      await loadProfile();
      return null;
    } catch (cause) {
      clearAuthentication();
      throw cause;
    }
  }, [clearAuthentication, loadProfile]);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // A limpeza local é obrigatória inclusive quando o backend está indisponível.
    } finally {
      clearAuthentication();
    }
  }, [clearAuthentication]);

  const verifyMfa = useCallback(async (credentials: MfaVerificationCredentials) => {
    setError(null);
    try {
      await authService.verifyMfa(credentials);
      await loadProfile();
    } catch (cause) {
      clearAuthentication();
      throw cause;
    }
  }, [clearAuthentication, loadProfile]);

  const currentAccount = useMemo(() => {
    if (!user) return null;
    return user.accounts.find((account) => account.id === selectedAccountId) ?? user.accounts[0] ?? null;
  }, [user, selectedAccountId]);

  const selectAccount = useCallback(async (accountId: number) => {
    if (!user?.accounts.some((account) => account.id === accountId)) return;
    if (accountId === selectedAccountId) return;
    await authService.setActiveAccount(accountId);
    setSelectedAccountId(accountId);
  }, [selectedAccountId, user]);

  const retryBootstrap = useCallback(() => bootstrap(false), [bootstrap]);

  const value = useMemo(() => ({ status, user, currentAccount, selectAccount, error, login, verifyMfa, logout, retryBootstrap }),
    [status, user, currentAccount, selectAccount, error, login, verifyMfa, logout, retryBootstrap]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  return context;
};
