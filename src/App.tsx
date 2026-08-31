import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { GripVertical, MessageSquare } from 'lucide-react';
import {
  NavTab,
  FilterCategory,
  Chat,
  Message,
  UserProfile,
  Attachment,
  MultiTenantAccount,
  ChatStatusFilter,
  ChatSortOption,
  ChatFilterRule,
} from './types';
import { NavRail } from './components/NavRail';
import { ChatListHeader } from './components/ChatListHeader';
import { ChatListItem } from './components/ChatListItem';
import { ChatArea } from './components/ChatArea';
import { ImagePreviewModal } from './components/ImagePreviewModal';
import { StatusView } from './components/StatusView';
import { CallsView } from './components/CallsView';
import { CommunitiesView } from './components/CommunitiesView';
import { ContactsView } from './components/ContactsView';
import { SettingsView, SettingsTab } from './components/SettingsView';
import { AppsView } from './components/AppsView';
import { NewConversationModal } from './components/NewConversationModal';
import { NewGroupModal } from './components/NewGroupModal';
import { WallpaperId } from './components/WhatsAppDoodleBg';
import { FloatingMobileNav } from './components/FloatingMobileNav';
import { QuickNotesView } from './components/QuickNotesView';
import { MobileProfileSettings } from './components/MobileProfileSettings';
import { ContextMenu } from './components/ContextMenu';
import { ConfirmDialog } from './components/ConfirmDialog';
import { useContextMenu } from './hooks/useContextMenu';
import { getChatContextMenuItems } from './utils/contextMenuActions';
import { ToastContainer, ToastMessage } from './components/Toast';
import { useAuth } from './features/auth/AuthContext';
import { useInboxes } from './features/inboxes/useInboxes';
import { errorMessageForUser } from './integrations/chatwoot/errors';
import { useConversations } from './features/conversations/useConversations';
import { toChatListItem } from './features/conversations/toChatListItem';
import { useConversationMessages } from './features/messages/useConversationMessages';
import { toChatMessages } from './features/messages/toChatMessages';
import { useConversationManagement } from './features/conversations/useConversationManagement';
import { useChatwootRealtime } from './features/realtime/useChatwootRealtime';
import { useContactDetails } from './features/contacts/useContactDetails';
import { useContacts } from './features/contacts/useContacts';
import { toContactListItem } from './features/contacts/toContactListItem';
import { conversationService, type ConversationServerFilters } from './integrations/chatwoot/conversations';
import { messageService } from './integrations/chatwoot/messages';
import { canSendWhatsAppMessage, whatsappConnectionService, type OperationalWhatsAppConnection } from './integrations/whatsapp/connection';
import { authService } from './integrations/chatwoot/auth';
import { browserNotifications } from './features/notifications/browserNotifications';
import type { ConversationMessage } from './domain/currentUser';
import { appRouteFromUrl, urlForAppRoute, type AppRoute } from './routing/appRoute';

const emptyUser: UserProfile = { name: '', phone: '', about: '', avatar: '' };
const emptyAccount: MultiTenantAccount = { id: '', name: '', role: '' };
// This is also the route allow-list. Retired modules cannot be reopened by
// manually entering an old settings URL.
const settingsTabs: SettingsTab[] = ['perfil', 'conta', 'agentes', 'times', 'caixas', 'etiquetas', 'atributos', 'automacao', 'macros', 'respostas', 'agendadas', 'integracoes', 'auditoria', 'permissoes'];
const isSettingsTab = (value: string | undefined): value is SettingsTab => Boolean(value && settingsTabs.includes(value as SettingsTab));

