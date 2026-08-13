import { useCallback, useEffect, useState } from 'react';
import type { Inbox } from '../../domain/currentUser';
import { inboxService } from '../../integrations/chatwoot/inboxes';
import { errorMessageForUser } from '../../integrations/chatwoot/errors';

export type InboxesStatus = 'idle' | 'loading' | 'ready' | 'error';

export const useInboxes = (accountId: number | null) => {
  const [inboxes, setInboxes] = useState<Inbox[]>([]);
  const [status, setStatus] = useState<InboxesStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!accountId) {
      setInboxes([]);
      setStatus('idle');
      return;
    }
    setStatus('loading');
    setError(null);
    try {
      setInboxes(await inboxService.list(accountId));
      setStatus('ready');
    } catch (cause) {
      setInboxes([]);
      setError(errorMessageForUser(cause));
      setStatus('error');
    }
  }, [accountId]);

  useEffect(() => { void load(); }, [load]);

  return { inboxes, status, error, retry: load };
};
