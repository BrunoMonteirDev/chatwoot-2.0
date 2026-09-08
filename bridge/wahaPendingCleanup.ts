import { WahaApiError } from './waha.js';

type PendingOwnership = { accountId: number; inboxId: number; sessionName: string; status?: string };

type Dependencies = {
  sessions: {
    listCleanupPending(): Promise<PendingOwnership[]>;
    remove(accountId: number, inboxId: number, sessionName: string): Promise<void>;
  };
  waha: { deleteSession(sessionName: string): Promise<unknown> };
  log: Pick<Console, 'info' | 'warn'>;
};

// The tombstone is the authorization boundary: this worker never reconstructs
// inbox state or accepts caller input, it only acts on durable ownership rows.
export const retryPendingWahaCleanup = async ({ sessions, waha, log }: Dependencies) => {
  const pending = await sessions.listCleanupPending();
  for (const ownership of pending) {
    try {
      await waha.deleteSession(ownership.sessionName);
      await sessions.remove(ownership.accountId, ownership.inboxId, ownership.sessionName);
      log.info('[KOPLA_WAHA_CLEANUP] completed', { accountId: ownership.accountId, inboxId: ownership.inboxId, sessionName: ownership.sessionName, result: 'deleted' });
    } catch (error) {
      if (error instanceof WahaApiError && error.status === 404) {
        await sessions.remove(ownership.accountId, ownership.inboxId, ownership.sessionName);
        log.info('[KOPLA_WAHA_CLEANUP] completed', { accountId: ownership.accountId, inboxId: ownership.inboxId, sessionName: ownership.sessionName, result: 'already_missing' });
        continue;
      }
      log.warn('[KOPLA_WAHA_CLEANUP] deferred', {
        accountId: ownership.accountId,
        inboxId: ownership.inboxId,
        sessionName: ownership.sessionName,
        kind: error instanceof WahaApiError ? error.kind : 'unknown',
        status: error instanceof WahaApiError ? error.status : undefined,
      });
    }
  }
};
