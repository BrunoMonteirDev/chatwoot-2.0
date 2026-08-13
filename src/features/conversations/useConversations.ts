import { useCallback, useEffect, useRef, useState } from 'react';
import type { ConversationMessage, ConversationSummary } from '../../domain/currentUser';
import { errorMessageForUser } from '../../integrations/chatwoot/errors';
import { conversationService } from '../../integrations/chatwoot/conversations';

export const mergeRealtimeConversation = (current: ConversationSummary[], updated: ConversationSummary, selectedInbox: string): ConversationSummary[] => {
  const existing = current.find(item => item.id === updated.id);
  if (existing && existing.updatedAt > updated.updatedAt) return current;
  const normalizedInboxId = /^\d+$/.test(selectedInbox) ? Number(selectedInbox) : null;
  if (!existing && normalizedInboxId && updated.inboxId !== normalizedInboxId) return current;
  const merged = existing ? { ...existing, ...updated } : updated;
  return [merged, ...current.filter(item => item.id !== updated.id)].sort((a, b) => b.lastActivityAt - a.lastActivityAt);
};

export const useConversations = (accountId: number | null, selectedInbox: string) => {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const pageRef = useRef(1);

  const inboxId = /^\d+$/.test(selectedInbox) ? Number(selectedInbox) : undefined;
  const load = useCallback(async (page: number, append: boolean) => {
    if (!accountId) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    append ? setIsLoadingMore(true) : setStatus('loading');
    setError(null);
    try {
      const result = await conversationService.list({ accountId, inboxId, page, signal: controller.signal });
      if (controller.signal.aborted) return;
      setConversations((current) => append ? [...current, ...result.conversations.filter((item) => !current.some((existing) => existing.id === item.id))] : result.conversations);
      pageRef.current = page;
      setHasNextPage(result.hasNextPage);
      setStatus('ready');
    } catch (cause) {
      if (controller.signal.aborted) return;
      setError(errorMessageForUser(cause));
      setStatus('error');
    } finally {
      if (!controller.signal.aborted) setIsLoadingMore(false);
    }
  }, [accountId, inboxId]);

  useEffect(() => {
    if (!accountId) { setConversations([]); setStatus('idle'); return; }
    void load(1, false);
    return () => abortRef.current?.abort();
  }, [accountId, inboxId, load]);

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
    setConversations(current => current.map((conversation) => conversation.id === conversationId ? { ...conversation, ...update } : conversation));
  }, []);

  const removeConversation = useCallback((conversationId: number) => {
    setConversations(current => current.filter(conversation => conversation.id !== conversationId));
  }, []);

  const replaceConversation = useCallback((updated: ConversationSummary) => {
    setConversations(current => current.map((conversation) => conversation.id === updated.id ? updated : conversation));
  }, []);

  const upsertRealtimeConversation = useCallback((updated: ConversationSummary) => {
    setConversations(current => mergeRealtimeConversation(current, updated, selectedInbox));
  }, [selectedInbox]);

  const addCreatedConversation = useCallback((created: ConversationSummary) => {
    setConversations(current => [created, ...current.filter((conversation) => conversation.id !== created.id)]);
  }, []);

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

  return { conversations, status, error, hasNextPage, isLoadingMore, retry: () => load(1, false), loadMore, applyOutgoingMessage, applyConversationUpdate, removeConversation, replaceConversation, upsertRealtimeConversation, addCreatedConversation, applyRealtimeMessage };
};
