import React, { useState, useRef, useEffect } from 'react';
import {
  Inbox,
  MessageSquare,
  Folder,
  BookUser,
  BarChart2,
  Megaphone,
  HelpCircle,
  Settings,
  Search,
  Pencil,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  PanelLeftOpen,
  PanelLeftClose,
  Keyboard,
  User,
  Palette,
  ShieldCheck,
  LogOut,
  Info,
  Check,
  Sun,
  Moon,
  BookOpen,
  Building,
  UserCheck,
  Users,
  Tag,
  Code,
  Repeat,
  Plug,
  Sliders,
  MessageSquareQuote,
  Clock,
  Scroll,
  Bot,
  Timer,
  GitFork,
  Lock,
  LayoutGrid,
  GripVertical,
} from 'lucide-react';
import { NavTab, MultiTenantAccount } from '../types';
import type { Inbox as ChatwootInbox } from '../domain/currentUser';
import type { InboxesStatus } from '../features/inboxes/useInboxes';
import {
  InstagramIcon,
  MessengerIcon,
  WhatsappIcon,
  WhatsappOficialIcon,
  getChannelIcon,
} from './ChannelIcons';

interface Props {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  selectedInbox?: string;
  onSelectInbox?: (inboxKey: string) => void;
  selectedSettingsTab?: string;
  onSelectSettingsTab?: (tabKey: string) => void;
  userAvatar: string;
  userName: string;
  userEmail: string;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onNewChatClick?: () => void;
  selectedAccount?: MultiTenantAccount;
  onSelectAccount?: (account: MultiTenantAccount) => void;
  accounts?: MultiTenantAccount[];
  onLogout?: () => void;
  inboxes?: ChatwootInbox[];
  inboxesStatus?: InboxesStatus;
  inboxesError?: string | null;
  onRetryInboxes?: () => void;
  isSuperAdmin?: boolean;
  onOpenSuperAdmin?: () => void;
  systemPermissions?: string[];
}

