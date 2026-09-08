import { describe, expect, it, vi } from 'vitest';
import { WahaApiError } from './waha.js';
import { retryPendingWahaCleanup } from './wahaPendingCleanup.js';

const ownership = { accountId: 4, inboxId: 9, sessionName: 'session-pending', status: 'cleanup_pending' };
const dependenciesFor = (items = [ownership]) => ({
  sessions: { listCleanupPending: vi.fn(async () => items), remove: vi.fn(async () => undefined) },
  waha: { deleteSession: vi.fn(async () => undefined) },
  log: { info: vi.fn(), warn: vi.fn() },
});

describe('WAHA pending cleanup retry', () => {
  it('removes a pending tombstone after a successful external deletion', async () => {
    const dependencies = dependenciesFor();
    await retryPendingWahaCleanup(dependencies);
    expect(dependencies.waha.deleteSession).toHaveBeenCalledWith('session-pending');
    expect(dependencies.sessions.remove).toHaveBeenCalledWith(4, 9, 'session-pending');
    expect(dependencies.log.info).toHaveBeenCalledWith('[KOPLA_WAHA_CLEANUP] completed', expect.objectContaining({ result: 'deleted' }));
  });

  it('treats a 404 as completed cleanup', async () => {
    const dependencies = dependenciesFor();
    dependencies.waha.deleteSession.mockRejectedValue(new WahaApiError('api', 404));
    await retryPendingWahaCleanup(dependencies);
    expect(dependencies.sessions.remove).toHaveBeenCalledWith(4, 9, 'session-pending');
    expect(dependencies.log.info).toHaveBeenCalledWith('[KOPLA_WAHA_CLEANUP] completed', expect.objectContaining({ result: 'already_missing' }));
  });

  it.each([new WahaApiError('network'), new WahaApiError('timeout'), new WahaApiError('api', 503)])('keeps the tombstone pending after temporary WAHA failure', async (error) => {
    const dependencies = dependenciesFor();
    dependencies.waha.deleteSession.mockRejectedValue(error);
    await retryPendingWahaCleanup(dependencies);
    expect(dependencies.sessions.remove).not.toHaveBeenCalled();
    expect(dependencies.log.warn).toHaveBeenCalledWith('[KOPLA_WAHA_CLEANUP] deferred', expect.objectContaining({ accountId: 4, inboxId: 9 }));
  });

  it('does not process normal ownership records', async () => {
    const dependencies = dependenciesFor([]);
    await retryPendingWahaCleanup(dependencies);
    expect(dependencies.waha.deleteSession).not.toHaveBeenCalled();
    expect(dependencies.sessions.remove).not.toHaveBeenCalled();
  });
});
