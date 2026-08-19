import { describe, expect, it } from 'vitest';
import { MetaEmbeddedSignupSessionStore } from './metaEmbeddedSignupStore';

describe('MetaEmbeddedSignupSessionStore', () => {
  it('vincula a sessão à inbox existente e ao modo solicitado', async () => {
    const store = new MetaEmbeddedSignupSessionStore(60_000, () => 1_000);
    const session = await store.start({ accountId: 1, inboxId: 42, inboxName: null, onboardingMode: 'standard' });
    await expect(store.get(session.id)).resolves.toMatchObject({ accountId: 1, inboxId: 42, onboardingMode: 'standard', stage: 'started' });
    expect(store.permitsInbox(session, 42)).toBe(true);
    expect(store.permitsInbox(session, 43)).toBe(false);
  });

  it('expira sessões temporárias e não permite reutilização depois do consumo', async () => {
    let now = 1_000;
    const store = new MetaEmbeddedSignupSessionStore(100, () => now);
    const expiring = await store.start({ accountId: 1, inboxId: null, inboxName: 'Nova', onboardingMode: 'coexistence' });
    now = 1_101;
    await expect(store.get(expiring.id)).resolves.toBeNull();

    now = 2_000;
    const session = await store.start({ accountId: 1, inboxId: null, inboxName: 'Nova', onboardingMode: 'standard' });
    await expect(store.consume(session.id)).resolves.toMatchObject({ id: session.id });
    await expect(store.consume(session.id)).resolves.toBeNull();
  });
});
