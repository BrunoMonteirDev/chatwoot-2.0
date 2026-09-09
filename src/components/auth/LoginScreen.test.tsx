// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const login = vi.hoisted(() => vi.fn());
vi.mock('../../features/auth/AuthContext', () => ({ useAuth: () => ({ login, verifyMfa: vi.fn() }) }));

import { LoginScreen } from './LoginScreen';

describe('LoginScreen session limit', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    login.mockReset().mockResolvedValue({ sessions_limit_reached: true, sessions: [{ id: 17, device_name: 'Notebook', browser_name: 'Chrome' }] });
  });

  afterEach(() => { act(() => root.unmount()); container.remove(); });

  it('mostra as sessões do 409 e repete o login com a sessão escolhida', async () => {
    await act(async () => root.render(<LoginScreen />));
    const [email, password] = Array.from(container.querySelectorAll('input'));
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(email, 'agent@example.test'); email.dispatchEvent(new Event('input', { bubbles: true }));
      setter.call(password, 'safe-test-password'); password.dispatchEvent(new Event('input', { bubbles: true }));
      container.querySelector<HTMLFormElement>('form')!.requestSubmit();
    });

    expect(container.textContent).toContain('O limite de sessões foi atingido');
    await act(async () => { Array.from(container.querySelectorAll('button')).find(button => button.textContent?.includes('Notebook'))!.click(); });

    expect(login).toHaveBeenLastCalledWith({ email: 'agent@example.test', password: 'safe-test-password' }, 17);
  });
});
