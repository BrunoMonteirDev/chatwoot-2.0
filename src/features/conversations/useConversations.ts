import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConversationMessage, ConversationSummary } from '../../domain/currentUser';
import { errorMessageForUser } from '../../integrations/chatwoot/errors';
import { conversationService, type ConversationServerFilters } from '../../integrations/chatwoot/conversations';

export const matchesConversationFilters = (
  conversation: ConversationSummary,
  selectedInbox: string,
  filters: ConversationServerFilters,
) => {
  const inboxId = /^\d+$/.test(selectedInbox) ? Number(selectedInbox) : null;
  return (!inboxId || conversation.inboxId === inboxId) &&
    (!filters.teamId || conversation.teamId === filters.teamId) &&
    (filters.labels || []).every((label) => conversation.labels.includes(label));
};

const phoneLikeName = (name: string) => /^[+\d\s().-]+$/.test(name) && name.replace(/\D/g, '').length >= 8;
const preserveResolvedContact = (current: ConversationSummary, incoming: ConversationSummary): ConversationSummary => ({
  ...incoming,
  ...(current.contactAvatarUrl && !incoming.contactAvatarUrl ? { contactAvatarUrl: current.contactAvatarUrl } : {}),
  ...(!phoneLikeName(current.contactName) && phoneLikeName(incoming.contactName) ? { contactName: current.contactName } : {}),
});

export const mergeFilteredRealtimeConversation = (
  current: ConversationSummary[],
  updated: ConversationSummary,
  selectedInbox: string,
  filters: ConversationServerFilters,
): ConversationSummary[] => {
  const previous = current.find((conversation) => conversation.id === updated.id);
  const merged = previous ? preserveResolvedContact(previous, { ...previous, ...updated }) : updated;
  if (!matchesConversationFilters(merged, selectedInbox, filters)) return previous ? current.filter((conversation) => conversation.id !== updated.id) : current;
  return mergeRealtimeConversation(current, updated, selectedInbox);
};

export const mergeRealtimeConversation = (current: ConversationSummary[], updated: ConversationSummary, selectedInbox: string): ConversationSummary[] => {
  const existing = current.find(item => item.id === updated.id);
  // ActionCable may deliver the specific event and conversation.updated in
  // either order. Never let an older (or equally old but less active) payload
  // put a conversation back into a previous state.
  if (existing && (existing.updatedAt > updated.updatedAt || (existing.updatedAt === updated.updatedAt && existing.lastActivityAt > updated.lastActivityAt))) return current;
  const normalizedInboxId = /^\d+$/.test(selectedInbox) ? Number(selectedInbox) : null;
  if (!existing && normalizedInboxId && updated.inboxId !== normalizedInboxId) return current;
  const merged = existing ? preserveResolvedContact(existing, { ...existing, ...updated }) : updated;
  return [merged, ...current.filter(item => item.id !== updated.id)].sort((a, b) => b.lastActivityAt - a.lastActivityAt);
};