export default function App() {
  const { user: authenticatedUser, currentAccount, selectAccount, logout, retryBootstrap } = useAuth();
  const initialRoute = appRouteFromUrl(new URL(window.location.href));
  const superAdminUrl = import.meta.env.VITE_SUPER_ADMIN_URL || '/super_admin';
  const { inboxes, status: inboxesStatus, error: inboxesError, retry: retryInboxes, upsertRealtimeInbox } = useInboxes(currentAccount?.id ?? null);
  const [whatsappConnection, setWhatsappConnection] = useState<OperationalWhatsAppConnection | null>(null);
  const contactDirectory = useContacts(currentAccount?.id ?? null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>(() => initialRoute.conversationId || '');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [conversationPendingDeletion, setConversationPendingDeletion] = useState<Chat | null>(null);
  const [isDeletingConversation, setIsDeletingConversation] = useState(false);
  const { menuState, openContextMenu, closeContextMenu } = useContextMenu();

  // New Filter & Sort State for Chat List
  const [selectedStatus, setSelectedStatus] = useState<ChatStatusFilter>('todas');
  const [selectedSort, setSelectedSort] = useState<ChatSortOption>('last_activity_desc');
  const [filterRules, setFilterRules] = useState<ChatFilterRule[]>([]);

  const addToast = (title: string, type: 'success' | 'info' | 'error' = 'success') => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, title, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Mobile browsers keep `100vh` tied to the layout viewport while their
  // address bar is expanded. Use the visual viewport instead so the message
  // composer remains visible in Chrome/Safari. In an installed PWA both
  // measurements are equivalent, so its standalone layout is unchanged.
  useEffect(() => {
    const viewport = window.visualViewport;
    const syncViewportHeight = () => {
      document.documentElement.style.setProperty('--app-viewport-height', `${Math.round(viewport?.height || window.innerHeight)}px`);
    };
    syncViewportHeight();
    viewport?.addEventListener('resize', syncViewportHeight);
    window.addEventListener('resize', syncViewportHeight);
    window.addEventListener('orientationchange', syncViewportHeight);
    return () => {
      viewport?.removeEventListener('resize', syncViewportHeight);
      window.removeEventListener('resize', syncViewportHeight);
      window.removeEventListener('orientationchange', syncViewportHeight);
    };
  }, []);

  const handleChatContextMenu = (e: React.MouseEvent, chatItem: Chat) => {
    const items = getChatContextMenuItems(chatItem, {
      onSelectChat: (selected) => {
        openConversation(selected.id);
      },
      onToggleUnread: (selected) => {
        const isUnread = (selected.unreadCount ?? 0) > 0;
        setChats((prev) =>
          prev.map((c) =>
            c.id === selected.id
              ? { ...c, unreadCount: isUnread ? 0 : 1 }
              : c
          )
        );
        addToast(isUnread ? 'Conversa marcada como lida' : 'Conversa marcada como não lida');
      },
      onTogglePin: (selected) => {
        const isPinned = !(selected.pinned || selected.isPinned);
        setChats((prev) =>
          prev.map((c) =>
            c.id === selected.id ? { ...c, pinned: isPinned, isPinned: isPinned } : c
          )
        );
        addToast(isPinned ? 'Conversa fixada no topo!' : 'Conversa desafixada!');
      },
      onToggleFavorite: (selected) => {
        const isFav = !(selected.favorite || selected.isFavorite);
        setChats((prev) =>
          prev.map((c) =>
            c.id === selected.id ? { ...c, favorite: isFav, isFavorite: isFav } : c
          )
        );
        addToast(isFav ? 'Adicionada aos favoritos!' : 'Removida dos favoritos!');
      },
      onToggleMute: (selected) => {
        const isMuted = !selected.muted;
        setChats((prev) =>
          prev.map((c) =>
            c.id === selected.id ? { ...c, muted: isMuted } : c
          )
        );
        addToast(isMuted ? 'Notificações silenciadas' : 'Notificações ativadas');
      },
      onToggleArchive: (selected) => {
        const isArchived = !selected.isArchived;
        setChats((prev) =>
          prev.map((c) =>
            c.id === selected.id ? { ...c, isArchived } : c
          )
        );
        addToast(isArchived ? `Conversa arquivada` : `Conversa desarquivada`);
      },
      onOpenContactPanel: (selected) => {
        openConversation(selected.id);
        addToast(`Exibindo atributos de: ${selected.name}`, 'info');
      },
      onDeleteChat: (selected) => {
        setConversationPendingDeletion(selected);
      },
      onDuplicateChat: (selected) => {
        const dup: Chat = {
          ...selected,
          id: `dup-${Date.now()}`,
          name: `${selected.name} (Cópia)`,
        };
        setChats((prev) => [dup, ...prev]);
        addToast(`Atendimento "${selected.name}" duplicado com sucesso!`);
      },
      onExportChat: (selected) => {
        const dataStr =
          'data:text/json;charset=utf-8,' +
          encodeURIComponent(JSON.stringify(selected.messages, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute('href', dataStr);
        downloadAnchor.setAttribute(
          'download',
          `historico_${selected.name.replace(/\s+/g, '_')}.json`
        );
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
        addToast('Histórico exportado com sucesso!');
      },
      onPrintChat: (selected) => {
        addToast(`Gerando impressão da conversa com ${selected.name}...`, 'info');
        setTimeout(() => window.print(), 300);
      },
    });

    openContextMenu(e, items, `Ações: ${chatItem.name}`);
  };
  const [activeNavTab, setActiveNavTab] = useState<NavTab>(() => initialRoute.tab);
  const [showMobileChat, setShowMobileChat] = useState<boolean>(() => Boolean(initialRoute.conversationId));
  const [selectedInbox, setSelectedInbox] = useState<string>(() => initialRoute.inbox || 'todas');
  const [routeAccountId, setRouteAccountId] = useState<string>(() => initialRoute.accountId || '');
  const [conversationServerFilters, setConversationServerFilters] = useState<ConversationServerFilters>({ teamId: null, labels: [] });
  const { conversations, status: conversationsStatus, error: conversationsError, hasNextPage, isLoadingMore, isRefreshing: conversationsRefreshing, retry: retryConversations, loadMore, applyOutgoingMessage, applyConversationUpdate, removeConversation, replaceConversation, upsertRealtimeConversation, addCreatedConversation, applyRealtimeMessage, refreshRecentConversations } = useConversations(currentAccount?.id ?? null, selectedInbox, conversationServerFilters);
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('minhas');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [user, setUser] = useState<UserProfile>(emptyUser);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [selectedAccount, setSelectedAccount] = useState<MultiTenantAccount>(emptyAccount);

  async function deleteConversation(chat: Chat) {
    const conversationId = Number(chat.id);
    if (!currentAccount || !Number.isInteger(conversationId)) {
      // It keeps prototype-only chats removable without pretending the API did it.
      setChats(current => current.filter(item => item.id !== chat.id));
      setConversationPendingDeletion(null);
      return;
    }
    setIsDeletingConversation(true);
    try {
      await conversationService.remove(currentAccount.id, conversationId);
      removeConversation(conversationId);
      if (activeChatId === chat.id) {
        navigate({ tab: 'chats', ...(selectedInbox !== 'todas' ? { inbox: selectedInbox } : {}) }, true);
      }
      addToast(`Conversa com "${chat.name}" excluída`);
      setConversationPendingDeletion(null);
    } catch (cause) {
      addToast(`Não foi possível excluir a conversa: ${errorMessageForUser(cause)}`, 'error');
    } finally {
      setIsDeletingConversation(false);
    }
  }

  useEffect(() => {
    if (!authenticatedUser) return;
    setUser({
      name: authenticatedUser.displayName,
      phone: authenticatedUser.email,
      about: authenticatedUser.role || 'Agente Chatwoot',
      avatar: authenticatedUser.avatarUrl || '',
    });
    const active = currentAccount || authenticatedUser.accounts[0];
    if (active) setSelectedAccount({ id: String(active.id), name: active.name, role: active.role });
  }, [authenticatedUser, currentAccount]);

  const handleAccountSelection = async (account: MultiTenantAccount) => {
    try {
      await selectAccount(Number(account.id));
      navigate({ tab: 'chats', accountId: account.id });
    } catch (cause) {
      addToast(errorMessageForUser(cause), 'error');
    }
  };

  // Resizable Chat List Column width (280px to 750px)
  const [chatListWidth, setChatListWidth] = useState<number>(() => {
    const saved = localStorage.getItem('wa_chat_list_width');
    return saved ? Math.max(280, Math.min(750, parseInt(saved, 10))) : 450;
  });
  const [isResizingChatList, setIsResizingChatList] = useState(false);
  const isResizingChatListRef = useRef(false);

  useEffect(() => {
    localStorage.setItem('wa_chat_list_width', String(chatListWidth));
  }, [chatListWidth]);

  const handleMouseDownChatList = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingChatListRef.current = true;
    setIsResizingChatList(true);

    const startX = e.clientX;
    const startWidth = chatListWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingChatListRef.current) return;
      const deltaX = moveEvent.clientX - startX;
      const newWidth = startWidth + deltaX;
      if (newWidth >= 280 && newWidth <= 750) {
        setChatListWidth(newWidth);
      }
    };

    const onMouseUp = () => {
      isResizingChatListRef.current = false;
      setIsResizingChatList(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  // Theme & Wallpaper State
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('wa_dark_mode');
    return saved !== null ? saved === 'true' : true;
  });

  const [wallpaperId, setWallpaperId] = useState<WallpaperId>(() => {
    const saved = localStorage.getItem('wa_wallpaper_id');
    return (saved as WallpaperId) || (isDarkMode ? 'dark-doodle' : 'light-beige-doodle');
  });

  useEffect(() => {
    localStorage.setItem('wa_dark_mode', String(isDarkMode));
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem('wa_wallpaper_id', wallpaperId);
  }, [wallpaperId]);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      setWallpaperId(next ? 'dark-doodle' : 'light-beige-doodle');
      return next;
    });
  };

  // Modal States
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    title?: string;
    subtitle?: string;
  } | null>(null);
  const [selectedSettingsTab, setSelectedSettingsTab] = useState<SettingsTab>(() => isSettingsTab(initialRoute.settingsTab) ? initialRoute.settingsTab : 'conta');
  const [selectedSettingsInboxId, setSelectedSettingsInboxId] = useState<string | null>(() => initialRoute.settingsInboxId || null);
  const [showContactsModal, setShowContactsModal] = useState<boolean>(false);
  const [showNewConversationModal, setShowNewConversationModal] = useState<boolean>(false);
  const [showNewGroupModal, setShowNewGroupModal] = useState<boolean>(false);

  const applyRoute = useCallback((route: AppRoute) => {
    setRouteAccountId(route.accountId || '');
    setActiveNavTab(route.tab);
    setActiveChatId(route.conversationId || '');
    setSelectedInbox(route.inbox || 'todas');
    if (isSettingsTab(route.settingsTab)) setSelectedSettingsTab(route.settingsTab);
    setSelectedSettingsInboxId(route.settingsInboxId || null);
    setShowContactsModal(false);
    setShowMobileChat(Boolean(route.conversationId));
  }, []);

  const navigate = useCallback((route: AppRoute, replace = false) => {
    const normalizedRoute = { ...route, accountId: route.accountId || String(currentAccount?.id || routeAccountId || '') };
    const target = urlForAppRoute(normalizedRoute);
    const current = `${window.location.pathname}${window.location.search}`;
    if (current !== target) window.history[replace ? 'replaceState' : 'pushState']({}, '', target);
    applyRoute(normalizedRoute);
  }, [applyRoute, currentAccount?.id, routeAccountId]);

  const openConversation = useCallback((conversationId: string) => {
    navigate({ tab: 'chats', conversationId, ...(selectedInbox !== 'todas' ? { inbox: selectedInbox } : {}) });
  }, [navigate, selectedInbox]);

  const navigateToTab = useCallback((tab: NavTab) => {
    if (tab === 'chats') navigate({ tab: 'chats', ...(selectedInbox !== 'todas' ? { inbox: selectedInbox } : {}) });
    else navigate({ tab });
  }, [navigate, selectedInbox]);

  const navigateToSettings = useCallback((tab: SettingsTab) => navigate({ tab: 'settings', settingsTab: tab }), [navigate]);
  const navigateToSettingsInbox = useCallback((inboxId: number) => navigate({ tab: 'settings', settingsTab: 'caixas', settingsInboxId: String(inboxId) }), [navigate]);

  const selectInboxRoute = useCallback((inbox: string) => {
    navigate({ tab: 'chats', ...(inbox !== 'todas' ? { inbox } : {}) });
  }, [navigate]);

  useEffect(() => {
    const onPopState = () => applyRoute(appRouteFromUrl(new URL(window.location.href)));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [applyRoute]);

  useEffect(() => {
    if (!authenticatedUser || !currentAccount) return;
    const requestedAccountId = Number(routeAccountId);
    if (Number.isInteger(requestedAccountId) && requestedAccountId > 0 && requestedAccountId !== currentAccount.id) {
      if (authenticatedUser.accounts.some((account) => account.id === requestedAccountId)) {
        void selectAccount(requestedAccountId).catch((cause) => addToast(errorMessageForUser(cause), 'error'));
        return;
      }
      addToast('Você não possui acesso à conta indicada nesta URL.', 'error');
    }
    // Canonicalize legacy/local links only after authentication determines the
    // account. Every operational route is then isolated by account ID.
    if (routeAccountId !== String(currentAccount.id)) {
      navigate({ tab: activeNavTab, ...(activeChatId ? { conversationId: activeChatId } : {}), ...(selectedInbox !== 'todas' ? { inbox: selectedInbox } : {}), ...(activeNavTab === 'settings' ? { settingsTab: selectedSettingsTab, ...(selectedSettingsInboxId ? { settingsInboxId: selectedSettingsInboxId } : {}) } : {}), accountId: String(currentAccount.id) }, true);
    }
  }, [activeChatId, activeNavTab, authenticatedUser, currentAccount, navigate, routeAccountId, selectAccount, selectedInbox, selectedSettingsInboxId, selectedSettingsTab]);

  // Selected Chat Object
  const listChats = useMemo(() => conversations.map((conversation) => toChatListItem(conversation, inboxes)), [conversations, inboxes]);
  const contactListItems = useMemo(() => contactDirectory.contacts.map(toContactListItem), [contactDirectory.contacts]);
  // O painel principal só pode abrir uma conversa obtida do Chatwoot. Os chats
  // de protótipo continuam restritos às telas ainda não integradas (contatos,
  // status e chamadas), sem contaminar o atendimento real.
  const activeChat = listChats.find((c) => c.id === activeChatId);
  const selectedConversationId = useMemo(() => conversations.some((conversation) => String(conversation.id) === activeChatId) ? Number(activeChatId) : null, [activeChatId, conversations]);
  const selectedConversation = useMemo(() => conversations.find((conversation) => conversation.id === selectedConversationId) || null, [conversations, selectedConversationId]);
  useEffect(() => {
    const inboxId = selectedConversation?.inboxId;
    if (!currentAccount || !inboxId) { setWhatsappConnection(null); return; }
    let active = true;
    const refresh = () => whatsappConnectionService.get(currentAccount.id, inboxId, selectedConversation.isGroup ? 'group' : 'private')
      .then((status) => { if (active) setWhatsappConnection(status); })
      .catch(() => { if (active) setWhatsappConnection(null); });
    void refresh();
    // Inbox updates arrive over ActionCable. This is only a slow recovery
    // check for proxies/providers that drop a callback while reconnecting.
    const interval = window.setInterval(() => void refresh(), 120_000);
    return () => { active = false; window.clearInterval(interval); };
  }, [currentAccount?.id, selectedConversation?.id, selectedConversation?.inboxId, selectedConversation?.isGroup]);
  const contactDetails = useContactDetails(currentAccount?.id ?? null, selectedConversation?.contactId ?? null);
  const messageHistory = useConversationMessages(currentAccount?.id ?? null, selectedConversationId, selectedConversation?.inboxId ?? null, contactDetails.contact?.phoneNumber);
  const activeChatWithHistory = useMemo(() => selectedConversationId
    ? activeChat && { ...activeChat, messages: toChatMessages(messageHistory.messages) }
    : activeChat,
  [activeChat, messageHistory.messages, selectedConversationId]);
  const conversationManagement = useConversationManagement(currentAccount?.id ?? null, selectedConversation?.inboxId ?? null);
  const updateSelectedContact = async (update: Parameters<typeof contactDetails.update>[0]) => {
    const updated = await contactDetails.update(update);
    if (updated && selectedConversationId) applyConversationUpdate(selectedConversationId, { contactName: updated.name, contactId: updated.id });
    return updated;
  };
  const unreadRefreshTimer = useRef<number | null>(null);
  const accessRefreshTimer = useRef<number | null>(null);
  useEffect(() => () => {
    if (unreadRefreshTimer.current !== null) window.clearTimeout(unreadRefreshTimer.current);
    if (accessRefreshTimer.current !== null) window.clearTimeout(accessRefreshTimer.current);
  }, []);
  const openedReadConversationRef = useRef<number | null>(null);
  const markSelectedConversationRead = useCallback(() => {
    if (!selectedConversationId || !selectedConversation || selectedConversation.unreadCount <= 0) return;
    applyConversationUpdate(selectedConversationId, { unreadCount: 0 });
    void runConversationAction(conversationManagement.markRead(selectedConversationId), replaceConversation);
  }, [applyConversationUpdate, conversationManagement, replaceConversation, selectedConversation, selectedConversationId]);
  const realtimeHandlers = useMemo(() => ({
    onConversation: upsertRealtimeConversation,
    onMessage: (message: ConversationMessage, unreadCount?: number, lastActivityAt?: number) => {
      applyRealtimeMessage(message, unreadCount, lastActivityAt);
      messageHistory.upsertRealtimeMessage(message);
      if (message.kind === 'incoming' && currentAccount) {
        void browserNotifications.show({ title: message.senderName || 'Nova mensagem', body: message.content || (message.attachments.length ? 'Enviou um anexo' : 'Nova mensagem'), url: `/app/accounts/${currentAccount.id}/conversations/${message.conversationId}` });
      }
    },
    // message.created usually has the count. The invalidation covers bulk
    // changes, so refresh only the first page after a short debounce without
    // resetting filters, pagination or the selected conversation.
    onUnreadInvalidated: () => {
      if (unreadRefreshTimer.current !== null) window.clearTimeout(unreadRefreshTimer.current);
      unreadRefreshTimer.current = window.setTimeout(() => {
        unreadRefreshTimer.current = null;
        void refreshRecentConversations();
      }, 400);
    },
    onReconnect: () => {
      void retryConversations();
      void messageHistory.retry();
    },
    onAccessChanged: () => {
      // Inbox/contact changes can invalidate the account cache in bursts.
      // Refresh access once after the burst without replacing the chat UI.
      if (accessRefreshTimer.current !== null) window.clearTimeout(accessRefreshTimer.current);
      accessRefreshTimer.current = window.setTimeout(() => {
        accessRefreshTimer.current = null;
        void retryBootstrap();
        void retryConversations();
      }, 500);
    },
    onContact: (contact) => {
      contactDirectory.upsertRealtimeContact(contact);
      contactDetails.applyRealtimeUpdate(contact);
      if (selectedConversation?.contactId === contact.id && selectedConversationId) {
        applyConversationUpdate(selectedConversationId, { contactName: contact.name, contactId: contact.id });
      }
    },
    onContactRemoved: (contactId) => {
      contactDirectory.removeRealtimeContact(contactId);
      if (selectedConversation?.contactId === contactId && selectedConversationId) applyConversationUpdate(selectedConversationId, { contactName: 'Contato removido', contactId: null });
    },
    onConversationDeleted: (conversationId) => {
      removeConversation(conversationId);
      if (selectedConversationId === conversationId) navigate({ tab: 'chats', ...(selectedInbox !== 'todas' ? { inbox: selectedInbox } : {}) }, true);
    },
    onInbox: (inbox) => {
      upsertRealtimeInbox(inbox);
      if (selectedConversation?.inboxId !== inbox.id) return;
      setWhatsappConnection((current) => {
        if (!current?.applicable || !current.transport) return current;
        const value = inbox.additionalAttributes[`${current.transport}_connection_status`];
        const status = value === 'connected' || value === 'connecting' || value === 'disconnected' || value === 'error' || value === 'pending' ? value : current.status;
        return { ...current, status, sendAllowed: status === 'connected' };
      });
    },
  }), [applyConversationUpdate, applyRealtimeMessage, contactDetails.applyRealtimeUpdate, contactDirectory, currentAccount, messageHistory.retry, messageHistory.upsertRealtimeMessage, navigate, refreshRecentConversations, removeConversation, retryBootstrap, retryConversations, selectedConversation?.contactId, selectedConversation?.inboxId, selectedConversationId, selectedInbox, upsertRealtimeConversation, upsertRealtimeInbox]);
  const { connectionStatus: realtimeConnectionStatus, typing } = useChatwootRealtime(authenticatedUser, currentAccount, selectedConversationId, realtimeHandlers);

  useEffect(() => {
    // ActionCable is authoritative while connected. Poll only while it is
    // reconnecting/disconnected, avoiding redundant history requests.
    if (!selectedConversationId || realtimeConnectionStatus === 'connected') return;
    const interval = window.setInterval(() => { void messageHistory.refreshLatest(); }, 3_000);
    return () => window.clearInterval(interval);
  }, [messageHistory.refreshLatest, realtimeConnectionStatus, selectedConversationId]);

  useEffect(() => () => {
    if (unreadRefreshTimer.current !== null) window.clearTimeout(unreadRefreshTimer.current);
  }, []);

  // A URL pode apontar para uma conversa fora da primeira página. Busque-a
  // diretamente para que atualizar ou compartilhar o link preserve o contexto.
  useEffect(() => {
    const conversationId = Number(activeChatId);
    // Number('') is 0. Do not request the synthetic /conversations/0 route
    // while the user is on the inbox list without a selected conversation.
    if (!currentAccount || !Number.isInteger(conversationId) || conversationId < 1 || selectedConversation || conversationsStatus !== 'ready') return;
    let cancelled = false;
    void conversationService.get(currentAccount.id, conversationId)
      .then((conversation) => { if (!cancelled) addCreatedConversation(conversation); })
      .catch((cause) => { if (!cancelled) addToast(`Não foi possível abrir esta conversa: ${errorMessageForUser(cause)}`, 'error'); });
    return () => { cancelled = true; };
  }, [activeChatId, addCreatedConversation, conversationsStatus, currentAccount, selectedConversation]);

  useEffect(() => {
    if (!selectedConversationId || !selectedConversation || openedReadConversationRef.current === selectedConversationId) return;
    openedReadConversationRef.current = selectedConversationId;
    markSelectedConversationRead();
  }, [markSelectedConversationRead, selectedConversation, selectedConversationId]);

  const runConversationAction = async <T,>(operation: Promise<T | null>, onSuccess: (result: T) => void) => {
    try {
      const result = await operation;
      if (result) onSuccess(result);
    } catch (cause) {
      addToast(errorMessageForUser(cause), 'error');
    }
  };

  const createDirectoryContact = async (input: { name: string; phoneNumber?: string; email?: string; inboxId?: number }): Promise<Chat | null> => {
    const created = await contactDirectory.create(input);
    return created ? toContactListItem(created) : null;
  };

  const updateDirectoryContact = async (chatId: string, updates: Partial<Chat>): Promise<void> => {
    const contactId = Number(chatId);
    if (!Number.isInteger(contactId)) throw new Error('Contato inválido.');
    const supportedUpdate = {
      ...(updates.name === undefined ? {} : { name: updates.name }),
      ...(updates.phone === undefined ? {} : { phoneNumber: updates.phone || null }),
      ...(updates.email === undefined ? {} : { email: updates.email || null }),
      ...(updates.isBlocked === undefined ? {} : { blocked: updates.isBlocked }),
      ...(updates.description === undefined ? {} : { additionalAttributes: { description: updates.description || null } }),
    };
    if (Object.keys(supportedUpdate).length === 0) {
      throw new Error('Esta alteração de contato ainda não é suportada pela integração.');
    }
    const updated = await contactDirectory.update(contactId, supportedUpdate);
    if (!updated) throw new Error('Não foi possível atualizar o contato agora.');
  };

  const deleteDirectoryContact = async (chatId: string): Promise<void> => {
    const contactId = Number(chatId);
    if (!Number.isInteger(contactId)) throw new Error('Contato inválido.');
    const removed = await contactDirectory.remove(contactId);
    if (!removed) throw new Error('Não foi possível excluir o contato agora.');
  };

  const startContactConversation = async ({ contactId, inboxId, initialContent, private: isPrivate, files = [] }: { contactId: number; inboxId: number; initialContent?: string; private: boolean; files?: File[] }) => {
    if (!currentAccount) throw new Error('Selecione uma conta antes de iniciar o atendimento.');
    const existing = await conversationService.findReusable({ accountId: currentAccount.id, contactId, inboxId });
    const conversation = existing || await conversationService.create({ accountId: currentAccount.id, contactId, inboxId });
    if (!existing) addCreatedConversation(conversation);
    navigate({ tab: 'chats', conversationId: String(conversation.id), inbox: String(inboxId) });

    if (!initialContent && files.length === 0) return;
    const echoId = globalThis.crypto?.randomUUID?.() || `cw-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      const message = await messageService.create({
        accountId: currentAccount.id,
        conversationId: conversation.id,
        content: initialContent,
        private: isPrivate,
        echoId,
        files,
      });
      applyOutgoingMessage(message);
    } catch (cause) {
      addToast(`Conversa criada, mas a mensagem inicial não foi enviada: ${errorMessageForUser(cause)}`, 'error');
    }
  };

  // Filtering & Sorting chats by search query, inbox channel, status, combination rules, and sort options
  const filteredAndSortedChats = useMemo(() => {
    let list = listChats.filter((c) => {
      // Exclude archived chats unless explicitly searching
      if (c.isArchived && !searchQuery.trim()) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = c.name.toLowerCase().includes(q);
        const matchMsg = c.lastMessage.toLowerCase().includes(q);
        const matchPhone = c.phone?.toLowerCase().includes(q);
        const matchId = c.identifier?.toLowerCase().includes(q);
        const matchTag = c.tags?.some((t) => t.label.toLowerCase().includes(q));
        if (!matchName && !matchMsg && !matchPhone && !matchId && !matchTag) {
          return false;
        }
      }

      // Filter by selected inbox channel / view from sidebar
      if (selectedInbox === 'mencoes') {
        const hasMention = c.messages.some((m) => m.text?.includes('@'));
        if (!hasMention && c.id !== 'c-jullyanna') return false;
      } else if (selectedInbox === 'participantes') {
        if (!c.isGroup && !c.name.toLowerCase().includes('equipe') && !c.name.toLowerCase().includes('grupo')) {
          return false;
        }
      } else if (selectedInbox === 'nao_atendidas') {
        if (!c.unassigned && (!c.unreadCount || c.unreadCount === 0) && c.id !== 'c-danielle') {
          return false;
        }
      } else if (selectedInbox !== 'todas' && !/^\d+$/.test(selectedInbox)) {
        // Channel name matching
        if (!c.channelName) return false;
        const normInbox = selectedInbox.toLowerCase().replace(/[^a-z0-9]/g, '');
        const normChannel = c.channelName.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!normChannel || !normInbox) return false;
        const isMatch =
          normChannel === normInbox ||
          normChannel.includes(normInbox) ||
          normInbox.includes(normChannel);
        if (!isMatch) return false;
      }

      // Filter Category Pills
      if (activeFilter === 'minhas') {
        if (!authenticatedUser || !c.responsibleUserIds?.includes(authenticatedUser.id)) return false;
      } else if (activeFilter === 'nao_atribuidas') {
        if (!c.unassigned) return false;
      } else if (activeFilter === 'grupos') {
        if (!c.isGroup) return false;
      }

      // Quick Status Filter
      if (selectedStatus !== 'todas') {
        const statusVal = c.status || 'aberta';
        if (selectedStatus === 'abertas' && statusVal !== 'aberta') return false;
        if (selectedStatus === 'abertas_pendentes' && statusVal !== 'aberta' && statusVal !== 'pendente') return false;
        if (selectedStatus === 'resolvidas' && statusVal !== 'resolvida') return false;
        if (selectedStatus === 'pendentes' && statusVal !== 'pendente') return false;
        if (selectedStatus === 'adiadas' && statusVal !== 'adiada') return false;
      }

      // Combination Filter Rules
      for (const rule of filterRules) {
        let targetVal = '';
        if (rule.field === 'status') targetVal = c.status || 'aberta';
        else if (rule.field === 'priority') targetVal = c.priority || 'media';
        else if (rule.field === 'assignedAgent') targetVal = c.assignedAgent || 'Não Atribuído';
        else if (rule.field === 'inbox') targetVal = c.channelName || '';
        else if (rule.field === 'team') targetVal = c.teamName || '';
        else if (rule.field === 'identifier') targetVal = c.identifier || c.phone || '';
        else if (rule.field === 'campaign') targetVal = c.campaignName || '';

        const ruleVal = rule.value.toLowerCase();
        const chatTarget = targetVal.toLowerCase();

        if (rule.operator === 'equals') {
          if (chatTarget !== ruleVal && !chatTarget.includes(ruleVal)) return false;
        } else if (rule.operator === 'not_equals') {
          if (chatTarget === ruleVal || chatTarget.includes(ruleVal)) return false;
        } else if (rule.operator === 'present') {
          if (!chatTarget || chatTarget.trim().length === 0) return false;
        } else if (rule.operator === 'not_present') {
          if (chatTarget && chatTarget.trim().length > 0) return false;
        }
      }

      return true;
    });

    // Sorting Logic
    return list.sort((a, b) => {
      // Pinned chats always sort to the top
      const aPinned = a.pinned || a.isPinned;
      const bPinned = b.pinned || b.isPinned;
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;

      if (selectedSort === 'last_activity_asc') {
        return (a.time || '').localeCompare(b.time || '');
      } else if (selectedSort === 'created_at_desc') {
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      } else if (selectedSort === 'created_at_asc') {
        return (a.createdAt || '').localeCompare(b.createdAt || '');
      } else if (selectedSort === 'priority_desc') {
        const priorityRank: Record<string, number> = { urgente: 4, alta: 3, media: 2, baixa: 1 };
        const rankA = priorityRank[a.priority || 'media'] || 2;
        const rankB = priorityRank[b.priority || 'media'] || 2;
        return rankB - rankA;
      } else if (selectedSort === 'priority_asc') {
        const priorityRank: Record<string, number> = { urgente: 4, alta: 3, media: 2, baixa: 1 };
        const rankA = priorityRank[a.priority || 'media'] || 2;
        const rankB = priorityRank[b.priority || 'media'] || 2;
        return rankA - rankB;
      } else if (selectedSort === 'priority_and_created') {
        const priorityRank: Record<string, number> = { urgente: 4, alta: 3, media: 2, baixa: 1 };
        const rankA = priorityRank[a.priority || 'media'] || 2;
        const rankB = priorityRank[b.priority || 'media'] || 2;
        if (rankA !== rankB) return rankB - rankA;
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      } else if (selectedSort === 'pending_long_first') {
        const durA = a.pendingResponseDurationMinutes || 0;
        const durB = b.pendingResponseDurationMinutes || 0;
        return durB - durA;
      } else if (selectedSort === 'pending_short_first') {
        const durA = a.pendingResponseDurationMinutes || 0;
        const durB = b.pendingResponseDurationMinutes || 0;
        return durA - durB;
      }

      return 0;
    });
  }, [listChats, searchQuery, selectedInbox, activeFilter, selectedStatus, filterRules, selectedSort, authenticatedUser]);

  // Handle sending message
  const handleSendMessage = (chatId: string, text: string, attachments?: File[], isPrivate?: boolean, replyTo?: import('./types').ReplyTo | null) => {
    if (!canSendWhatsAppMessage(whatsappConnection, Boolean(isPrivate))) {
      addToast('O WhatsApp desta inbox está desconectado. Reconecte a sessão para enviar mensagens.', 'error');
      return Promise.resolve(false);
    }
    if (selectedConversationId && chatId === String(selectedConversationId)) {
      const inReplyTo = replyTo?.id && /^\d+$/.test(replyTo.id) ? Number(replyTo.id) : undefined;
      return messageHistory.send(text, Boolean(isPrivate), attachments, inReplyTo).then((message) => {
        if (message) applyOutgoingMessage(message);
        return Boolean(message);
      });
    }
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const legacyAttachments: Attachment[] | undefined = attachments?.map((file, index) => ({
      id: `att-${Date.now()}-${index}`,
      type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : file.type.startsWith('video/') ? 'video' : 'file',
      url: '',
      title: file.name,
      size: `${Math.ceil(file.size / 1024)} KB`,
    }));

    const newMsg: Message = {
      id: `msg-${Date.now()}`,
      sender: 'me',
      text,
      time: timeStr,
      status: 'read',
      dateLabel: 'Hoje',
      attachments: legacyAttachments,
      isPrivate,
    };

    setChats((prevChats) =>
      prevChats.map((c) => {
        if (c.id === chatId) {
          const updatedMessages = [...c.messages, newMsg];
          const displayLastMessage = isPrivate
            ? `🔒 Nota: ${text}`
            : text || (attachments ? `${attachments.length} anexo(s)` : 'Anexo');
          return {
            ...c,
            messages: updatedMessages,
            lastMessage: displayLastMessage,
            lastMessageByMe: true,
            time: timeStr,
          };
        }
        return c;
      })
    );
  };

  // Compute counts for filter pills
  const unreadCountTotal = conversations.reduce((total, conversation) => total + conversation.unreadCount, 0);
  // Favoritos/fixação não fazem parte do DTO da lista do Chatwoot nesta fase.
  const favoritesCountTotal = 0;

  // Update contact details
  const handleUpdateContact = (chatId: string, updates: Partial<Chat>) => {
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, ...updates } : c))
    );
  };

  // Delete contact
  const handleDeleteContact = (chatId: string) => {
    setChats((prev) => prev.filter((c) => c.id !== chatId));
  };

  // Create new chat
  const handleCreateNewChat = (
    name: string,
    phone: string,
    channelName: string = 'Whatsapp Oficial(1420)',
    initialMessageText?: string,
    isPrivate?: boolean,
    attachments?: Attachment[]
  ) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const messages: Message[] = [];
    let displayLastMessage = 'Conversa criada';

    if (initialMessageText?.trim() || (attachments && attachments.length > 0)) {
      const text = initialMessageText?.trim() || '';
      messages.push({
        id: `msg-${Date.now()}`,
        sender: 'me',
        text,
        time: timeStr,
        status: 'read',
        dateLabel: 'Hoje',
        isPrivate: !!isPrivate,
        attachments,
      });
      displayLastMessage = isPrivate
        ? `🔒 Nota: ${text || 'Anexo'}`
        : text || (attachments ? `${attachments.length} anexo(s)` : 'Anexo');
    }

    const newChat: Chat = {
      id: `chat-${Date.now()}`,
      name,
      phone,
      about: phone,
      avatar: name.trim().substring(0, 2).toUpperCase(),
      avatarType: 'logo',
      avatarBg: '#0284c7',
      channelName,
      lastMessage: displayLastMessage,
      lastMessageByMe: true,
      time: timeStr,
      lastMessageRelative: 'agora',
      messages,
      unassigned: false,
    };

    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    setShowMobileChat(true);
  };

  // Create new group
  const handleCreateNewGroup = (
    groupName: string,
    description: string,
    channelName: string = 'Whatsapp Oficial(1420)',
    selectedContactIds: string[] = []
  ) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newGroupChat: Chat = {
      id: `group-${Date.now()}`,
      name: groupName,
      avatar: groupName.trim().substring(0, 2).toUpperCase(),
      avatarType: 'group',
      avatarBg: '#0284c7',
      channelName,
      lastMessage: 'Grupo criado',
      lastMessageByMe: true,
      time: timeStr,
      lastMessageRelative: 'agora',
      isGroup: true,
      membersCount: selectedContactIds.length + 1,
      description: description || 'Descrição do grupo',
      messages: [
        {
          id: `msg-${Date.now()}`,
          sender: 'me',
          senderName: 'Você',
          text: `Você criou o grupo "${groupName}"`,
          time: timeStr,
          status: 'read',
          dateLabel: 'Hoje',
        },
      ],
      unassigned: false,
    };

    setChats((prev) => [newGroupChat, ...prev]);
    setActiveChatId(newGroupChat.id);
    setShowMobileChat(true);
  };

  return (
    <div
      style={{ height: 'var(--app-viewport-height, 100dvh)' }}
      className={`w-screen flex flex-col font-sans antialiased overflow-hidden select-none transition-colors ${
        isDarkMode ? 'bg-[#0e0c0c]' : 'bg-[#f0f2f5]'
      }`}
    >
      {/* Main WhatsApp Applet Layout */}
      <div className="flex-1 flex overflow-x-auto overflow-y-hidden relative">
        {/* Far Left Navigation Rail (60px) */}
        <NavRail
          activeTab={activeNavTab}
          onTabChange={(tab) => {
            navigateToTab(tab);
          }}
          selectedInbox={selectedInbox}
          onSelectInbox={selectInboxRoute}
          selectedSettingsTab={selectedSettingsTab}
          onSelectSettingsTab={(tabKey) => navigateToSettings(tabKey as SettingsTab)}
          userAvatar={user.avatar}
          userName={authenticatedUser?.displayName || authenticatedUser?.name || ''}
          userEmail={authenticatedUser?.email || ''}
          isDarkMode={isDarkMode}
          onToggleDarkMode={toggleDarkMode}
          selectedAccount={selectedAccount}
          onSelectAccount={(account) => void handleAccountSelection(account)}
          accounts={authenticatedUser?.accounts.map((account) => ({ id: String(account.id), name: account.name, role: account.role }))}
          inboxes={inboxes}
          inboxesStatus={inboxesStatus}
          inboxesError={inboxesError}
          onRetryInboxes={() => void retryInboxes()}
          onLogout={() => void logout()}
          isSuperAdmin={authenticatedUser?.isSuperAdmin}
          onOpenSuperAdmin={() => window.location.assign(superAdminUrl)}
          systemPermissions={currentAccount?.permissions}
          onNewChatClick={() => {
            setShowNewConversationModal(true);
            setIsSidebarCollapsed(false);
            navigateToTab('chats');
          }}
        />

        {/* Dynamic Secondary Views (Status, Calls, Communities, Settings) */}
        {activeNavTab === 'status' && (
          <StatusView
            statuses={[]}
            onClose={() => navigateToTab('chats')}
          />
        )}

        {activeNavTab === 'calls' && (
          <CallsView
            calls={[]}
            onClose={() => navigateToTab('chats')}
          />
        )}

        {(activeNavTab === 'communities' || (activeNavTab as string) === 'contacts') && (
          <ContactsView
            contacts={contactListItems}
            contactsStatus={contactDirectory.status}
            contactsError={contactDirectory.error}
            onRetryContacts={() => void contactDirectory.retry()}
            accountId={currentAccount?.id ?? null}
            inboxes={inboxes}
            defaultInboxId={/^\d+$/.test(selectedInbox) ? Number(selectedInbox) : inboxes[0]?.id ?? null}
            onCreateContact={createDirectoryContact}
            onStartConversation={startContactConversation}
            isCreatingContact={contactDirectory.isCreating}
            onOpenConversation={(conversationId) => {
              openConversation(String(conversationId));
            }}
            onCreateNewChat={(name, phone, channelName, initialMessageText, isPrivate, attachments) => {
              handleCreateNewChat(name, phone, channelName, initialMessageText, isPrivate, attachments);
              navigateToTab('chats');
            }}
            onUpdateContact={updateDirectoryContact}
            onDeleteContact={deleteDirectoryContact}
            isMutatingContact={contactDirectory.isMutating}
            onClose={() => navigateToTab('chats')}
            isDarkMode={isDarkMode}
          />
        )}

        {activeNavTab === 'settings' && (
          <>
          <MobileProfileSettings user={user} onUpdateUser={setUser} onClose={() => navigateToTab('chats')} isDarkMode={isDarkMode} onToggleDarkMode={toggleDarkMode} />
          <div className="hidden min-h-0 flex-1 md:flex"><SettingsView
            user={user}
            onUpdateUser={(updated) => setUser(updated)}
            onClose={() => navigateToTab('chats')}
            isDarkMode={isDarkMode}
            onToggleDarkMode={toggleDarkMode}
            wallpaperId={wallpaperId}
            onSelectWallpaper={(id) => setWallpaperId(id)}
            activeTab={selectedSettingsTab}
            onTabChange={navigateToSettings}
            selectedInboxId={selectedSettingsInboxId ? Number(selectedSettingsInboxId) : null}
            onOpenInbox={navigateToSettingsInbox}
            accountId={currentAccount?.id ?? null}
            inboxes={inboxes}
            inboxesStatus={inboxesStatus}
            inboxesError={inboxesError}
            onRefreshInboxes={retryInboxes}
            profile={authenticatedUser}
            onSaveProfile={async (profile) => {
              await authService.updateProfile({ name: profile.name, display_name: profile.displayName, email: profile.email, phone_number: profile.phoneNumber, message_signature: profile.messageSignature, ...(profile.password ? { current_password: profile.currentPassword, password: profile.password, password_confirmation: profile.passwordConfirmation } : {}) });
              await retryBootstrap();
            }}
            onResetAccessToken={async () => { await authService.resetAccessToken(); await retryBootstrap(); }}
          /></div>
          </>
        )}

        {activeNavTab === 'tools' && <QuickNotesView isDarkMode={isDarkMode} />}

        {activeNavTab === 'media' && (
          <AppsView
            onClose={() => navigateToTab('chats')}
            isDarkMode={isDarkMode}
          />
        )}

        {/* Full-screen Contacts & Clients Manager Screen */}
        {(showContactsModal || activeNavTab === 'contacts') && (
          <div className="flex-1 h-full overflow-hidden flex flex-col z-30">
            <ContactsView
              contacts={contactListItems}
              contactsStatus={contactDirectory.status}
              contactsError={contactDirectory.error}
              onRetryContacts={() => void contactDirectory.retry()}
              accountId={currentAccount?.id ?? null}
              inboxes={inboxes}
              defaultInboxId={/^\d+$/.test(selectedInbox) ? Number(selectedInbox) : inboxes[0]?.id ?? null}
              onCreateContact={createDirectoryContact}
              onStartConversation={startContactConversation}
              isCreatingContact={contactDirectory.isCreating}
              onOpenConversation={(conversationId) => {
                openConversation(String(conversationId));
                setShowContactsModal(false);
              }}
              onCreateNewChat={(name, phone, channelName, initialMessageText, isPrivate, attachments) => {
                handleCreateNewChat(name, phone, channelName, initialMessageText, isPrivate, attachments);
                setShowContactsModal(false);
                navigateToTab('chats');
              }}
              onUpdateContact={updateDirectoryContact}
              onDeleteContact={deleteDirectoryContact}
              isMutatingContact={contactDirectory.isMutating}
              onClose={() => {
                setShowContactsModal(false);
                navigateToTab('chats');
              }}
              isDarkMode={isDarkMode}
            />
          </div>
        )}

        {/* Primary Chats View (List + Active Chat Pane) */}
        {!showContactsModal &&
          activeNavTab !== 'contacts' &&
          activeNavTab !== 'status' &&
          activeNavTab !== 'calls' &&
          activeNavTab !== 'communities' &&
          activeNavTab !== 'settings' &&
          activeNavTab !== 'media' &&
          activeNavTab !== 'tools' && (
            <div className="flex-1 flex flex-row h-full overflow-x-auto overflow-y-hidden min-w-0">
              {/* Left Chat List Column (Collapsible & Resizable on Desktop) */}
              <div
                style={{ width: window.innerWidth >= 768 ? `${chatListWidth}px` : '100%' }}
                className={`border-r flex flex-col h-full flex-shrink-0 relative transition-all duration-75 select-none ${
                  showMobileChat ? 'hidden' : 'flex'
                } ${isSidebarCollapsed ? 'md:hidden' : 'md:flex'} ${
                  isDarkMode
                    ? 'bg-[#151717] border-[#1e1f1f]'
                    : 'bg-white border-[#d1d7db]'
                }`}
              >
                {/* Resizable Border Handle (Right Edge) */}
                <div
                  onMouseDown={handleMouseDownChatList}
                  title="Arrastar para redimensionar lista de conversas"
                  className={`absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize z-50 hidden md:flex items-center justify-center group transition-colors ${
                    isResizingChatList ? 'bg-[#00a884]' : 'hover:bg-[#00a884]/40'
                  }`}
                >
                  <div
                    className={`w-1 h-8 rounded-full transition-colors flex items-center justify-center ${
                      isResizingChatList ? 'bg-white' : 'bg-[#8696a0]/40 group-hover:bg-[#00a884]'
                    }`}
                  >
                    <GripVertical className="w-3 h-3 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                <ChatListHeader
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  activeFilter={activeFilter}
                  onFilterChange={setActiveFilter}
                  selectedInbox={selectedInbox}
                  inboxes={inboxes}
                  onSelectInbox={selectInboxRoute}
                  onNewChatClick={() => setShowNewConversationModal(true)}
                  onNewContactClick={() => navigateToTab('communities')}
                  onNewGroupClick={() => setShowNewGroupModal(true)}
                  onMenuClick={() => navigateToSettings('conta')}
                  isDarkMode={isDarkMode}
                  unreadCountTotal={unreadCountTotal}
                  favoritesCountTotal={favoritesCountTotal}
                  onToggleSidebar={() => setIsSidebarCollapsed(true)}
                  selectedStatus={selectedStatus}
                  onStatusChange={setSelectedStatus}
                  selectedSort={selectedSort}
                  onSortChange={setSelectedSort}
                  filterRules={filterRules}
                  onFilterRulesChange={setFilterRules}
                  teams={conversationManagement.catalogs.teams}
                  labels={conversationManagement.catalogs.labels}
                  teamFilterId={conversationServerFilters.teamId}
                  labelFilters={conversationServerFilters.labels || []}
                  onTeamFilterChange={(teamId) => setConversationServerFilters((current) => ({ ...current, teamId }))}
                  onLabelFiltersChange={(labels) => setConversationServerFilters((current) => ({ ...current, labels }))}
                />
                {conversationsRefreshing && <div className="h-0.5 overflow-hidden bg-transparent" aria-label="Atualizando conversas"><div className="h-full w-1/3 animate-pulse bg-[#00a884]" /></div>}

                {/* Scrollable Chat List */}
                <div className="flex-1 overflow-y-auto pb-24 md:pb-0 transition-colors" onScroll={(event) => {
                  const element = event.currentTarget;
                  if (hasNextPage && element.scrollTop + element.clientHeight >= element.scrollHeight - 120) loadMore();
                }}>
                  {conversationsStatus === 'loading' && conversations.length === 0 ? (
                    <div className={`p-8 text-center text-sm ${isDarkMode ? 'text-[#8696a0]' : 'text-[#667781]'}`}>Carregando conversas…</div>
                  ) : conversationsStatus === 'error' && conversations.length === 0 ? (
                    <div className={`p-8 text-center text-sm ${isDarkMode ? 'text-[#8696a0]' : 'text-[#667781]'}`}><p>{conversationsError || 'Não foi possível carregar as conversas.'}</p><button type="button" onClick={() => void retryConversations()} className="mt-3 text-[#00a884] hover:underline">Tentar novamente</button></div>
                  ) : filteredAndSortedChats.length > 0 ? (
                    filteredAndSortedChats.map((c) => (
                      <ChatListItem
                        key={c.id}
                        chat={c}
                        isSelected={c.id === activeChatId}
                        onContextMenu={handleChatContextMenu}
                        onSelect={(selected) => {
                          openConversation(selected.id);
                        }}
                        isDarkMode={isDarkMode}
                      />
                    ))
                  ) : (
                    <div
                      className={`p-8 text-center text-sm ${
                        isDarkMode ? 'text-[#8696a0]' : 'text-[#667781]'
                      }`}
                    >
                      Nenhuma conversa encontrada
                    </div>
                  )}
                  {isLoadingMore && <div className={`p-4 text-center text-xs ${isDarkMode ? 'text-[#8696a0]' : 'text-[#667781]'}`}>Carregando mais conversas…</div>}
                </div>
              </div>

              {/* Right Active Chat Window Pane */}
              <div
                className={`flex-1 h-full min-w-0 md:min-w-[340px] flex flex-col overflow-hidden ${
                  showMobileChat ? 'flex' : 'hidden md:flex'
                }`}
              >
                {activeChatWithHistory ? <ChatArea
                  chat={activeChatWithHistory}
                  allChats={listChats}
                  onSelectChat={(selected) => {
                    openConversation(selected.id);
                  }}
                  onSendMessage={handleSendMessage}
                  onImageClick={(url, title, subtitle) =>
                    setPreviewImage({ url, title, subtitle })
                  }
                  onSearchInChat={() => {}}
                  historyStatus={selectedConversationId ? messageHistory.status : 'idle'}
                  historyError={messageHistory.error}
                  hasOlderMessages={messageHistory.hasOlderMessages}
                  isLoadingOlder={messageHistory.isLoadingOlder}
                  onRetryHistory={() => void messageHistory.retry()}
                  onLoadOlderMessages={messageHistory.loadOlder}
                  onRetryMessage={(messageId) => void messageHistory.retrySend(Number(messageId)).then((message) => {
                    if (message) applyOutgoingMessage(message);
                  })}
                  onDeleteMessage={(messageId) => messageHistory.remove(Number(messageId))}
                  onReactMessage={(messageId, emoji) => messageHistory.react(Number(messageId), emoji)}
                  onEditMessage={(messageId, content) => messageHistory.edit(Number(messageId), content)}
                  onRevokeMessage={(messageId) => messageHistory.revoke(Number(messageId))}
                  conversation={selectedConversation}
                  inboxes={inboxes}
                  whatsappConnection={whatsappConnection}
                  managementCatalogs={conversationManagement.catalogs}
                  managementCatalogStatus={conversationManagement.catalogStatus}
                  managementCatalogError={conversationManagement.catalogError}
                  managementPendingAction={conversationManagement.pendingAction}
                  onRetryManagementCatalogs={() => void conversationManagement.retryCatalogs()}
                  onSetConversationStatus={(status) => {
                    if (!selectedConversationId) return;
                    void runConversationAction(conversationManagement.setStatus(selectedConversationId, status), (update) => applyConversationUpdate(selectedConversationId, update));
                  }}
                  onSetConversationPriority={(priority) => {
                    if (!selectedConversationId) return;
                    void runConversationAction(conversationManagement.setPriority(selectedConversationId, priority), (update) => applyConversationUpdate(selectedConversationId, update));
                  }}
                  onAssignConversationAgent={(agentId) => {
                    if (!selectedConversationId) return;
                    void runConversationAction(conversationManagement.assignAgent(selectedConversationId, agentId), (update) => applyConversationUpdate(selectedConversationId, update));
                  }}
                  onAssignConversationTeam={(teamId) => {
                    if (!selectedConversationId) return;
                    void runConversationAction(conversationManagement.assignTeam(selectedConversationId, teamId), (update) => applyConversationUpdate(selectedConversationId, update));
                  }}
                  onSetConversationLabels={(labels) => {
                    if (!selectedConversationId) return;
                    void runConversationAction(conversationManagement.setLabels(selectedConversationId, labels), (update) => applyConversationUpdate(selectedConversationId, update));
                  }}
                  onMarkConversationRead={() => {
                    if (!selectedConversationId) return;
                    void runConversationAction(conversationManagement.markRead(selectedConversationId), replaceConversation);
                  }}
                  onMarkConversationUnread={() => {
                    if (!selectedConversationId) return;
                    void runConversationAction(conversationManagement.markUnread(selectedConversationId), replaceConversation);
                  }}
                  onReachLatestMessage={markSelectedConversationRead}
                  realtimeConnectionStatus={realtimeConnectionStatus}
                  typingName={typing?.name ?? null}
                  contact={contactDetails.contact}
                  contactNotes={contactDetails.notes}
                  contactStatus={selectedConversation ? contactDetails.status : 'idle'}
                  contactError={contactDetails.error}
                  isContactSaving={contactDetails.isSaving}
                  isCreatingContactNote={contactDetails.isCreatingNote}
                  onRetryContact={() => void contactDetails.retry()}
                  onUpdateContact={updateSelectedContact}
                  onCreateContactNote={contactDetails.createNote}
                  accountId={currentAccount?.id ?? null}
                  isDarkMode={isDarkMode}
                  wallpaperId={wallpaperId}
                  isSidebarCollapsed={isSidebarCollapsed}
                  onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
                  onMobileBack={() => navigateToTab('chats')}
                /> : (
                  <div className={`h-full flex items-center justify-center text-center p-8 ${isDarkMode ? 'bg-[#0b141a] text-[#8696a0]' : 'bg-[#f0f2f5] text-[#667781]'}`}>
                    <div>
                      <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-60" />
                      <h2 className="font-semibold text-base text-inherit">{conversationsStatus === 'loading' ? 'Carregando conversas…' : 'Nenhuma conversa selecionada'}</h2>
                      <p className="mt-1 text-sm">{conversationsStatus === 'loading' ? 'Aguarde enquanto buscamos os atendimentos da conta.' : 'Selecione uma conversa da lista para ver o histórico real.'}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
      </div>

      {/* Floating Mobile Navigation Bar */}
      {!showMobileChat && !showContactsModal && activeNavTab !== 'contacts' && (
        <FloatingMobileNav
          activeTab={activeNavTab}
          onTabChange={(tab) => {
            navigateToTab(tab);
          }}
          isDarkMode={isDarkMode}
          unreadCountTotal={unreadCountTotal}
          onNewConversation={() => setShowNewConversationModal(true)}
          onNewContact={() => navigateToTab('communities')}
          onNewGroup={() => setShowNewGroupModal(true)}
        />
      )}

      {/* Image Fullscreen Modal */}
      {previewImage && (
        <ImagePreviewModal
          imageUrl={previewImage.url}
          title={previewImage.title}
          subtitle={previewImage.subtitle}
          onClose={() => setPreviewImage(null)}
        />
      )}

      {/* New Conversation Modal (Dedicated Modal with Automatic Existing Chat Checker & Inbox Details) */}
      {showNewConversationModal && (
        <NewConversationModal
          contacts={contactListItems}
          contactsStatus={contactDirectory.status}
          contactsError={contactDirectory.error}
          onRetryContacts={() => void contactDirectory.retry()}
          inboxes={inboxes}
          defaultInboxId={/^\d+$/.test(selectedInbox) ? Number(selectedInbox) : inboxes[0]?.id ?? null}
          onCreateContact={createDirectoryContact}
          onStartConversation={startContactConversation}
          onClose={() => setShowNewConversationModal(false)}
          isDarkMode={isDarkMode}
        />
      )}

      {/* New Group Modal */}
      {showNewGroupModal && (
        <NewGroupModal
          chats={chats}
          onCreateGroup={handleCreateNewGroup}
          onClose={() => setShowNewGroupModal(false)}
          isDarkMode={isDarkMode}
        />
      )}

      {/* Global Context Menu */}
      <ContextMenu
        x={menuState.x}
        y={menuState.y}
        isOpen={menuState.isOpen}
        onClose={closeContextMenu}
        items={menuState.items}
        title={menuState.title}
        isDarkMode={isDarkMode}
      />

      {conversationPendingDeletion && (
        <ConfirmDialog
          title="Excluir conversa?"
          description={`A conversa com “${conversationPendingDeletion.name}” será removida. Esta ação não pode ser desfeita.`}
          isBusy={isDeletingConversation}
          onCancel={() => { if (!isDeletingConversation) setConversationPendingDeletion(null); }}
          onConfirm={() => void deleteConversation(conversationPendingDeletion)}
        />
      )}

      {/* Floating Toast Notifications */}
      <ToastContainer
        toasts={toasts}
        onDismiss={removeToast}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}
