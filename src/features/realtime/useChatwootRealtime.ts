import { useEffect, useRef, useState } from 'react';
import type { ContactProfile, ConversationMessage, ConversationSummary, CurrentAccount, CurrentUser } from '../../domain/currentUser';
import { normalizeContact, normalizeMessage, normalizeRealtimeConversation } from '../../integrations/chatwoot/normalizers';
import { ChatwootRealtimeClient, type RealtimeConnectionStatus, type RealtimeEvent } from '../../integrations/chatwoot/realtime';
import type { ChatwootContactDto, ChatwootConversationDto, ChatwootMessageDto } from '../../integrations/chatwoot/types';

interface RealtimeHandlers {
  onConversation: (conversation: ConversationSummary) => void;
  onMessage: (message: ConversationMessage, unreadCount?: number, lastActivityAt?: number) => void;
  onUnreadInvalidated: () => void;
  onReconnect: () => void;
  onContact: (contact: ContactProfile) => void;
  onAccessChanged: () => void;
}

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const numberValue = (value: unknown): number | undefined => typeof value === 'number' ? value : undefined;

export const useChatwootRealtime = (
  user: CurrentUser | null,
  account: CurrentAccount | null,
  activeConversationId: number | null,
  handlers: RealtimeHandlers,
) => {
  const clientRef = useRef<ChatwootRealtimeClient | null>(null);
  const handlersRef = useRef(handlers);
  const typingTimersRef = useRef(new Map<number, number>());
  const [connectionStatus, setConnectionStatus] = useState<RealtimeConnectionStatus>('disconnected');
  const [typing, setTyping] = useState<{ conversationId: number; name: string; isPrivate: boolean } | null>(null);
  handlersRef.current = handlers;

  useEffect(() => {
    const client = new ChatwootRealtimeClient();
    clientRef.current = client;
    client.onStatusChange = setConnectionStatus;
    client.onReconnect = () => handlersRef.current.onReconnect();
    client.onEvent = ({ event, data }: RealtimeEvent) => {
      // This websocket is already subscribed to one account. Conversation and
      // cache-invalidation payloads do not carry account_id, so filtering by it
      // here silently discarded assignment and permission updates.
      if (numberValue(data.account_id) !== undefined && numberValue(data.account_id) !== account?.id) return;
      if (event === 'account.cache_invalidated') {
        handlersRef.current.onAccessChanged();
        return;
      }
      if (event === 'message.created' || event === 'message.updated') {
        if (numberValue(data.conversation_id) === undefined) return;
        const message = normalizeMessage(data as unknown as ChatwootMessageDto);
        const conversation = isRecord(data.conversation) ? data.conversation : {};
        handlersRef.current.onMessage(message, numberValue(conversation.unread_count), numberValue(conversation.last_activity_at));
        return;
      }
      if (event === 'conversation.created' || event === 'conversation.updated' || event === 'conversation.status_changed' || event === 'conversation.read' || event === 'assignee.changed') {
        if (numberValue(data.id) === undefined || numberValue(data.inbox_id) === undefined || !isRecord(data.meta)) return;
        handlersRef.current.onConversation(normalizeRealtimeConversation(data as unknown as ChatwootConversationDto & { channel?: string | null }));
        return;
      }
      if (event === 'conversation.unread_count_changed') {
        handlersRef.current.onUnreadInvalidated();
        return;
      }
      if (event === 'contact.updated' && numberValue(data.id) !== undefined) {
        handlersRef.current.onContact(normalizeContact(data as unknown as ChatwootContactDto));
        return;
      }
      if ((event === 'conversation.typing_on' || event === 'conversation.typing_off') && isRecord(data.conversation)) {
        const conversationId = numberValue(data.conversation.id);
        if (!conversationId) return;
        const timer = typingTimersRef.current.get(conversationId);
        if (timer) window.clearTimeout(timer);
        if (event === 'conversation.typing_off') {
          typingTimersRef.current.delete(conversationId);
          setTyping(current => current?.conversationId === conversationId ? null : current);
          return;
        }
        const userData = isRecord(data.user) ? data.user : {};
        setTyping({ conversationId, name: typeof userData.name === 'string' ? userData.name : 'Alguém', isPrivate: data.is_private === true });
        typingTimersRef.current.set(conversationId, window.setTimeout(() => {
          typingTimersRef.current.delete(conversationId);
          setTyping(current => current?.conversationId === conversationId ? null : current);
        }, 30_000));
      }
    };
    if (user && account) client.connect({ accountId: account.id, userId: user.id, pubsubToken: user.pubsubToken });
    return () => {
      client.disconnect();
      if (clientRef.current === client) clientRef.current = null;
      typingTimersRef.current.forEach(timer => window.clearTimeout(timer));
      typingTimersRef.current.clear();
    };
  }, [account?.id, user?.id, user?.pubsubToken]);

  return { connectionStatus, typing: typing?.conversationId === activeConversationId ? typing : null };
};
