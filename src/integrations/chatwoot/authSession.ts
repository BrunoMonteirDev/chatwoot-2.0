import type { AuthSession } from './types';

const storageKey = 'chatwoot_custom_auth_session_v1';

const isBrowser = () => typeof window !== 'undefined';

const hasRequiredFields = (value: Partial<AuthSession>): value is AuthSession =>
  Boolean(value.accessToken && value.tokenType && value.client && value.expiry && value.uid);

export const authSession = {
  get(): AuthSession | null {
    if (!isBrowser()) return null;

    try {
      // A login must survive closing the browser or reopening an installed
      // PWA. Keep a one-time migration from the old tab-only store so current
      // sessions continue seamlessly after this release.
      const raw = window.localStorage.getItem(storageKey) || window.sessionStorage.getItem(storageKey);
      if (!raw) return null;
      const value = JSON.parse(raw) as Partial<AuthSession>;
      if (!hasRequiredFields(value)) return null;
      window.localStorage.setItem(storageKey, JSON.stringify(value));
      window.sessionStorage.removeItem(storageKey);
      return value;
    } catch {
      this.clear();
      return null;
    }
  },

  set(session: AuthSession): void {
    if (!isBrowser()) return;
    window.localStorage.setItem(storageKey, JSON.stringify(session));
  },

  clear(): void {
    if (!isBrowser()) return;
    window.localStorage.removeItem(storageKey);
    window.sessionStorage.removeItem(storageKey);
  },
};
