import { describe, expect, it } from 'vitest';
import { unavailableOwnedWahaSession } from './wahaSessionFallback';

describe('unavailableOwnedWahaSession', () => {
  it('preserves binding identity while reporting provider failure', () => {
    expect(unavailableOwnedWahaSession({ provider: 'waha', accountId: 2, inboxId: 152, sessionName: 'KoplaComercial', status: 'WORKING', engine: 'GOWS', createdAt: 'x', updatedAt: 'x' }))
      .toEqual({ name: 'KoplaComercial', linked: true, status: 'FAILED', connectionStatus: 'error', engine: 'GOWS' });
  });
});
