import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConversationAttachmentSummary } from '../../domain/currentUser';
import { conversationAttachmentService } from '../../integrations/chatwoot/conversationAttachments';
import { errorMessageForUser } from '../../integrations/chatwoot/errors';

export const useConversationAttachments = (accountId: number | null, conversationId: number | null, enabled: boolean) => {
  const [attachments, setAttachments] = useState<ConversationAttachmentSummary[]>([]); const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle'); const [error, setError] = useState<string | null>(null); const [page, setPage] = useState(0); const [totalCount, setTotalCount] = useState(0); const abort = useRef<AbortController | null>(null);
  const load = useCallback(async (nextPage = 1, append = false) => { abort.current?.abort(); if (!enabled || !accountId || !conversationId) { setAttachments([]); setStatus('idle'); return; } const controller = new AbortController(); abort.current = controller; setStatus('loading'); setError(null); try { const result = await conversationAttachmentService.list(accountId, conversationId, nextPage, controller.signal); if (controller.signal.aborted) return; setAttachments(current => append ? [...current, ...result.attachments.filter(item => !current.some(existing => existing.id === item.id))] : result.attachments); setPage(nextPage); setTotalCount(result.totalCount); setStatus('ready'); } catch (cause) { if (!controller.signal.aborted) { setError(errorMessageForUser(cause)); setStatus('error'); } } }, [accountId, conversationId, enabled]);
  useEffect(() => { void load(); return () => abort.current?.abort(); }, [load]);
  return { attachments, status, error, hasMore: attachments.length < totalCount, loadMore: () => void load(page + 1, true), retry: () => void load() };
};
