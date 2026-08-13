import type { AuthSession } from './types';

const storageKey = 'chatwoot_custom_auth_session_v1';

const isBrowser = () => typeof window !== 'undefined';

const hasRequiredFields = (value: Partial<AuthSession>): value is AuthSession =>
  Boolean(value.accessToken && value.tokenType && value.client && value.expiry && value.uid);

export const authSession = {
  get(): AuthSession | null {
    if (!isBrowser()) return null;

    try {
      const raw = window.sessionStorage.getItem(storageKey);
      if (!raw) return null;
      const value = JSON.parse(raw) as Partial<AuthSession>;
      return hasRequiredFields(value) ? value : null;
    } catch {
      this.clear();
      return null;
    }
  },

  set(session: AuthSession): void {
    if (!isBrowser()) return;
    window.sessionStorage.setItem(storageKey, JSON.stringify(session));
  },

  clear(): void {
    if (!isBrowser()) return;
    window.sessionStorage.removeItem(storageKey);
  },
};
