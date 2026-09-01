import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConversationSummary } from '../../domain/currentUser';
import { conversationService } from '../../integrations/chatwoot/conversations';
import { errorMessageForUser } from '../../integrations/chatwoot/errors';

export type ContactConversationsStatus = 'idle' | 'loading' | 'ready' | 'error';

export const useContactConversations = (accountId: number | null, contactId: number | null, enabled = true) => {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [status, setStatus] = useState<ContactConversationsStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    if (!enabled || !accountId || !contactId) {
      setConversations([]);
      setStatus('idle');
      setError(null);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const request = ++requestRef.current;
    setStatus('loading');
    setError(null);
    try {
      const result = await conversationService.listByContact(accountId, contactId, controller.signal);
      if (controller.signal.aborted || request !== requestRef.current) return;
      setConversations(result);
      setStatus('ready');
    } catch (cause) {
      if (controller.signal.aborted || request !== requestRef.current) return;
      setConversations([]);
      setError(errorMessageForUser(cause));
      setStatus('error');
    }
  }, [accountId, contactId, enabled]);

  useEffect(() => {
    void load();
    return () => abortRef.current?.abort();
  }, [load]);

  return { conversations, status, error, retry: load };
};
