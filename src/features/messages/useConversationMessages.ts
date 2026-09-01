import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ConversationMessage } from '../../domain/currentUser';
import { errorMessageForUser } from '../../integrations/chatwoot/errors';
import { messageService } from '../../integrations/chatwoot/messages';
import { parseExternalMessageId } from '../../integrations/whatsapp/provider';
import { fallbackRemoteJid, whatsappReactionService, type WhatsAppReactionTransport } from '../../integrations/whatsapp/reactions';
import { whatsappMessageMutationService } from '../../integrations/whatsapp/messageMutations';
import { mergeMessage, messageHistoryCache } from './MessageHistoryCache';

export const mergeRealtimeMessage = mergeMessage;

// Realtime is delivered at application scope, while this hook only owns the
// selected chat. Updating an existing entry here keeps inactive cached chats
// current without turning every received message into a cache entry.
export const cacheRealtimeMessage = (accountId: number | null, message: ConversationMessage) => {
  if (accountId) messageHistoryCache.upsertIfPresent(accountId, message);
};

type StoredReaction = { sender_id: string; emoji: string; transport: WhatsAppReactionTransport; origin: 'contact' | 'mobile' | 'platform' };

const storedReactions = (value: unknown): StoredReaction[] => Array.isArray(value)
  ? value.flatMap((item): StoredReaction[] => {
    if (!item || typeof item !== 'object') return [];
    const reaction = item as Record<string, unknown>;
    if (typeof reaction.sender_id !== 'string' || typeof reaction.emoji !== 'string' || (reaction.transport !== 'evolution' && reaction.transport !== 'waha' && reaction.transport !== 'meta_cloud')) return [];
    return [{ sender_id: reaction.sender_id, emoji: reaction.emoji, transport: reaction.transport, origin: reaction.origin === 'contact' || reaction.origin === 'mobile' || reaction.origin === 'platform' ? reaction.origin : 'contact' }];
  })
  : [];

const reactionListEquals = (left: unknown, right: StoredReaction[]) => JSON.stringify(storedReactions(left)) === JSON.stringify(right);

export const optimisticReactionList = (current: unknown, transport: WhatsAppReactionTransport, emoji: string): StoredReaction[] => {
  const reactions = storedReactions(current);
  const own = reactions.find((reaction) => reaction.sender_id === 'self' && reaction.transport === transport);
  const withoutOwn = reactions.filter((reaction) => reaction.sender_id !== 'self' || reaction.transport !== transport);
  // Choosing the same emoji toggles it off; choosing a different one replaces
  // our old reaction while retaining reactions made by the contact.
  return own?.emoji === emoji || !emoji ? withoutOwn : [...withoutOwn, { sender_id: 'self', emoji, transport, origin: 'platform' }];
};

// Files cannot be reconstructed from the normalized Chatwoot response. Keep
// them only while a local send is retryable, keyed by its stable echo id.
export class PendingMessageFiles {
  private readonly files = new Map<string, File[]>();

  save(echoId: string, files: File[]) { if (files.length) this.files.set(echoId, files); }
  get(echoId: string) { return this.files.get(echoId) || []; }
  delete(echoId: string) { this.files.delete(echoId); }
  clear() { this.files.clear(); }
}

