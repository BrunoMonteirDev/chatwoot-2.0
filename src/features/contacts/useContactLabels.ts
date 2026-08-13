import { useCallback, useEffect, useRef, useState } from 'react';
import type { AccountLabel } from '../../domain/currentUser';
import { contactService } from '../../integrations/chatwoot/contacts';
import { errorMessageForUser } from '../../integrations/chatwoot/errors';

export type ContactLabelsStatus = 'idle' | 'loading' | 'ready' | 'error';

export const useContactLabels = (accountId: number | null, contactId: number | null) => {
  const [availableLabels, setAvailableLabels] = useState<AccountLabel[]>([]);
  const [labels, setLabels] = useState<string[]>([]);
  const [status, setStatus] = useState<ContactLabelsStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const requestRef = useRef(0);
  const activeTargetRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    if (!accountId || !contactId) {
      setAvailableLabels([]); setLabels([]); setStatus('idle'); setError(null);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    const request = ++requestRef.current;
    const target = `${accountId}:${contactId}`;
    activeTargetRef.current = target;
    setStatus('loading'); setError(null);
    try {
      const [nextAvailable, nextLabels] = await Promise.all([
        contactService.listAvailableLabels(accountId, controller.signal),
        contactService.listLabels(accountId, contactId, controller.signal),
      ]);
      if (controller.signal.aborted || request !== requestRef.current || activeTargetRef.current !== target) return;
      setAvailableLabels(nextAvailable); setLabels(nextLabels); setStatus('ready');
    } catch (cause) {
      if (controller.signal.aborted || request !== requestRef.current || activeTargetRef.current !== target) return;
      setAvailableLabels([]); setLabels([]); setError(errorMessageForUser(cause)); setStatus('error');
    }
  }, [accountId, contactId]);

  useEffect(() => {
    void load();
    return () => abortRef.current?.abort();
  }, [load]);

  const update = useCallback(async (nextLabels: string[]) => {
    if (!accountId || !contactId || isUpdating) return null;
    const target = `${accountId}:${contactId}`;
    setIsUpdating(true);
    try {
      const updated = await contactService.setLabels(accountId, contactId, nextLabels);
      if (activeTargetRef.current === target) setLabels(updated);
      return updated;
    } finally {
      setIsUpdating(false);
    }
  }, [accountId, contactId, isUpdating]);

  return { availableLabels, labels, status, error, isUpdating, retry: load, update };
};
