// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { authSession } from './authSession';

describe('authSession', () => {
  beforeEach(() => { sessionStorage.clear(); localStorage.clear(); });

  it('persiste somente os cinco headers necessários para a sessão Devise', () => {
    authSession.set({ accessToken: 'a', tokenType: 'Bearer', client: 'c', expiry: '1', uid: 'u@example.test' });
    expect(authSession.get()).toEqual({ accessToken: 'a', tokenType: 'Bearer', client: 'c', expiry: '1', uid: 'u@example.test' });
  });

  it('remove a sessão no logout', () => {
    authSession.set({ accessToken: 'a', tokenType: 'Bearer', client: 'c', expiry: '1', uid: 'u@example.test' });
    authSession.clear();
    expect(authSession.get()).toBeNull();
  });
});
