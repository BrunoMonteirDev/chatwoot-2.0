import { describe, expect, it, vi } from 'vitest';
import { WahaApiError } from './waha.js';
import { WahaSessionOwnershipError } from './wahaSessionStore.js';
import { deleteWahaInbox } from './wahaInboxDeletion.js';

const dependenciesFor = (attributes: Record<string, unknown>) => {
  const inbox = { additionalAttributes: attributes };
  return {
    chatwoot: {
      findInbox: vi.fn(async () => inbox),
      deleteInbox: vi.fn(async () => undefined),
    },
    sessions: {
      get: vi.fn(async () => ({ accountId: 1, inboxId: 10 })),
      reserve: vi.fn(async () => undefined),
      assertOwned: vi.fn(async () => undefined),
      update: vi.fn(async () => undefined),
      remove: vi.fn(async () => undefined),
    },
    waha: { deleteSession: vi.fn(async () => undefined) },
    log: { warn: vi.fn() },
  };
};

describe('WAHA inbox deletion', () => {
  it('deletes the owned WAHA session before deleting the local inbox', async () => {
    const dependencies = dependenciesFor({ whatsapp_transports: ['waha'], waha_session_name: 'session-a' });
    await deleteWahaInbox(1, 10, dependencies);
    expect(dependencies.waha.deleteSession).toHaveBeenCalledWith('session-a');
    expect(dependencies.sessions.remove).toHaveBeenCalledWith(1, 10, 'session-a');
    expect(dependencies.chatwoot.deleteInbox).toHaveBeenCalledOnce();
  });

  it.each([new WahaApiError('network'), new WahaApiError('timeout'), new WahaApiError('api', 503)])('keeps local deletion available when WAHA cleanup fails operationally', async (error) => {
    const dependencies = dependenciesFor({ whatsapp_transports: ['waha'], waha_session_name: 'session-a' });
    dependencies.waha.deleteSession.mockRejectedValue(error);
    await deleteWahaInbox(1, 10, dependencies);
    expect(dependencies.sessions.update).toHaveBeenCalledWith('session-a', { status: 'cleanup_pending' });
    expect(dependencies.sessions.remove).not.toHaveBeenCalled();
    expect(dependencies.chatwoot.deleteInbox).toHaveBeenCalledOnce();
  });

  it('removes ownership when WAHA already reports the session missing', async () => {
    const dependencies = dependenciesFor({ whatsapp_transports: ['waha'], waha_session_name: 'session-a' });
    dependencies.waha.deleteSession.mockRejectedValue(new WahaApiError('api', 404));
    await deleteWahaInbox(1, 10, dependencies);
    expect(dependencies.sessions.remove).toHaveBeenCalledWith(1, 10, 'session-a');
    expect(dependencies.chatwoot.deleteInbox).toHaveBeenCalledOnce();
  });

  it('keeps deletion blocked when ownership belongs to another inbox or tenant', async () => {
    const dependencies = dependenciesFor({ whatsapp_transports: ['waha'], waha_session_name: 'session-a' });
    dependencies.sessions.assertOwned.mockRejectedValue(new WahaSessionOwnershipError('forbidden'));
    await expect(deleteWahaInbox(1, 10, dependencies)).rejects.toMatchObject({ code: 'forbidden' });
    expect(dependencies.waha.deleteSession).not.toHaveBeenCalled();
    expect(dependencies.chatwoot.deleteInbox).not.toHaveBeenCalled();
  });

  it('does not call WAHA for residual session metadata or Meta-only inboxes', async () => {
    const dependencies = dependenciesFor({ whatsapp_transports: ['meta_cloud'], waha_session_name: 'residual' });
    await deleteWahaInbox(1, 10, dependencies);
    expect(dependencies.waha.deleteSession).not.toHaveBeenCalled();
    expect(dependencies.sessions.assertOwned).not.toHaveBeenCalled();
    expect(dependencies.chatwoot.deleteInbox).toHaveBeenCalledOnce();
  });

  it('uses WAHA cleanup for a hybrid inbox only when waha is declared', async () => {
    const dependencies = dependenciesFor({ whatsapp_transports: ['meta_cloud', 'waha'], waha_session_name: 'session-a' });
    await deleteWahaInbox(1, 10, dependencies);
    expect(dependencies.waha.deleteSession).toHaveBeenCalledWith('session-a');
    expect(dependencies.chatwoot.deleteInbox).toHaveBeenCalledOnce();
  });
});