export const useConversations = (accountId: number | null, selectedInbox: string, filters: ConversationServerFilters = {}) => {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const refreshAbortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const refreshRequestIdRef = useRef(0);
  const pageRef = useRef(1);
  const loadedAccountRef = useRef<number | null>(null);

  const inboxId = /^\d+$/.test(selectedInbox) ? Number(selectedInbox) : undefined;
  const filterKey = `${filters.teamId || ''}:${(filters.labels || []).join('|')}`;
  const scopeKey = `${accountId ?? ''}:${selectedInbox}:${filterKey}`;
  const scopeKeyRef = useRef(scopeKey);
  scopeKeyRef.current = scopeKey;
  const load = useCallback(async (page: number, append: boolean) => {
    if (!accountId) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestIdRef.current;
    const isInitialLoad = !append && loadedAccountRef.current !== accountId;
    if (append) setIsLoadingMore(true);
    else if (isInitialLoad) setStatus('loading');
    else setIsRefreshing(true);
    setError(null);
    try {
      const result = await conversationService.list({ accountId, inboxId, ...filters, page, signal: controller.signal });
      if (controller.signal.aborted || requestId !== requestIdRef.current) return;
      setConversations((current) => append
        ? result.conversations.reduce((items, conversation) => mergeRealtimeConversation(items, conversation, selectedInbox), current)
        : result.conversations);
      pageRef.current = page;
      setHasNextPage(result.hasNextPage);
      loadedAccountRef.current = accountId;
      setStatus('ready');
    } catch (cause) {
      if (controller.signal.aborted || requestId !== requestIdRef.current) return;
      setError(errorMessageForUser(cause));
      // A background refresh is advisory. Retain the list already rendered
      // instead of replacing it with an error state on a transient failure.
      if (isInitialLoad) setStatus('error');
    } finally {
      if (!controller.signal.aborted && requestId === requestIdRef.current) {
        setIsLoadingMore(false);
        setIsRefreshing(false);
      }
    }
  }, [accountId, inboxId, filterKey]);

  useEffect(() => {
    if (!accountId) { loadedAccountRef.current = null; setConversations([]); setStatus('idle'); setIsRefreshing(false); return; }
    refreshAbortRef.current?.abort();
    pageRef.current = 1;
    setHasNextPage(false);
    setConversations([]);
    setStatus('loading');
    setIsRefreshing(false);
    setIsLoadingMore(false);
    void load(1, false);
    return () => {
      abortRef.current?.abort();
      refreshAbortRef.current?.abort();
    };
  }, [accountId, inboxId, filterKey, load]);

  const loadMore = useCallback(() => {
    if (status === 'ready' && !isLoadingMore && hasNextPage) void load(pageRef.current + 1, true);
  }, [hasNextPage, isLoadingMore, load, status]);

  const applyOutgoingMessage = useCallback((message: ConversationMessage) => {
    setConversations(current => {
      const conversation = current.find(item => item.id === message.conversationId);
      if (!conversation) return current;
      const updated: ConversationSummary = {
        ...conversation,
        lastMessage: message.kind === 'private_note' ? `🔒 Nota: ${message.content}` : message.content,
        lastMessageByCurrentUser: true,
        lastActivityAt: message.createdAt,
      };
      return [updated, ...current.filter(item => item.id !== message.conversationId)];
    });
  }, []);

  const applyConversationUpdate = useCallback((conversationId: number, update: Partial<ConversationSummary>) => {
    setConversations((current) => {
      const conversation = current.find((item) => item.id === conversationId);
      if (!conversation) return current;
      return mergeFilteredRealtimeConversation(current, { ...conversation, ...update }, selectedInbox, filters);
    });
  }, [filterKey, selectedInbox]);

  const removeConversation = useCallback((conversationId: number) => {
    setConversations(current => current.filter(conversation => conversation.id !== conversationId));
  }, []);

  const replaceConversation = useCallback((updated: ConversationSummary) => {
    setConversations(current => mergeFilteredRealtimeConversation(current, updated, selectedInbox, filters));
  }, [filterKey, selectedInbox]);

  const upsertRealtimeConversation = useCallback((updated: ConversationSummary) => {
    setConversations(current => mergeFilteredRealtimeConversation(current, updated, selectedInbox, filters));
  }, [filterKey, selectedInbox]);

  const refreshRecentConversations = useCallback(() => {
    if (!accountId) return;

    refreshAbortRef.current?.abort();
    const controller = new AbortController();
    refreshAbortRef.current = controller;
    const refreshId = ++refreshRequestIdRef.current;
    const requestScope = scopeKey;

    void conversationService.list({
      accountId,
      inboxId,
      ...filters,
      page: 1,
      signal: controller.signal,
    }).then((result) => {
      if (
        controller.signal.aborted ||
        refreshId !== refreshRequestIdRef.current ||
        requestScope !== scopeKeyRef.current
      ) return;
      setConversations((current) => result.conversations.reduce(
        (items, conversation) => mergeFilteredRealtimeConversation(items, conversation, selectedInbox, filters),
        current,
      ));
    }).catch((cause) => {
      if (cause?.name !== 'AbortError') console.error('Failed to refresh conversations:', cause);
    });
  }, [accountId, filterKey, inboxId, scopeKey, selectedInbox]);

  const addCreatedConversation = useCallback((created: ConversationSummary) => {
    setConversations(current => mergeFilteredRealtimeConversation(current, created, selectedInbox, filters));
  }, [filterKey, selectedInbox]);

  const applyRealtimeMessage = useCallback((message: ConversationMessage, unreadCount?: number, lastActivityAt?: number) => {
    setConversations(current => {
      const conversation = current.find(item => item.id === message.conversationId);
      if (!conversation) return current;
      const isPreviewable = message.kind !== 'activity';
      const updated: ConversationSummary = {
        ...conversation,
        lastMessage: isPreviewable ? (message.kind === 'private_note' ? `🔒 Nota: ${message.content}` : message.content || (message.attachments.length ? 'Anexo' : 'Sem mensagens')) : conversation.lastMessage,
        lastMessageByCurrentUser: message.kind === 'outgoing' || message.kind === 'private_note',
        lastActivityAt: lastActivityAt ?? message.createdAt,
        unreadCount: unreadCount ?? conversation.unreadCount,
      };
      return [updated, ...current.filter(item => item.id !== message.conversationId)];
    });
  }, []);

  return { conversations, status, error, hasNextPage, isLoadingMore, isRefreshing, retry: () => load(1, false), loadMore, applyOutgoingMessage, applyConversationUpdate, removeConversation, replaceConversation, upsertRealtimeConversation, addCreatedConversation, applyRealtimeMessage, refreshRecentConversations };
};
