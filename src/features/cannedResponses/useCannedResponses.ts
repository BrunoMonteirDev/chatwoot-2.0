import { useCallback, useEffect, useRef, useState } from 'react';
import type { CannedResponse } from '../../domain/currentUser';
import { cannedResponseService } from '../../integrations/chatwoot/cannedResponses';
import { errorMessageForUser } from '../../integrations/chatwoot/errors';

export type CannedResponsesStatus = 'idle' | 'loading' | 'ready' | 'error';

export const useCannedResponses = (accountId: number | null, enabled: boolean, search: string) => {
  const [responses, setResponses] = useState<CannedResponse[]>([]);
  const [status, setStatus] = useState<CannedResponsesStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    if (!accountId || !enabled) {
      setResponses([]);
      setError(null);
      setStatus('idle');
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const request = ++requestRef.current;
    setStatus('loading');
    setError(null);
    try {
      const nextResponses = await cannedResponseService.list({ accountId, search, signal: controller.signal });
      if (controller.signal.aborted || request !== requestRef.current) return;
      setResponses(nextResponses);
      setStatus('ready');
    } catch (cause) {
      if (controller.signal.aborted || request !== requestRef.current) return;
      setResponses([]);
      setError(errorMessageForUser(cause));
      setStatus('error');
    }
  }, [accountId, enabled, search]);

  useEffect(() => {
    void load();
    return () => abortRef.current?.abort();
  }, [load]);

  return { responses, status, error, retry: load };
};