export const NavRail: React.FC<Props> = ({
  activeTab,
  onTabChange,
  selectedInbox = 'todas',
  onSelectInbox,
  selectedSettingsTab = 'conta',
  onSelectSettingsTab,
  userAvatar,
  userName,
  userEmail,
  isDarkMode,
  onToggleDarkMode,
  onNewChatClick,
  selectedAccount,
  onSelectAccount,
  accounts,
  onLogout,
  inboxes = [],
  inboxesStatus = 'idle',
  inboxesError = null,
  onRetryInboxes,
  isSuperAdmin = false,
  onOpenSuperAdmin,
  systemPermissions = [],
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [expandedWidth, setExpandedWidth] = useState<number>(() => {
    const saved = localStorage.getItem('wa_nav_rail_width');
    return saved ? Math.max(180, Math.min(420, parseInt(saved, 10))) : 250;
  });
  const [isResizingNav, setIsResizingNav] = useState(false);
  const isResizingNavRef = useRef(false);

  useEffect(() => {
    localStorage.setItem('wa_nav_rail_width', String(expandedWidth));
  }, [expandedWidth]);

  const handleMouseDownNav = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingNavRef.current = true;
    setIsResizingNav(true);

    const startX = e.clientX;
    const startWidth = expandedWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingNavRef.current) return;
      const deltaX = moveEvent.clientX - startX;
      const newWidth = startWidth + deltaX;
      if (newWidth >= 180 && newWidth <= 420) {
        setExpandedWidth(newWidth);
      }
    };

    const onMouseUp = () => {
      isResizingNavRef.current = false;
      setIsResizingNav(false);
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
  const [isConversasOpen, setIsConversasOpen] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const [hoveredFlyout, setHoveredFlyout] = useState<string | null>(null);
  const canManage = (permission: string) => systemPermissions.includes('administrator') || systemPermissions.includes(permission);
  const settingsMenuItems = [
    { id: 'perfil', label: 'Perfil', icon: <User className="w-3.5 h-3.5" /> },
    { id: 'conta', label: 'Conta', icon: <Building className="w-3.5 h-3.5" />, permission: 'account_settings_manage' },
    { id: 'agentes', label: 'Agentes', icon: <UserCheck className="w-3.5 h-3.5" />, permission: 'agents_manage' },
    { id: 'times', label: 'Times', icon: <Users className="w-3.5 h-3.5" />, permission: 'teams_manage' },
    { id: 'caixas', label: 'Caixas de Entrada', icon: <Inbox className="w-3.5 h-3.5" />, permission: 'inboxes_manage' },
    { id: 'etiquetas', label: 'Etiquetas', icon: <Tag className="w-3.5 h-3.5" />, permission: 'labels_manage' },
    { id: 'atributos', label: 'Atributos', icon: <Code className="w-3.5 h-3.5" />, permission: 'account_settings_manage' },
    { id: 'automacao', label: 'Automação', icon: <Repeat className="w-3.5 h-3.5" />, permission: 'account_settings_manage' },
    { id: 'macros', label: 'Macros', icon: <Sliders className="w-3.5 h-3.5" />, permission: 'account_settings_manage' },
    { id: 'respostas', label: 'Respostas Prontas', icon: <MessageSquareQuote className="w-3.5 h-3.5" />, permission: 'canned_responses_manage' },
    { id: 'agendadas', label: 'Mensagens Agendadas', icon: <Clock className="w-3.5 h-3.5" />, permission: 'account_settings_manage' },
    { id: 'integracoes', label: 'Integrações e Apps', icon: <Plug className="w-3.5 h-3.5" />, permission: 'integrations_manage' },
    { id: 'auditoria', label: 'Registros de Auditoria', icon: <Scroll className="w-3.5 h-3.5" />, permission: 'audit_logs_view' },
    { id: 'permissoes', label: 'Permissões', icon: <ShieldCheck className="w-3.5 h-3.5" />, permission: 'agents_manage' },
  ].filter(item => !item.permission || canManage(item.permission));
  const flyoutTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnterFlyout = (key: string) => {
    if (flyoutTimerRef.current) {
      clearTimeout(flyoutTimerRef.current);
      flyoutTimerRef.current = null;
    }
    setHoveredFlyout(key);
  };

  const handleMouseLeaveFlyout = () => {
    if (flyoutTimerRef.current) {
      clearTimeout(flyoutTimerRef.current);
    }
    flyoutTimerRef.current = setTimeout(() => {
      setHoveredFlyout(null);
      flyoutTimerRef.current = null;
    }, 1000); // Wait 1s before closing flyout
  };

  const handleCloseFlyoutImmediately = () => {
    if (flyoutTimerRef.current) {
      clearTimeout(flyoutTimerRef.current);
      flyoutTimerRef.current = null;
    }
    setHoveredFlyout(null);
  };

  useEffect(() => {
    return () => {
      if (flyoutTimerRef.current) {
        clearTimeout(flyoutTimerRef.current);
      }
    };
  }, []);
  const [isFlyoutCanaisOpen, setIsFlyoutCanaisOpen] = useState<boolean>(true);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [availability, setAvailability] = useState<'online' | 'ocupado' | 'ausente' | 'offline'>('online');
  const [showAvailabilityDropdown, setShowAvailabilityDropdown] = useState(false);
  const [autoOffline, setAutoOffline] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Multi-Tenant Account Switcher state
  const availableAccounts = accounts || [];
  const [internalAccount, setInternalAccount] = useState<MultiTenantAccount>({ id: '', name: '', role: '' });
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [accountSearch, setAccountSearch] = useState('');

  const currentAcc = selectedAccount || internalAccount;

  const handleChooseAccount = (acc: MultiTenantAccount) => {
    setInternalAccount(acc);
    onSelectAccount?.(acc);
    setShowAccountDropdown(false);
    setAccountSearch('');
  };

  const handleInboxClick = (key: string) => {
    // `onSelectInbox` owns navigation and already switches to the chats tab.
    // Calling `onTabChange('chats')` immediately afterwards used stale state
    // and rewrote the just-selected numeric inbox back to "todas".
    onSelectInbox?.(key);
  };

  const renderInboxRows = (variant: 'flyout' | 'expanded') => {
    if (inboxesStatus === 'loading') return <p className="px-2.5 py-2 text-xs text-[#8696a0]">Carregando canais…</p>;
    if (inboxesStatus === 'error') return <div className="px-2.5 py-2 text-xs text-red-400"><p>{inboxesError || 'Não foi possível carregar os canais.'}</p><button type="button" onClick={onRetryInboxes} className="mt-1 text-[#00a884] hover:underline">Tentar novamente</button></div>;
    if (inboxes.length === 0) return <p className="px-2.5 py-2 text-xs text-[#8696a0]">Nenhum canal disponível.</p>;

    return inboxes.map((inbox) => {
      const key = String(inbox.id);
      const selected = selectedInbox === key && activeTab === 'chats';
      const selectedClass = variant === 'flyout'
        ? (isDarkMode ? 'bg-[#2c3138] text-white font-semibold' : 'bg-[#e9edef] text-[#111b21] font-semibold')
        : (isDarkMode ? 'bg-[#2a3942] text-white font-semibold shadow-xs' : 'bg-[#e9edef] text-[#111b21] font-semibold shadow-xs');
      const idleClass = variant === 'flyout'
        ? (isDarkMode ? 'text-[#aebac1] hover:text-white hover:bg-[#2c3138]/50' : 'text-[#54656f] hover:text-[#111b21] hover:bg-[#e9edef]/50')
        : (isDarkMode ? 'text-[#aebac1] hover:text-white hover:bg-[#2a3942]/50' : 'text-[#54656f] hover:text-[#111b21] hover:bg-[#e9edef]/50');
      return <button key={inbox.id} type="button" onClick={() => { handleInboxClick(key); if (variant === 'flyout') handleCloseFlyoutImmediately(); }} className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center space-x-2 ${selected ? selectedClass : idleClass}`} title={inbox.name}>
        {inbox.avatarUrl ? <img src={inbox.avatarUrl} alt="" className="w-4 h-4 rounded-full object-cover shrink-0" /> : getChannelIcon(inbox.channelType)}
        <span className="truncate">{inbox.name}</span>
      </button>;
    });
  };

  const getStatusBadge = () => {
    switch (availability) {
      case 'online':
        return { label: 'Online', color: 'bg-emerald-500' };
      case 'ocupado':
        return { label: 'Ocupado', color: 'bg-red-500' };
      case 'ausente':
        return { label: 'Ausente', color: 'bg-amber-500' };
      case 'offline':
        return { label: 'Offline', color: 'bg-gray-400' };
    }
  };

  return (
    <div className="relative hidden md:flex shrink-0 z-[100] select-none">
      <div
        style={{ width: isExpanded ? `${expandedWidth}px` : '60px' }}
        className={`flex flex-col justify-between h-full border-r transition-all duration-75 relative z-[100] ${
          isDarkMode
            ? 'bg-[#1e1f1f] border-[#2a3238] text-[#aebac1]'
            : 'bg-[#f0f2f5] border-[#d1d7db] text-[#54656f]'
        }`}
      >
        {/* Resizable Border Handle on Right Edge when Expanded */}
        {isExpanded && (
          <div
            onMouseDown={handleMouseDownNav}
            title="Arrastar para redimensionar barra lateral de navegação"
            className={`absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize z-50 flex items-center justify-center group transition-colors ${
              isResizingNav ? 'bg-[#00a884]' : 'hover:bg-[#00a884]/40'
            }`}
          >
            <div
              className={`w-1 h-8 rounded-full transition-colors flex items-center justify-center ${
                isResizingNav ? 'bg-white' : 'bg-[#8696a0]/40 group-hover:bg-[#00a884]'
              }`}
            >
              <GripVertical className="w-3 h-3 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        )}
        {/* Top Header / Workspace & Expand Toggle */}
        <div className="p-3 pb-2 flex flex-col space-y-3 relative">
          {isExpanded ? (
            <>
              {/* Expanded Header: Workspace Title + Collapse Button */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowAccountDropdown((prev) => !prev)}
                  className={`flex items-center space-x-2 px-1.5 py-1 rounded-lg text-sm font-semibold transition-colors cursor-pointer max-w-[190px] ${
                    showAccountDropdown
                      ? isDarkMode
                        ? 'bg-[#242525] text-white'
                        : 'bg-[#e9edef] text-[#111b21]'
                      : isDarkMode
                      ? 'hover:bg-[#242525] text-white'
                      : 'hover:bg-[#e9edef] text-[#111b21]'
                  }`}
                  title="Alterar conta"
                >
                  <div className="w-6 h-6 rounded-md bg-[#00a884] text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                    {currentAcc.id === '22' ? '3c' : currentAcc.id}
                  </div>
                  <span className="truncate max-w-[120px]">{currentAcc.name}</span>
                  <ChevronDown
                    className={`w-4 h-4 opacity-70 shrink-0 transition-transform duration-200 ${
                      showAccountDropdown ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  title="Recolher barra lateral"
                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                    isDarkMode
                      ? 'text-[#aebac1] hover:text-white hover:bg-[#242525]'
                      : 'text-[#54656f] hover:text-[#111b21] hover:bg-[#e9edef]'
                  }`}
                >
                  <PanelLeftClose className="w-5 h-5" />
                </button>
              </div>

              {/* Multi-Tenant Account Switcher Dropdown Menu (Chatwoot style) */}
              {showAccountDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => {
                      setShowAccountDropdown(false);
                      setAccountSearch('');
                    }}
                  />
                  <div
                    className={`absolute top-11 left-2 w-72 rounded-xl shadow-2xl border z-50 flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 ${
                      isDarkMode
                        ? 'bg-[#222529] border-[#32363e] text-white'
                        : 'bg-white border-[#d1d7db] text-[#111b21]'
                    }`}
                  >
                    {/* Header Label */}
                    <div className="px-3 pt-3 pb-1 text-[11px] font-semibold text-[#8696a0] tracking-wide">
                      Alterar conta
                    </div>

                    {/* Search Field */}
                    <div className="px-3 py-1.5 border-b border-white/5">
                      <div
                        className={`flex items-center px-2 py-1 rounded-lg text-xs border ${
                          isDarkMode
                            ? 'bg-[#181a1d] border-[#32363e] text-white'
                            : 'bg-[#f0f2f5] border-[#d1d7db] text-[#111b21]'
                        }`}
                      >
                        <Search className="w-3.5 h-3.5 text-[#8696a0] mr-1.5 shrink-0" />
                        <input
                          type="text"
                          value={accountSearch}
                          onChange={(e) => setAccountSearch(e.target.value)}
                          placeholder="Pesquisar conta..."
                          className="w-full bg-transparent outline-none text-xs placeholder-[#8696a0]"
                          autoFocus
                        />
                      </div>
                    </div>

                    {/* Scrollable Accounts List */}
                    <div className="max-h-64 overflow-y-auto py-1 divide-y divide-transparent">
                      {availableAccounts.filter(
                        (acc) =>
                          acc.name.toLowerCase().includes(accountSearch.toLowerCase()) ||
                          acc.id.includes(accountSearch) ||
                          acc.role.toLowerCase().includes(accountSearch.toLowerCase())
                      ).map((acc) => {
                        const isSelected = currentAcc.id === acc.id;
                        return (
                          <button
                            key={acc.id}
                            onClick={() => handleChooseAccount(acc)}
                            className={`w-full px-3 py-2 flex items-center justify-between transition-colors text-left text-xs cursor-pointer ${
                              isSelected
                                ? isDarkMode
                                  ? 'bg-[#2c3138] text-white font-medium'
                                  : 'bg-[#e9edef] text-[#111b21] font-medium'
                                : isDarkMode
                                ? 'hover:bg-[#2c3138]/70 text-[#aebac1] hover:text-white'
                                : 'hover:bg-[#f0f2f5] text-[#54656f] hover:text-[#111b21]'
                            }`}
                          >
                            <div className="flex items-center space-x-2 truncate pr-2 min-w-0">
                              <span className="font-semibold text-xs sm:text-sm truncate">
                                {acc.id} - {acc.name}
                              </span>
                              <span
                                className={`text-[11px] shrink-0 font-normal ${
                                  isDarkMode ? 'text-[#8696a0]' : 'text-[#667781]'
                                }`}
                              >
                                | {acc.role}
                              </span>
                            </div>
                            {isSelected && (
                              <Check className="w-4 h-4 text-emerald-400 shrink-0 ml-2" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                  </div>
                </>
              )}

              {/* Expanded Search Bar */}
              <div className="flex items-center space-x-1.5">
                <div
                  className={`flex-1 flex items-center px-2.5 py-1.5 rounded-lg border text-xs transition-colors ${
                    isDarkMode
                      ? 'bg-[#151717] border-[#242525] text-white'
                      : 'bg-white border-[#d1d7db] text-[#111b21]'
                  }`}
                >
                  <Search className="w-3.5 h-3.5 text-[#8696a0] mr-2 shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Pesquisar..."
                    className="w-full bg-transparent outline-none placeholder-[#8696a0]"
                  />
                </div>
                <button
                  type="button"
                  onClick={onNewChatClick}
                  title="Nova conversa"
                  className={`p-1.5 rounded-lg border transition-colors cursor-pointer shrink-0 ${
                    isDarkMode
                      ? 'bg-[#151717] border-[#242525] text-[#aebac1] hover:text-white hover:bg-[#242525]'
                      : 'bg-white border-[#d1d7db] text-[#54656f] hover:text-[#111b21] hover:bg-[#e9edef]'
                  }`}
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            /* Collapsed Header: Badge Button + Expand Button */
            <div className="flex flex-col items-center space-y-2 relative">
              <button
                type="button"
                onClick={() => setShowAccountDropdown((prev) => !prev)}
                title={`Conta atual: ${currentAcc.id} - ${currentAcc.name}`}
                className={`p-1 rounded-lg transition-colors cursor-pointer ${
                  isDarkMode ? 'hover:bg-[#2a3942]' : 'hover:bg-[#e9edef]'
                }`}
              >
                <div className="w-7 h-7 rounded-md bg-[#00a884] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                  {currentAcc.id === '22' ? '3c' : currentAcc.id}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsExpanded(true)}
                title="Expandir barra lateral"
                className={`p-2 rounded-xl transition-colors cursor-pointer ${
                  isDarkMode
                    ? 'text-[#aebac1] hover:text-white hover:bg-[#2a3942]'
                    : 'text-[#54656f] hover:text-[#111b21] hover:bg-[#e9edef]'
                }`}
              >
                <PanelLeftOpen className="w-5 h-5" />
              </button>

              {showAccountDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => {
                      setShowAccountDropdown(false);
                      setAccountSearch('');
                    }}
                  />
                  <div
                    className={`absolute top-0 left-12 w-72 rounded-xl shadow-2xl border z-50 flex flex-col overflow-hidden animate-in fade-in slide-in-from-left-2 duration-150 ${
                      isDarkMode
                        ? 'bg-[#222529] border-[#32363e] text-white'
                        : 'bg-white border-[#d1d7db] text-[#111b21]'
                    }`}
                  >
                    <div className="px-3 pt-3 pb-1 text-[11px] font-semibold text-[#8696a0] tracking-wide">
                      Alterar conta
                    </div>
                    <div className="max-h-64 overflow-y-auto py-1">
                      {availableAccounts.map((acc) => {
                        const isSelected = currentAcc.id === acc.id;
                        return (
                          <button
                            key={acc.id}
                            onClick={() => handleChooseAccount(acc)}
                            className={`w-full px-3 py-2 flex items-center justify-between transition-colors text-left text-xs cursor-pointer ${
                              isSelected
                                ? isDarkMode
                                  ? 'bg-[#2c3138] text-white font-medium'
                                  : 'bg-[#e9edef] text-[#111b21] font-medium'
                                : isDarkMode
                                ? 'hover:bg-[#2c3138]/70 text-[#aebac1] hover:text-white'
                                : 'hover:bg-[#f0f2f5] text-[#54656f] hover:text-[#111b21]'
                            }`}
                          >
                            <div className="flex items-center space-x-2 truncate pr-2 min-w-0">
                              <span className="font-semibold text-xs truncate">
                                {acc.id} - {acc.name}
                              </span>
                              <span className="text-[10px] text-[#8696a0] font-normal">
                                | {acc.role}
                              </span>
                            </div>
                            {isSelected && (
                              <Check className="w-4 h-4 text-emerald-400 shrink-0 ml-2" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Main Navigation Options List */}
        <div className={`flex-1 px-2 py-1 space-y-1 ${isExpanded ? 'overflow-y-auto' : 'overflow-visible'}`}>
          {/* 1. Caixa de Entrada */}
          <button
            onClick={() => onTabChange('chats')}
            title="Caixa de Entrada"
            className={`w-full flex items-center px-2.5 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'chats' && !isExpanded
                ? isDarkMode
                  ? 'bg-[#242525] text-[#00a884]'
                  : 'bg-[#e9edef] text-[#00a884]'
                : isDarkMode
                ? 'text-[#aebac1] hover:bg-[#242525] hover:text-white'
                : 'text-[#54656f] hover:bg-[#e9edef] hover:text-[#111b21]'
            }`}
          >
            <Inbox className="w-4.5 h-4.5 shrink-0" />
            {isExpanded && <span className="ml-3 truncate">Caixa de Entrada</span>}
          </button>

          {/* 2. Conversas Accordion Section */}
          <div
            className="relative"
            onMouseEnter={() => !isExpanded && handleMouseEnterFlyout('conversas')}
            onMouseLeave={() => !isExpanded && handleMouseLeaveFlyout()}
          >
            <button
              onClick={() => {
                onTabChange('chats');
                if (isExpanded) {
                  setIsConversasOpen((prev) => !prev);
                } else {
                  if (hoveredFlyout === 'conversas') {
                    handleCloseFlyoutImmediately();
                  } else {
                    handleMouseEnterFlyout('conversas');
                  }
                }
              }}
              title={hoveredFlyout === 'conversas' ? undefined : "Conversas"}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'chats'
                  ? isDarkMode
                    ? 'text-white bg-[#242525]/40'
                    : 'text-[#111b21] bg-[#e9edef]/40'
                  : isDarkMode
                  ? 'text-[#aebac1] hover:bg-[#242525] hover:text-white'
                  : 'text-[#54656f] hover:bg-[#e9edef] hover:text-[#111b21]'
              }`}
            >
              <div className="flex items-center min-w-0">
                <MessageSquare className="w-4.5 h-4.5 shrink-0" />
                {isExpanded && <span className="ml-3 truncate font-bold text-xs">Conversas</span>}
              </div>
              {isExpanded && (
                <ChevronUp
                  className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                    isConversasOpen ? '' : 'rotate-180'
                  } opacity-70`}
                />
              )}
            </button>

            {/* Hover Flyout Popover Menu when Collapsed */}
            {!isExpanded && hoveredFlyout === 'conversas' && (
              <div
                className={`fixed left-[60px] top-3 bottom-3 my-auto h-fit max-h-[calc(100vh-24px)] w-64 rounded-2xl shadow-2xl border z-[999] p-3 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${
                  isDarkMode
                    ? 'bg-[#222529] border-[#32363e] text-white shadow-black/90'
                    : 'bg-white border-[#d1d7db] text-[#111b21] shadow-2xl'
                }`}
                onMouseEnter={() => handleMouseEnterFlyout('conversas')}
                onMouseLeave={() => handleMouseLeaveFlyout()}
              >
                {/* Popover Header */}
                <div className="px-1 pb-2 text-[11px] font-extrabold text-[#8696a0] tracking-wider uppercase border-b border-white/10 mb-2 flex items-center justify-between shrink-0">
                  <span>CONVERSAS</span>
                  <MessageSquare className="w-3.5 h-3.5 text-[#00a884]" />
                </div>

                <div className="space-y-1 overflow-y-auto pr-1 flex-1 min-h-0">
                  {/* Todas as conversas */}
                  <button
                    type="button"
                    onClick={() => {
                      handleInboxClick('todas');
                      handleCloseFlyoutImmediately();
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center justify-between ${
                      selectedInbox === 'todas' && activeTab === 'chats'
                        ? isDarkMode
                          ? 'bg-[#2c3138] text-white font-semibold'
                          : 'bg-[#e9edef] text-[#111b21] font-semibold'
                        : isDarkMode
                        ? 'text-[#aebac1] hover:text-white hover:bg-[#2c3138]/60'
                        : 'text-[#54656f] hover:text-[#111b21] hover:bg-[#e9edef]/60'
                    }`}
                  >
                    <span>Todas as conversas</span>
                  </button>

                  {/* Menções */}
                  <button
                    type="button"
                    onClick={() => {
                      handleInboxClick('mencoes');
                      handleCloseFlyoutImmediately();
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center justify-between ${
                      selectedInbox === 'mencoes' && activeTab === 'chats'
                        ? isDarkMode
                          ? 'bg-[#2c3138] text-white font-semibold'
                          : 'bg-[#e9edef] text-[#111b21] font-semibold'
                        : isDarkMode
                        ? 'text-[#aebac1] hover:text-white hover:bg-[#2c3138]/60'
                        : 'text-[#54656f] hover:text-[#111b21] hover:bg-[#e9edef]/60'
                    }`}
                  >
                    <span>Menções</span>
                  </button>

                  {/* Participantes */}
                  <button
                    type="button"
                    onClick={() => {
                      handleInboxClick('participantes');
                      handleCloseFlyoutImmediately();
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center justify-between ${
                      selectedInbox === 'participantes' && activeTab === 'chats'
                        ? isDarkMode
                          ? 'bg-[#2c3138] text-white font-semibold'
                          : 'bg-[#e9edef] text-[#111b21] font-semibold'
                        : isDarkMode
                        ? 'text-[#aebac1] hover:text-white hover:bg-[#2c3138]/60'
                        : 'text-[#54656f] hover:text-[#111b21] hover:bg-[#e9edef]/60'
                    }`}
                  >
                    <span>Participantes</span>
                  </button>

                  {/* Não atendidas */}
                  <button
                    type="button"
                    onClick={() => {
                      handleInboxClick('nao_atendidas');
                      handleCloseFlyoutImmediately();
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer flex items-center justify-between ${
                      selectedInbox === 'nao_atendidas' && activeTab === 'chats'
                        ? isDarkMode
                          ? 'bg-[#2c3138] text-white font-semibold'
                          : 'bg-[#e9edef] text-[#111b21] font-semibold'
                        : isDarkMode
                        ? 'text-[#aebac1] hover:text-white hover:bg-[#2c3138]/60'
                        : 'text-[#54656f] hover:text-[#111b21] hover:bg-[#e9edef]/60'
                    }`}
                  >
                    <span>Não atendidas</span>
                  </button>

                  {/* Canais Accordion Header */}
                  <div className="pt-2 border-t border-white/10 mt-1.5">
                    <button
                      type="button"
                      onClick={() => setIsFlyoutCanaisOpen((prev) => !prev)}
                      className="w-full flex items-center justify-between px-2 py-1 text-[11px] font-extrabold text-[#8696a0] hover:text-white transition-colors cursor-pointer uppercase tracking-tight"
                    >
                      <div className="flex items-center space-x-1.5">
                        <BookOpen className="w-3.5 h-3.5 opacity-80" />
                        <span>Canais</span>
                      </div>
                      <ChevronUp
                        className={`w-3.5 h-3.5 transition-transform duration-200 ${
                          isFlyoutCanaisOpen ? '' : 'rotate-180'
                        }`}
                      />
                    </button>

                    {/* Channels Sub-list */}
                    {isFlyoutCanaisOpen && <div className="space-y-0.5 mt-1">{renderInboxRows('flyout')}</div>}
                    {/* Legacy mock entries are disabled until removed in the visual cleanup pass. */}
                    {false && isFlyoutCanaisOpen && (
                      <div className="space-y-0.5 mt-1">
                        <button
                          type="button"
                          onClick={() => { handleInboxClick('grupo.kopla'); handleCloseFlyoutImmediately(); }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center space-x-2 ${
                            selectedInbox === 'grupo.kopla' && activeTab === 'chats'
                              ? isDarkMode
                                ? 'bg-[#2c3138] text-white font-semibold'
                                : 'bg-[#e9edef] text-[#111b21] font-semibold'
                              : isDarkMode
                              ? 'text-[#aebac1] hover:text-white hover:bg-[#2c3138]/50'
                              : 'text-[#54656f] hover:text-[#111b21] hover:bg-[#e9edef]/50'
                          }`}
                        >
                          <InstagramIcon />
                          <span className="truncate">grupo.kopla</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => { handleInboxClick('Kopla Sistemas'); handleCloseFlyoutImmediately(); }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center space-x-2 ${
                            selectedInbox === 'Kopla Sistemas' && activeTab === 'chats'
                              ? isDarkMode
                                ? 'bg-[#2c3138] text-white font-semibold'
                                : 'bg-[#e9edef] text-[#111b21] font-semibold'
                              : isDarkMode
                              ? 'text-[#aebac1] hover:text-white hover:bg-[#2c3138]/50'
                              : 'text-[#54656f] hover:text-[#111b21] hover:bg-[#e9edef]/50'
                          }`}
                        >
                          <MessengerIcon />
                          <span className="truncate">Kopla Sistemas</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => { handleInboxClick('Whatsapp comercial'); handleCloseFlyoutImmediately(); }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center space-x-2 ${
                            selectedInbox === 'Whatsapp comercial' && activeTab === 'chats'
                              ? isDarkMode
                                ? 'bg-[#2c3138] text-white font-semibold'
                                : 'bg-[#e9edef] text-[#111b21] font-semibold'
                              : isDarkMode
                              ? 'text-[#aebac1] hover:text-white hover:bg-[#2c3138]/50'
                              : 'text-[#54656f] hover:text-[#111b21] hover:bg-[#e9edef]/50'
                          }`}
                        >
                          <WhatsappIcon />
                          <span className="truncate">Whatsapp comercial</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => { handleInboxClick('Whatsapp Oficial(1420)'); handleCloseFlyoutImmediately(); }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center space-x-2 ${
                            selectedInbox === 'Whatsapp Oficial(1420)' && activeTab === 'chats'
                              ? isDarkMode
                                ? 'bg-[#2c3138] text-white font-semibold'
                                : 'bg-[#e9edef] text-[#111b21] font-semibold'
                              : isDarkMode
                              ? 'text-[#aebac1] hover:text-white hover:bg-[#2c3138]/50'
                              : 'text-[#54656f] hover:text-[#111b21] hover:bg-[#e9edef]/50'
                          }`}
                        >
                          <WhatsappOficialIcon />
                          <span className="truncate">Whatsapp Oficial(1420)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => { handleInboxClick('whatsapp Oficial(7221)'); handleCloseFlyoutImmediately(); }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center space-x-2 ${
                            selectedInbox === 'whatsapp Oficial(7221)' && activeTab === 'chats'
                              ? isDarkMode
                                ? 'bg-[#2c3138] text-white font-semibold'
                                : 'bg-[#e9edef] text-[#111b21] font-semibold'
                              : isDarkMode
                              ? 'text-[#aebac1] hover:text-white hover:bg-[#2c3138]/50'
                              : 'text-[#54656f] hover:text-[#111b21] hover:bg-[#e9edef]/50'
                          }`}
                        >
                          <WhatsappOficialIcon />
                          <span className="truncate">whatsapp Oficial(7221)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => { handleInboxClick('Whatsapp Oficial(9491)'); handleCloseFlyoutImmediately(); }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center space-x-2 ${
                            selectedInbox === 'Whatsapp Oficial(9491)' && activeTab === 'chats'
                              ? isDarkMode
                                ? 'bg-[#2c3138] text-white font-semibold'
                                : 'bg-[#e9edef] text-[#111b21] font-semibold'
                              : isDarkMode
                              ? 'text-[#aebac1] hover:text-white hover:bg-[#2c3138]/50'
                              : 'text-[#54656f] hover:text-[#111b21] hover:bg-[#e9edef]/50'
                          }`}
                        >
                          <WhatsappOficialIcon />
                          <span className="truncate">Whatsapp Oficial(9491)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => { handleInboxClick('Whatsapp suporte'); handleCloseFlyoutImmediately(); }}
                          className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center space-x-2 ${
                            selectedInbox === 'Whatsapp suporte' && activeTab === 'chats'
                              ? isDarkMode
                                ? 'bg-[#2c3138] text-white font-semibold'
                                : 'bg-[#e9edef] text-[#111b21] font-semibold'
                              : isDarkMode
                              ? 'text-[#aebac1] hover:text-white hover:bg-[#2c3138]/50'
                              : 'text-[#54656f] hover:text-[#111b21] hover:bg-[#e9edef]/50'
                          }`}
                        >
                          <WhatsappIcon />
                          <span className="truncate">Whatsapp suporte</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Sub-items list (Only in expanded mode & when open) */}
            {isExpanded && isConversasOpen && (
              <div className="pl-4 border-l border-white/10 my-1 space-y-0.5 ml-3.5">
                {/* 1. Todas as conversas */}
                <button
                  type="button"
                  onClick={() => handleInboxClick('todas')}
                  className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center justify-between ${
                    selectedInbox === 'todas' && activeTab === 'chats'
                      ? isDarkMode
                        ? 'bg-[#242525] text-white font-semibold shadow-xs'
                        : 'bg-[#e9edef] text-[#111b21] font-semibold shadow-xs'
                      : isDarkMode
                      ? 'text-[#aebac1] hover:text-white hover:bg-[#242525]/50'
                      : 'text-[#54656f] hover:text-[#111b21] hover:bg-[#e9edef]/50'
                  }`}
                >
                  <span className="truncate">Todas as conversas</span>
                </button>

                {/* Canais Header */}
                <div className="pt-2 pb-1 px-1 flex items-center space-x-2 text-[#8696a0] font-bold text-[11px] tracking-tight">
                  <BookOpen className="w-3.5 h-3.5 shrink-0 opacity-80" />
                  <span>Canais</span>
                </div>

                {/* List of Inboxes / Channels */}
                <div className="space-y-0.5">{renderInboxRows('expanded')}</div>
                {/* Legacy mock entries are disabled until removed in the visual cleanup pass. */}
                {false && <div className="space-y-0.5">
                  {/* grupo.kopla */}
                  <button
                    type="button"
                    onClick={() => handleInboxClick('grupo.kopla')}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center space-x-2 ${
                      selectedInbox === 'grupo.kopla' && activeTab === 'chats'
                        ? isDarkMode
                          ? 'bg-[#2a3942] text-white font-semibold shadow-xs'
                          : 'bg-[#e9edef] text-[#111b21] font-semibold shadow-xs'
                        : isDarkMode
                        ? 'text-[#aebac1] hover:text-white hover:bg-[#2a3942]/50'
                        : 'text-[#54656f] hover:text-[#111b21] hover:bg-[#e9edef]/50'
                    }`}
                  >
                    <InstagramIcon />
                    <span className="truncate">grupo.kopla</span>
                  </button>

                  {/* Kopla Sistemas */}
                  <button
                    type="button"
                    onClick={() => handleInboxClick('Kopla Sistemas')}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center space-x-2 ${
                      selectedInbox === 'Kopla Sistemas' && activeTab === 'chats'
                        ? isDarkMode
                          ? 'bg-[#2a3942] text-white font-semibold shadow-xs'
                          : 'bg-[#e9edef] text-[#111b21] font-semibold shadow-xs'
                        : isDarkMode
                        ? 'text-[#aebac1] hover:text-white hover:bg-[#2a3942]/50'
                        : 'text-[#54656f] hover:text-[#111b21] hover:bg-[#e9edef]/50'
                    }`}
                  >
                    <MessengerIcon />
                    <span className="truncate">Kopla Sistemas</span>
                  </button>

                  {/* Whatsapp comercial */}
                  <button
                    type="button"
                    onClick={() => handleInboxClick('Whatsapp comercial')}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center space-x-2 ${
                      selectedInbox === 'Whatsapp comercial' && activeTab === 'chats'
                        ? isDarkMode
                          ? 'bg-[#2a3942] text-white font-semibold shadow-xs'
                          : 'bg-[#e9edef] text-[#111b21] font-semibold shadow-xs'
                        : isDarkMode
                        ? 'text-[#aebac1] hover:text-white hover:bg-[#2a3942]/50'
                        : 'text-[#54656f] hover:text-[#111b21] hover:bg-[#e9edef]/50'
                    }`}
                  >
                    <WhatsappIcon />
                    <span className="truncate">Whatsapp comercial</span>
                  </button>

                  {/* Whatsapp Oficial(1420) */}
                  <button
                    type="button"
                    onClick={() => handleInboxClick('Whatsapp Oficial(1420)')}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center space-x-2 ${
                      selectedInbox === 'Whatsapp Oficial(1420)' && activeTab === 'chats'
                        ? isDarkMode
                          ? 'bg-[#2a3942] text-white font-semibold shadow-xs'
                          : 'bg-[#e9edef] text-[#111b21] font-semibold shadow-xs'
                        : isDarkMode
                        ? 'text-[#aebac1] hover:text-white hover:bg-[#2a3942]/50'
                        : 'text-[#54656f] hover:text-[#111b21] hover:bg-[#e9edef]/50'
                    }`}
                  >
                    <WhatsappOficialIcon />
                    <span className="truncate">Whatsapp Oficial(1420)</span>
                  </button>

                  {/* whatsapp Oficial(7221) */}
                  <button
                    type="button"
                    onClick={() => handleInboxClick('whatsapp Oficial(7221)')}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center space-x-2 ${
                      selectedInbox === 'whatsapp Oficial(7221)' && activeTab === 'chats'
                        ? isDarkMode
                          ? 'bg-[#2a3942] text-white font-semibold shadow-xs'
                          : 'bg-[#e9edef] text-[#111b21] font-semibold shadow-xs'
                        : isDarkMode
                        ? 'text-[#aebac1] hover:text-white hover:bg-[#2a3942]/50'
                        : 'text-[#54656f] hover:text-[#111b21] hover:bg-[#e9edef]/50'
                    }`}
                  >
                    <WhatsappOficialIcon />
                    <span className="truncate">whatsapp Oficial(7221)</span>
                  </button>

                  {/* Whatsapp Oficial(9491) */}
                  <button
                    type="button"
                    onClick={() => handleInboxClick('Whatsapp Oficial(9491)')}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center space-x-2 ${
                      selectedInbox === 'Whatsapp Oficial(9491)' && activeTab === 'chats'
                        ? isDarkMode
                          ? 'bg-[#2a3942] text-white font-semibold shadow-xs'
                          : 'bg-[#e9edef] text-[#111b21] font-semibold shadow-xs'
                        : isDarkMode
                        ? 'text-[#aebac1] hover:text-white hover:bg-[#2a3942]/50'
                        : 'text-[#54656f] hover:text-[#111b21] hover:bg-[#e9edef]/50'
                    }`}
                  >
                    <WhatsappOficialIcon />
                    <span className="truncate">Whatsapp Oficial(9491)</span>
                  </button>

                  {/* Whatsapp suporte */}
                  <button
                    type="button"
                    onClick={() => handleInboxClick('Whatsapp suporte')}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center space-x-2 ${
                      selectedInbox === 'Whatsapp suporte' && activeTab === 'chats'
                        ? isDarkMode
                          ? 'bg-[#2a3942] text-white font-semibold shadow-xs'
                          : 'bg-[#e9edef] text-[#111b21] font-semibold shadow-xs'
                        : isDarkMode
                        ? 'text-[#aebac1] hover:text-white hover:bg-[#2a3942]/50'
                        : 'text-[#54656f] hover:text-[#111b21] hover:bg-[#e9edef]/50'
                    }`}
                  >
                    <WhatsappIcon />
                    <span className="truncate">Whatsapp suporte</span>
                  </button>
                </div>}
              </div>
            )}

            {/* When Conversas accordion is collapsed, show the single selected inbox item pill */}
            {isExpanded && !isConversasOpen && (
              <div className="pl-4 border-l border-white/10 my-1 ml-3.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsConversasOpen(true);
                    onTabChange('chats');
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center space-x-2.5 ${
                    isDarkMode
                      ? 'bg-[#151717] text-white shadow-xs border border-white/5 hover:bg-[#242525]'
                      : 'bg-[#e9edef] text-[#111b21] shadow-xs border border-black/5 hover:bg-[#d1d7db]'
                  }`}
                >
                  {selectedInbox !== 'todas' && getChannelIcon(selectedInbox)}
                  <span className="truncate font-semibold">
                    {selectedInbox === 'todas'
                      ? 'Todas as conversas'
                      : selectedInbox}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* 3. Apps */}
          <button
            onClick={() => onTabChange('media')}
            title="Apps"
            className={`w-full flex items-center px-2.5 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'media'
                ? isDarkMode
                  ? 'bg-[#242525] text-[#00a884]'
                  : 'bg-[#e9edef] text-[#00a884]'
                : isDarkMode
                ? 'text-[#aebac1] hover:bg-[#242525] hover:text-white'
                : 'text-[#54656f] hover:bg-[#e9edef] hover:text-[#111b21]'
            }`}
          >
            <Folder className="w-4.5 h-4.5 shrink-0" />
            {isExpanded && <span className="ml-3 truncate">Apps</span>}
          </button>

          {/* 4. Contatos */}
          <button
            onClick={() => onTabChange('communities')}
            title="Contatos"
            className={`w-full flex items-center px-2.5 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'communities'
                ? isDarkMode
                  ? 'bg-[#242525] text-[#00a884]'
                  : 'bg-[#e9edef] text-[#00a884]'
                : isDarkMode
                ? 'text-[#aebac1] hover:bg-[#242525] hover:text-white'
                : 'text-[#54656f] hover:bg-[#e9edef] hover:text-[#111b21]'
            }`}
          >
            <BookUser className="w-4.5 h-4.5 shrink-0" />
            {isExpanded && <span className="ml-3 truncate">Contatos</span>}
          </button>

          {/* 5. Relatórios */}
          <button
            onClick={() => onTabChange('status')}
            title="Relatórios"
            className={`w-full flex items-center px-2.5 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'status'
                ? isDarkMode
                  ? 'bg-[#242525] text-[#00a884]'
                  : 'bg-[#e9edef] text-[#00a884]'
                : isDarkMode
                ? 'text-[#aebac1] hover:bg-[#242525] hover:text-white'
                : 'text-[#54656f] hover:bg-[#e9edef] hover:text-[#111b21]'
            }`}
          >
            <BarChart2 className="w-4.5 h-4.5 shrink-0" />
            {isExpanded && <span className="ml-3 truncate">Relatórios</span>}
          </button>

          {/* 6. Campanhas */}
          <button
            onClick={() => onTabChange('calls')}
            title="Campanhas"
            className={`w-full flex items-center px-2.5 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
              activeTab === 'calls'
                ? isDarkMode
                  ? 'bg-[#242525] text-[#00a884]'
                  : 'bg-[#e9edef] text-[#00a884]'
                : isDarkMode
                ? 'text-[#aebac1] hover:bg-[#242525] hover:text-white'
                : 'text-[#54656f] hover:bg-[#e9edef] hover:text-[#111b21]'
            }`}
          >
            <Megaphone className="w-4.5 h-4.5 shrink-0" />
            {isExpanded && <span className="ml-3 truncate">Campanhas</span>}
          </button>

          {/* 7. Central de Ajuda */}
          <button
            onClick={() => onTabChange('settings')}
            title="Central de Ajuda"
            className={`w-full flex items-center px-2.5 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
              isDarkMode
                ? 'text-[#aebac1] hover:bg-[#242525] hover:text-white'
                : 'text-[#54656f] hover:bg-[#e9edef] hover:text-[#111b21]'
            }`}
          >
            <HelpCircle className="w-4.5 h-4.5 shrink-0" />
            {isExpanded && <span className="ml-3 truncate">Central de Ajuda</span>}
          </button>

          {/* 8. Configurações Accordion Section */}
          <div
            className="relative"
            onMouseEnter={() => !isExpanded && handleMouseEnterFlyout('settings')}
            onMouseLeave={() => !isExpanded && handleMouseLeaveFlyout()}
          >
            <button
              onClick={() => {
                onTabChange('settings');
                if (isExpanded) {
                  setIsSettingsOpen((prev) => !prev);
                } else {
                  if (hoveredFlyout === 'settings') {
                    handleCloseFlyoutImmediately();
                  } else {
                    handleMouseEnterFlyout('settings');
                  }
                }
              }}
              title={hoveredFlyout === 'settings' ? undefined : "Configurações"}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'settings'
                  ? isDarkMode
                    ? 'text-white bg-[#242525]/40'
                    : 'text-[#111b21] bg-[#e9edef]/40'
                  : isDarkMode
                  ? 'text-[#aebac1] hover:bg-[#242525] hover:text-white'
                  : 'text-[#54656f] hover:bg-[#e9edef] hover:text-[#111b21]'
              }`}
            >
              <div className="flex items-center min-w-0">
                <Settings className="w-4.5 h-4.5 shrink-0" />
                {isExpanded && <span className="ml-3 truncate font-bold text-xs">Configurações</span>}
              </div>
              {isExpanded && (
                <ChevronUp
                  className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                    isSettingsOpen ? '' : 'rotate-180'
                  } opacity-70`}
                />
              )}
            </button>

            {/* Hover Flyout Popover for Settings when Collapsed */}
            {!isExpanded && hoveredFlyout === 'settings' && (
              <div
                className={`fixed left-[60px] top-3 bottom-3 my-auto h-fit max-h-[calc(100vh-24px)] w-64 rounded-2xl shadow-2xl border z-[999] p-3 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 ${
                  isDarkMode
                    ? 'bg-[#222529] border-[#32363e] text-white shadow-black/90'
                    : 'bg-white border-[#d1d7db] text-[#111b21] shadow-2xl'
                }`}
                onMouseEnter={() => handleMouseEnterFlyout('settings')}
                onMouseLeave={() => handleMouseLeaveFlyout()}
              >
                <div className="px-1 pb-2 text-[11px] font-extrabold text-[#8696a0] tracking-wider uppercase border-b border-white/10 mb-2 flex items-center justify-between shrink-0">
                  <span>CONFIGURAÇÕES</span>
                  <Settings className="w-3.5 h-3.5 text-[#00a884]" />
                </div>

                <div className="space-y-0.5 overflow-y-auto pr-1 flex-1 min-h-0">
                  {settingsMenuItems.map((item) => {
                    const isSelected = activeTab === 'settings' && selectedSettingsTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onTabChange('settings');
                          onSelectSettingsTab?.(item.id);
                          handleCloseFlyoutImmediately();
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center space-x-2.5 ${
                          isSelected
                            ? isDarkMode
                              ? 'bg-[#2c3138] text-white font-semibold'
                              : 'bg-[#e9edef] text-[#111b21] font-semibold'
                            : isDarkMode
                            ? 'text-[#aebac1] hover:text-white hover:bg-[#2c3138]/50'
                            : 'text-[#54656f] hover:text-[#111b21] hover:bg-[#e9edef]/50'
                        }`}
                      >
                        <span className={isSelected ? 'text-[#00a884]' : 'text-[#8696a0]'}>
                          {item.icon}
                        </span>
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sub-items list (Only in expanded mode & when open) */}
            {isExpanded && isSettingsOpen && (
              <div className="pl-3 border-l border-white/10 my-1 space-y-0.5 ml-3.5">
                {settingsMenuItems.map((item) => {
                  const isSelected = activeTab === 'settings' && selectedSettingsTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        onTabChange('settings');
                        onSelectSettingsTab?.(item.id);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center space-x-2.5 ${
                        isSelected
                          ? isDarkMode
                            ? 'bg-[#242525] text-white font-semibold shadow-xs'
                            : 'bg-[#e9edef] text-[#111b21] font-semibold shadow-xs'
                          : isDarkMode
                          ? 'text-[#aebac1] hover:text-white hover:bg-[#242525]/50'
                          : 'text-[#54656f] hover:text-[#111b21] hover:bg-[#e9edef]/50'
                      }`}
                    >
                      <span className={isSelected ? 'text-[#00a884]' : 'text-[#8696a0]'}>
                        {item.icon}
                      </span>
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Bottom User Profile Section */}
        <div className="p-2 border-t border-white/5">
          <button
            type="button"
            onClick={() => setShowUserMenu((prev) => !prev)}
            className={`w-full flex items-center p-2 rounded-xl transition-colors cursor-pointer ${
              isDarkMode
                ? 'hover:bg-[#2a3942] text-white'
                : 'hover:bg-[#e9edef] text-[#111b21]'
            }`}
          >
            <div className="relative shrink-0">
              <div className="w-8 h-8 rounded-full bg-[#2563eb] text-white font-semibold flex items-center justify-center text-sm shadow-xs">
                {userAvatar ? <img src={userAvatar} alt="" className="h-full w-full rounded-full object-cover" /> : userName.slice(0, 1).toUpperCase()}
              </div>
              <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ${getStatusBadge().color} ${isDarkMode ? 'ring-[#182228]' : 'ring-[#f0f2f5]'}`} />
            </div>

            {isExpanded && (
              <div className="ml-3 text-left min-w-0 flex-1">
                <div className="text-xs font-bold truncate leading-tight">{userName}</div>
                <div className="text-[11px] text-[#8696a0] truncate leading-tight">
                  {userEmail}
                </div>
              </div>
            )}
          </button>
        </div>
      </div>

      {/* User Profile Menu Popup (Modal matching Image 2) */}
      {showUserMenu && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowUserMenu(false)}
          />
          <div
            className={`absolute bottom-4 left-full ml-3 z-50 w-72 rounded-2xl border shadow-2xl p-3 animate-in fade-in zoom-in-95 duration-150 ${
              isDarkMode
                ? 'bg-[#182228] border-[#2a3942] text-[#e9edef]'
                : 'bg-white border-[#d1d7db] text-[#111b21]'
            }`}
          >
            {/* 1. Disponibilidade Row */}
            <div className="flex items-center justify-between pb-3 relative">
              <span className="text-xs font-medium">Disponibilidade</span>

              {/* Status Select Badge */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowAvailabilityDropdown((prev) => !prev)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-medium flex items-center space-x-2 border transition-colors cursor-pointer ${
                    isDarkMode
                      ? 'bg-[#202c33] border-[#2a3942] hover:bg-[#2a3942]'
                      : 'bg-[#f0f2f5] border-[#d1d7db] hover:bg-[#e9edef]'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${getStatusBadge().color}`} />
                  <span className="capitalize">{getStatusBadge().label}</span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                </button>

                {/* Status Dropdown Menu */}
                {showAvailabilityDropdown && (
                  <div
                    className={`absolute right-0 top-full mt-1 z-50 w-32 rounded-xl border shadow-xl p-1 ${
                      isDarkMode
                        ? 'bg-[#202c33] border-[#2a3942]'
                        : 'bg-white border-[#d1d7db]'
                    }`}
                  >
                    {(['online', 'ocupado', 'ausente', 'offline'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => {
                          setAvailability(st);
                          setShowAvailabilityDropdown(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                          availability === st
                            ? isDarkMode
                              ? 'bg-[#2a3942] text-white'
                              : 'bg-[#e9edef] text-[#111b21]'
                            : isDarkMode
                            ? 'hover:bg-[#2a3942]/50 text-[#aebac1]'
                            : 'hover:bg-[#e9edef]/50 text-[#54656f]'
                        }`}
                      >
                        <span className="capitalize">{st}</span>
                        {availability === st && <Check className="w-3.5 h-3.5 text-[#00a884]" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 2. Marcar offline automaticamente */}
            <div className="flex items-center justify-between py-2 border-b border-white/10 mb-2">
              <div className="flex items-center space-x-1.5 text-xs font-medium">
                <span>Marcar offline automaticamente</span>
                <Info className="w-3.5 h-3.5 text-[#8696a0] shrink-0" title="Informação de status" />
              </div>

              {/* Interactive Toggle Switch */}
              <button
                type="button"
                onClick={() => setAutoOffline((prev) => !prev)}
                className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer ${
                  autoOffline ? 'bg-blue-600' : 'bg-gray-600'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    autoOffline ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Menu Options List */}
            <div className="space-y-0.5">
              {/* Atalhos do teclado */}
              <button
                type="button"
                onClick={() => { setShowUserMenu(false); onLogout?.(); }}
                className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-medium flex items-center space-x-3 transition-colors cursor-pointer ${
                  isDarkMode
                    ? 'hover:bg-[#2a3942] text-[#e9edef]'
                    : 'hover:bg-[#f0f2f5] text-[#111b21]'
                }`}
              >
                <Keyboard className="w-4 h-4 text-[#8696a0] shrink-0" />
                <span>Atalhos do teclado</span>
              </button>

              {/* Configurações do Perfil */}
              <button
                type="button"
                onClick={() => {
                  // Use the settings route directly so this action also works
                  // when the user is already on another settings subpage.
                  onSelectSettingsTab?.('perfil');
                  setShowUserMenu(false);
                }}
                className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-medium flex items-center space-x-3 transition-colors cursor-pointer ${
                  isDarkMode
                    ? 'hover:bg-[#2a3942] text-[#e9edef]'
                    : 'hover:bg-[#f0f2f5] text-[#111b21]'
                }`}
              >
                <User className="w-4 h-4 text-[#8696a0] shrink-0" />
                <span>Configurações do Perfil</span>
              </button>

              {/* Alterar Tema */}
              <button
                type="button"
                onClick={() => {
                  onToggleDarkMode();
                  setShowUserMenu(false);
                }}
                className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-medium flex items-center space-x-3 transition-colors cursor-pointer ${
                  isDarkMode
                    ? 'hover:bg-[#2a3942] text-[#e9edef]'
                    : 'hover:bg-[#f0f2f5] text-[#111b21]'
                }`}
              >
                <Palette className="w-4 h-4 text-[#8696a0] shrink-0" />
                <span>Alterar Tema ({isDarkMode ? 'Escuro' : 'Claro'})</span>
              </button>

              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenSuperAdmin?.();
                    setShowUserMenu(false);
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-medium flex items-center space-x-3 transition-colors cursor-pointer ${
                    isDarkMode
                      ? 'hover:bg-[#2a3942] text-[#e9edef]'
                      : 'hover:bg-[#f0f2f5] text-[#111b21]'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 text-[#8696a0] shrink-0" />
                  <span>Console de Super Admin</span>
                </button>
              )}

              {/* Encerrar sessão */}
              <button
                type="button"
                onClick={() => setShowUserMenu(false)}
                className={`w-full text-left px-2.5 py-2 rounded-xl text-xs font-medium flex items-center space-x-3 text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer`}
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Encerrar sessão</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