export const useConversationMessages = (accountId: number | null, conversationId: number | null, inboxId: number | null, fallbackPhoneNumber?: string | null) => {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const inFlightEchoIds = useRef(new Set<string>());
  const pendingMessageFiles = useRef(new PendingMessageFiles());
  const reactionInFlight = useRef(new Set<string>());

  const load = useCallback(async (before?: number, prepend = false, silent = false) => {
    if (!accountId || !conversationId) return;
    const controller = new AbortController();
    abortRef.current = controller;
    const requestId = ++requestIdRef.current;
    if (prepend) setIsLoadingOlder(true);
    else if (!silent) { setStatus('loading'); setError(null); }
    try {
      const page = await messageHistoryCache.request(accountId, conversationId, (signal) => messageService.list({ accountId, conversationId, before, signal }), controller.signal, before ? `before:${before}` : 'latest');
      if (controller.signal.aborted || requestId !== requestIdRef.current) return;
      const cached = messageHistoryCache.set(accountId, conversationId, page, { prepend, preserveExisting: silent });
      setMessages(cached.messages);
      setHasOlderMessages(cached.hasOlderMessages);
      setStatus('ready');
    } catch (cause) {
      if (controller.signal.aborted || requestId !== requestIdRef.current) return;
      setError(errorMessageForUser(cause));
      setStatus('error');
    } finally {
      if (!controller.signal.aborted && requestId === requestIdRef.current) setIsLoadingOlder(false);
    }
  }, [accountId, conversationId]);

  useLayoutEffect(() => {
    pendingMessageFiles.current.clear();
    setHasOlderMessages(false);
    if (!accountId || !conversationId) { setStatus('idle'); return; }
    const cached = messageHistoryCache.get(accountId, conversationId);
    if (cached) {
      setMessages(cached.messages);
      setHasOlderMessages(cached.hasOlderMessages);
      setStatus('ready');
      // A cache hit is always rendered first. Expired entries are revalidated
      // immediately; fresh entries still get a low-cost SWR merge.
      void load(undefined, false, true);
    } else {
      setMessages([]);
      void load();
    }
    return () => abortRef.current?.abort();
  }, [accountId, conversationId, load]);

  const loadOlder = useCallback(() => {
    const first = messages[0];
    if (status === 'ready' && first && hasOlderMessages && !isLoadingOlder) void load(first.id, true);
  }, [hasOlderMessages, isLoadingOlder, load, messages, status]);

  const createEchoId = () => globalThis.crypto?.randomUUID?.() || `cw-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const send = useCallback(async (content: string, isPrivate: boolean, files: File[] = [], inReplyTo?: number) => {
    if (!accountId || !conversationId || (!content.trim() && files.length === 0)) return null;
    const echoId = createEchoId();
    const optimistic: ConversationMessage = {
      id: -Date.now(),
      conversationId,
      kind: isPrivate ? 'private_note' : 'outgoing',
      contentType: 'text',
      content: content.trim(),
      createdAt: Math.floor(Date.now() / 1000),
      updatedAt: null,
      status: 'sending',
      echoId,
      senderName: null,
      senderEmail: null,
      senderAvatarUrl: null,
      origin: isPrivate ? null : 'platform',
      attachments: [],
      contentAttributes: inReplyTo ? { in_reply_to: inReplyTo } : {},
    };
    inFlightEchoIds.current.add(echoId);
    pendingMessageFiles.current.save(echoId, files);
    setMessages(current => [...current, optimistic]);
    setStatus('ready');
    try {
      const created = await messageService.create({ accountId, conversationId, content: optimistic.content, private: isPrivate, echoId, files, inReplyTo });
      setMessages(current => current.map(message => message.echoId === echoId || message.id === optimistic.id ? created : message));
      pendingMessageFiles.current.delete(echoId);
      return created;
    } catch (cause) {
      const error = errorMessageForUser(cause);
      setMessages(current => current.map(message => message.echoId === echoId ? { ...message, status: 'failed', error } : message));
      return null;
    } finally {
      inFlightEchoIds.current.delete(echoId);
    }
  }, [accountId, conversationId]);

  const retrySend = useCallback(async (messageId: number) => {
    const pending = messages.find(message => message.id === messageId);
    if (!accountId || !conversationId || !pending || pending.status !== 'failed' || !pending.echoId || inFlightEchoIds.current.has(pending.echoId)) return null;
    inFlightEchoIds.current.add(pending.echoId);
    setMessages(current => current.map(message => message.id === messageId ? { ...message, status: 'sending', error: null } : message));
    try {
      const files = pendingMessageFiles.current.get(pending.echoId);
      const created = await messageService.create({ accountId, conversationId, content: pending.content, private: pending.kind === 'private_note', echoId: pending.echoId, files });
      setMessages(current => current.map(message => message.id === messageId || message.echoId === pending.echoId ? created : message));
      pendingMessageFiles.current.delete(pending.echoId);
      return created;
    } catch (cause) {
      const error = errorMessageForUser(cause);
      setMessages(current => current.map(message => message.id === messageId ? { ...message, status: 'failed', error } : message));
      return null;
    } finally {
      inFlightEchoIds.current.delete(pending.echoId);
    }
  }, [accountId, conversationId, messages]);

  const remove = useCallback(async (messageId: number) => {
    if (!accountId || !conversationId || messageId < 1) return false;
    try {
      await messageService.remove(accountId, conversationId, messageId);
      setMessages(current => current.filter(message => message.id !== messageId));
      return true;
    } catch {
      return false;
    }
  }, [accountId, conversationId]);

  const react = useCallback(async (messageId: number, selectedEmoji: string) => {
    if (!inboxId || !conversationId || messageId < 1) return false;
    const target = messages.find((message) => message.id === messageId);
    if (!target || !target.sourceId) return false;
    const sourceTransport = target.contentAttributes.whatsapp_transport;
    const externalTransport = parseExternalMessageId(target.sourceId)?.provider;
    const transport = sourceTransport === 'evolution' || sourceTransport === 'waha' || sourceTransport === 'meta_cloud' ? sourceTransport : externalTransport;
    const remoteJid = typeof target.contentAttributes.whatsapp_remote_jid === 'string'
      ? target.contentAttributes.whatsapp_remote_jid
      : fallbackRemoteJid(fallbackPhoneNumber);
    if (!transport || !remoteJid) return false;
    const operationId = `${messageId}:self:${transport}`;
    if (reactionInFlight.current.has(operationId)) return false;
    const beforeAttributes = target.contentAttributes;
    const nextReactions = optimisticReactionList(beforeAttributes.whatsapp_reactions, transport, selectedEmoji);
    const expectedAttributes = { ...beforeAttributes, whatsapp_reactions: nextReactions };
    reactionInFlight.current.add(operationId);
    setMessages(current => current.map((message) => message.id === messageId ? { ...message, contentAttributes: expectedAttributes } : message));
    try {
      await whatsappReactionService.send({
        accountId,
        inboxId,
        conversationId,
        sourceId: target.sourceId,
        remoteJid,
        targetFromMe: typeof target.contentAttributes.whatsapp_from_me === 'boolean' ? target.contentAttributes.whatsapp_from_me : target.kind === 'outgoing',
        participantJid: typeof target.contentAttributes.whatsapp_participant_jid === 'string' ? target.contentAttributes.whatsapp_participant_jid : null,
        transport,
        emoji: nextReactions.find((reaction) => reaction.sender_id === 'self' && reaction.transport === transport)?.emoji || '',
      });
      return true;
    } catch {
      // Do not clobber a newer ActionCable update that may have reached the
      // browser while this request was failing.
      setMessages(current => current.map((message) => message.id === messageId && reactionListEquals(message.contentAttributes.whatsapp_reactions, nextReactions)
        ? { ...message, contentAttributes: beforeAttributes }
        : message));
      return false;
    } finally {
      reactionInFlight.current.delete(operationId);
    }
  }, [accountId, conversationId, fallbackPhoneNumber, inboxId, messages]);

  const mutate = useCallback(async (operation: 'edit' | 'revoke', messageId: number, content?: string) => {
    if (!inboxId || messageId < 1) return false;
    const target = messages.find(message => message.id === messageId);
    const external = parseExternalMessageId(target?.sourceId);
    const transport = external?.provider;
    if (!target?.sourceId || !external || (transport !== 'evolution' && transport !== 'waha') || target.kind !== 'outgoing' || target.contentAttributes.whatsapp_from_me === false) return false;
    const remoteJid = typeof target.contentAttributes.whatsapp_remote_jid === 'string' ? target.contentAttributes.whatsapp_remote_jid : fallbackRemoteJid(fallbackPhoneNumber);
    if (!remoteJid) return false;
    try {
      const updated = await whatsappMessageMutationService.send(operation, {
        accountId, inboxId, sourceId: target.sourceId, remoteJid, targetFromMe: typeof target.contentAttributes.whatsapp_from_me === 'boolean' ? target.contentAttributes.whatsapp_from_me : target.kind === 'outgoing', participantJid: typeof target.contentAttributes.whatsapp_participant_jid === 'string' ? target.contentAttributes.whatsapp_participant_jid : null, transport, ...(content ? { content } : {}),
      });
      setMessages(current => current.map(message => message.id === messageId ? { ...message, content: updated.content, contentAttributes: updated.content_attributes } : message));
      return true;
    } catch { return false; }
  }, [accountId, fallbackPhoneNumber, inboxId, messages]);

  const upsertRealtimeMessage = useCallback((message: ConversationMessage) => {
    if (message.conversationId !== conversationId) return;
    cacheRealtimeMessage(accountId, message);
    setMessages(current => mergeRealtimeMessage(current, message));
    setStatus('ready');
  }, [accountId, conversationId]);

  // Backstop for transient ActionCable/proxy drops: merge the latest page in
  // the background rather than resetting the current view or its scroll.
  const refreshLatest = useCallback(async () => {
    if (!accountId || !conversationId) return;
    try {
      const page = await messageHistoryCache.request(accountId, conversationId, (signal) => messageService.list({ accountId, conversationId, signal }));
      const cached = messageHistoryCache.set(accountId, conversationId, page, { preserveExisting: true });
      setMessages(cached.messages);
      setHasOlderMessages(cached.hasOlderMessages);
      setStatus('ready');
    } catch {
      // Realtime refresh is opportunistic; the normal retry UI owns errors.
    }
  }, [accountId, conversationId]);

  const saveScroll = useCallback((scrollTop: number) => {
    if (accountId && conversationId) messageHistoryCache.setScroll(accountId, conversationId, scrollTop);
  }, [accountId, conversationId]);
  const cachedScrollTop = accountId && conversationId ? messageHistoryCache.get(accountId, conversationId)?.scrollTop || 0 : 0;

  return { messages, status, error, hasOlderMessages, isLoadingOlder, cachedScrollTop, saveScroll, retry: () => load(), loadOlder, send, retrySend, remove, react, edit: (messageId: number, content: string) => mutate('edit', messageId, content), revoke: (messageId: number) => mutate('revoke', messageId), upsertRealtimeMessage, refreshLatest };
};
