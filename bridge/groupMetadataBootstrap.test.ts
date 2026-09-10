import { describe, expect, it, vi } from 'vitest';
import { GroupMetadataBootstrap } from './groupMetadataBootstrap';

describe('fresh group metadata bootstrap', () => {
  it('hydrates an empty installation once and treats persistence as the read source afterwards', async () => {
    const store: { participants: string[]; description?: string } = { participants: [] };
    const provider = vi.fn().mockResolvedValue({ participants: ['a', 'b'], description: 'Equipe' });
    const persist = vi.fn(async (snapshot: { participants: string[]; description?: string }) => Object.assign(store, snapshot));
    const bootstrap = new GroupMetadataBootstrap();
    const sync = async () => { const snapshot = await provider(); await persist(snapshot); return snapshot.participants.length > 0; };

    await expect(Promise.all([
      bootstrap.run('1:5:120@g.us', async () => store.participants.length > 0, sync),
      bootstrap.run('1:5:120@g.us', async () => store.participants.length > 0, sync),
    ])).resolves.toEqual(['bootstrapped', 'bootstrapped']);
    await expect(bootstrap.run('1:5:120@g.us', async () => store.participants.length > 0, sync)).resolves.toBe('already_persisted');
    expect(store).toEqual({ participants: ['a', 'b'], description: 'Equipe' });
    expect(provider).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('backs off after an unavailable snapshot instead of polling on every message', async () => {
    let now = 100;
    const provider = vi.fn().mockResolvedValue(false);
    const bootstrap = new GroupMetadataBootstrap(1_000, () => now);

    await expect(bootstrap.run('1:5:120@g.us', async () => false, provider)).resolves.toBe('deferred');
    await expect(bootstrap.run('1:5:120@g.us', async () => false, provider)).resolves.toBe('deferred');
    expect(provider).toHaveBeenCalledTimes(1);
    now = 1_101;
    await expect(bootstrap.run('1:5:120@g.us', async () => false, provider)).resolves.toBe('deferred');
    expect(provider).toHaveBeenCalledTimes(2);
  });
});
