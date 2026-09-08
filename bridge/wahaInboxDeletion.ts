import { transportConfigurationForInbox } from './providers.js';
import { WahaApiError } from './waha.js';

type Inbox = { additionalAttributes: Record<string, unknown> };
type Ownership = { accountId: number; inboxId: number };

type Dependencies = {
  chatwoot: {
    findInbox(): Promise<Inbox>;
    deleteInbox(): Promise<void>;
  };
  sessions: {
    get(sessionName: string): Promise<Ownership | null>;
    reserve(input: { accountId: number; inboxId: number; sessionName: string }): Promise<unknown>;
    assertOwned(accountId: number, inboxId: number, sessionName: string): Promise<unknown>;
    update(sessionName: string, patch: { status: string }): Promise<unknown>;
    remove(accountId: number, inboxId: number, sessionName: string): Promise<void>;
  };
  waha: { deleteSession(sessionName: string): Promise<unknown> };
  log: Pick<Console, 'warn'>;
};

const validSessionName = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value);

export const deleteWahaInbox = async (accountId: number, inboxId: number, dependencies: Dependencies) => {
  const inbox = await dependencies.chatwoot.findInbox();
  const configuration = transportConfigurationForInbox(inbox.additionalAttributes);
  const sessionName = inbox.additionalAttributes.waha_session_name;

  if (configuration?.transports.includes('waha') && validSessionName(sessionName)) {
    if (!(await dependencies.sessions.get(sessionName))) {
      await dependencies.sessions.reserve({ accountId, inboxId, sessionName });
    }
    await dependencies.sessions.assertOwned(accountId, inboxId, sessionName);
    try {
      await dependencies.waha.deleteSession(sessionName);
      await dependencies.sessions.remove(accountId, inboxId, sessionName);
    } catch (error) {
      if (error instanceof WahaApiError && error.status === 404) {
        await dependencies.sessions.remove(accountId, inboxId, sessionName);
      } else {
        dependencies.log.warn('[waha] inbox session cleanup deferred', {
          accountId, inboxId, sessionName, kind: error instanceof WahaApiError ? error.kind : 'unknown',
          status: error instanceof WahaApiError ? error.status : undefined,
          message: error instanceof Error ? error.message.slice(0, 240) : 'unknown error',
        });
        await dependencies.sessions.update(sessionName, { status: 'cleanup_pending' });
      }
    }
  }

  await dependencies.chatwoot.deleteInbox();
};
