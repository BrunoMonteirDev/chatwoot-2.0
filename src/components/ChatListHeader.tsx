import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  MoreVertical,
  Search,
  X,
  PanelLeftClose,
  UserPlus,
  MessageSquarePlus,
  Users,
  SlidersHorizontal,
  ArrowUpDown,
  Filter,
} from 'lucide-react';
import {
  FilterCategory,
  ChatStatusFilter,
  ChatSortOption,
  ChatFilterRule,
} from '../types';
import {
  ChatFilterModal,
  ChatSortPopover,
} from './ChatFilterSortModal';

interface Props {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeFilter: FilterCategory;
  onFilterChange: (filter: FilterCategory) => void;
  selectedInbox?: string;
  onResetInbox?: () => void;
  onNewChatClick: () => void;
  onNewContactClick?: () => void;
  onNewGroupClick?: () => void;
  onMenuClick: () => void;
  isDarkMode?: boolean;
  unreadCountTotal?: number;
  favoritesCountTotal?: number;
  onToggleSidebar?: () => void;
  // New Filter & Sort Props
  selectedStatus?: ChatStatusFilter;
  onStatusChange?: (status: ChatStatusFilter) => void;
  selectedSort?: ChatSortOption;
  onSortChange?: (sort: ChatSortOption) => void;
  filterRules?: ChatFilterRule[];
  onFilterRulesChange?: (rules: ChatFilterRule[]) => void;
}

export const ChatListHeader: React.FC<Props> = ({
  searchQuery,
  onSearchChange,
  activeFilter,
  onFilterChange,
  selectedInbox = 'todas',
  onResetInbox,
  onNewChatClick,
  onNewContactClick,
  onNewGroupClick,
  onMenuClick,
  isDarkMode = false,
  unreadCountTotal = 0,
  favoritesCountTotal = 0,
  onToggleSidebar,
  selectedStatus = 'todas',
  onStatusChange = (_s: ChatStatusFilter) => {},
  selectedSort = 'last_activity_desc',
  onSortChange = (_s: ChatSortOption) => {},
  filterRules = [],
  onFilterRulesChange = (_r: ChatFilterRule[]) => {},
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getHeaderTitle = (key: string) => {
    switch (key) {
      case 'todas':
        return 'Conversas';
      case 'mencoes':
        return 'Menções';
      case 'participantes':
        return 'Participantes';
      case 'nao_atendidas':
        return 'Não atendidas';
      default:
        return key;
    }
  };

  const handleOptionClick = (action: () => void) => {
    setIsMenuOpen(false);
    action();
  };

  const activeRulesCount = filterRules.length;
  const isStatusCustom = selectedStatus !== 'todas';
  const isSortCustom = selectedSort !== 'last_activity_desc';

  return (
    <div
      className={`border-b flex flex-col flex-shrink-0 select-none transition-colors ${
        isDarkMode
          ? 'bg-[#151717] border-[#1e1f1f]'
          : 'bg-white border-[#d1d7db]'
      }`}
    >
      {/* Top Header Bar */}
      <div className="h-14 px-4 flex items-center justify-between">
        <div className="flex items-center space-x-2 min-w-0">
          <h1
            className={`text-xl font-bold tracking-tight truncate ${
              isDarkMode ? 'text-[#e9edef]' : 'text-[#111b21]'
            }`}
          >
            {getHeaderTitle(selectedInbox)}
          </h1>

          {/* Quick Filter & Sort Buttons directly next to Conversas Title */}
          <div className="flex items-center space-x-1 shrink-0 ml-1">
            {/* Filter Combination Button */}
            <button
              onClick={() => setIsFilterModalOpen(true)}
              title="Filtrar conversas (combinações)"
              className={`p-1.5 rounded-lg transition-all relative cursor-pointer ${
                activeRulesCount > 0
                  ? 'bg-[#2563eb] text-white shadow-xs'
                  : isDarkMode
                  ? 'text-[#aebac1] hover:bg-[#1e1f1f] active:bg-[#242525]'
                  : 'text-[#54656f] hover:bg-[#f0f2f5] active:bg-[#e9edef]'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              {activeRulesCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 text-black text-[9px] font-extrabold rounded-full flex items-center justify-center">
                  {activeRulesCount}
                </span>
              )}
            </button>

            {/* Sort & Status Quick Popover Button */}
            <div className="relative" ref={sortRef}>
              <button
                onClick={() => setIsSortOpen((prev) => !prev)}
                title="Status e Ordenação"
                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                  isStatusCustom || isSortCustom
                    ? 'bg-[#00a884] text-white shadow-xs'
                    : isDarkMode
                    ? 'text-[#aebac1] hover:bg-[#1e1f1f] active:bg-[#242525]'
                    : 'text-[#54656f] hover:bg-[#f0f2f5] active:bg-[#e9edef]'
                }`}
              >
                <ArrowUpDown className="w-4 h-4" />
              </button>

              <ChatSortPopover
                isOpen={isSortOpen}
                onClose={() => setIsSortOpen(false)}
                status={selectedStatus}
                onStatusChange={onStatusChange}
                sort={selectedSort}
                onSortChange={onSortChange}
                isDarkMode={isDarkMode}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-1 relative">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              title="Recolher lista de conversas"
              className={`hidden md:flex w-10 h-10 items-center justify-center rounded-full transition-colors cursor-pointer ${
                isDarkMode
                  ? 'text-[#aebac1] hover:bg-[#1e1f1f] active:bg-[#242525]'
                  : 'text-[#54656f] hover:bg-[#f0f2f5] active:bg-[#e9edef]'
              }`}
            >
              <PanelLeftClose className="w-5 h-5" />
            </button>
          )}

          {/* Plus Button with Dropdown Menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setIsMenuOpen((prev) => !prev)}
              title="Nova opção"
              className={`w-10 h-10 flex items-center justify-center rounded-full transition-all cursor-pointer ${
                isMenuOpen
                  ? isDarkMode
                    ? 'bg-[#242525] text-[#00a884]'
                    : 'bg-[#e9edef] text-[#00a884]'
                  : isDarkMode
                  ? 'text-[#aebac1] hover:bg-[#1e1f1f] active:bg-[#242525]'
                  : 'text-[#54656f] hover:bg-[#f0f2f5] active:bg-[#e9edef]'
              }`}
            >
              <Plus className={`w-5 h-5 transition-transform duration-200 ${isMenuOpen ? 'rotate-45 text-[#00a884]' : ''}`} />
            </button>

            {/* Dropdown Options Menu */}
            {isMenuOpen && (
              <div
                className={`absolute right-0 top-full mt-2 w-56 rounded-2xl border shadow-2xl py-2 z-50 animate-fade-in ${
                  isDarkMode
                    ? 'bg-[#1f2c34] border-[#2a3942] text-white'
                    : 'bg-white border-gray-200 text-[#111b21]'
                }`}
              >
                {/* 1. Criar um contato */}
                <button
                  onClick={() => handleOptionClick(onNewContactClick || onNewChatClick)}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 text-xs font-semibold text-left transition-colors cursor-pointer ${
                    isDarkMode ? 'hover:bg-[#202c33]' : 'hover:bg-gray-100'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-[#00a884]/15 text-[#00a884] flex items-center justify-center shrink-0">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold">Criar um contato</p>
                    <p className="text-[10px] text-[#8696a0] font-normal">Cadastrar novo contato</p>
                  </div>
                </button>

                {/* 2. Criar uma conversa */}
                <button
                  onClick={() => handleOptionClick(onNewChatClick)}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 text-xs font-semibold text-left transition-colors cursor-pointer ${
                    isDarkMode ? 'hover:bg-[#202c33]' : 'hover:bg-gray-100'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-blue-500/15 text-blue-500 flex items-center justify-center shrink-0">
                    <MessageSquarePlus className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold">Criar uma conversa</p>
                    <p className="text-[10px] text-[#8696a0] font-normal">Iniciar novo atendimento</p>
                  </div>
                </button>

                {/* 3. Criar um grupo */}
                <button
                  onClick={() => handleOptionClick(onNewGroupClick || onNewChatClick)}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 text-xs font-semibold text-left transition-colors cursor-pointer ${
                    isDarkMode ? 'hover:bg-[#202c33]' : 'hover:bg-gray-100'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-purple-500/15 text-purple-500 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold">Criar um grupo</p>
                    <p className="text-[10px] text-[#8696a0] font-normal">Novo grupo de mensagens</p>
                  </div>
                </button>
              </div>
            )}
          </div>

          <button
            onClick={onMenuClick}
            title="Mais opções"
            className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${
              isDarkMode
                ? 'text-[#aebac1] hover:bg-[#1e1f1f] active:bg-[#242525]'
                : 'text-[#54656f] hover:bg-[#f0f2f5] active:bg-[#e9edef]'
            }`}
          >
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Filter Builder Modal */}
      <ChatFilterModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        rules={filterRules}
        onApplyRules={onFilterRulesChange}
        isDarkMode={isDarkMode}
      />

      {/* Active Filters Pill Bar Indicator */}
      {(activeRulesCount > 0 || isStatusCustom) && (
        <div className="px-3 pb-1.5 pt-0 flex items-center flex-wrap gap-1 text-[11px]">
          <span className="text-[#8696a0] font-semibold flex items-center">
            <Filter className="w-3 h-3 mr-1 text-[#2563eb]" /> Filtros:
          </span>
          {isStatusCustom && (
            <span className="bg-[#00a884]/20 text-[#00a884] px-2 py-0.5 rounded-full font-bold flex items-center">
              Status: {selectedStatus}
            </span>
          )}
          {activeRulesCount > 0 && (
            <span className="bg-[#2563eb]/20 text-[#2563eb] px-2 py-0.5 rounded-full font-bold">
              {activeRulesCount} regra(s) ativa(s)
            </span>
          )}
          <button
            onClick={() => {
              onStatusChange('todas');
              onFilterRulesChange([]);
            }}
            className="text-rose-500 hover:underline font-bold text-[10px] ml-auto cursor-pointer"
          >
            Limpar tudo
          </button>
        </div>
      )}

      {/* Search Input Container */}
      <div className="px-3 pb-2 pt-0">
        <div
          className={`relative flex items-center rounded-lg h-9 px-3 border border-transparent focus-within:border-[#00a884]/60 transition-colors ${
            isDarkMode ? 'bg-[#1e1f1f]' : 'bg-[#f0f2f5]'
          }`}
        >
          <Search
            className={`w-4 h-4 mr-3 flex-shrink-0 ${
              isDarkMode ? 'text-[#8696a0]' : 'text-[#54656f]'
            }`}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Pesquisar ou começar uma nova conversa"
            className={`w-full bg-transparent text-sm outline-none ${
              isDarkMode
                ? 'text-[#e9edef] placeholder-[#8696a0]'
                : 'text-[#111b21] placeholder-[#667781]'
            }`}
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className={`p-1 ${
                isDarkMode
                  ? 'text-[#8696a0] hover:text-white'
                  : 'text-[#54656f] hover:text-[#111b21]'
              }`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-3 pb-3 pt-1 flex items-center space-x-1.5 overflow-x-auto no-scrollbar text-xs">
        <button
          onClick={() => onFilterChange('minhas')}
          className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap font-semibold cursor-pointer ${
            activeFilter === 'minhas'
              ? isDarkMode
                ? 'bg-[#242525] text-[#00a884] border border-[#00a884]/30 shadow-xs'
                : 'bg-[#e9edef] text-[#111b21] shadow-xs'
              : isDarkMode
              ? 'bg-[#1e1f1f] text-[#8696a0] hover:bg-[#242525] hover:text-[#e9edef]'
              : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef] hover:text-[#111b21]'
          }`}
        >
          Minhas
        </button>

        <button
          onClick={() => onFilterChange('nao_atribuidas')}
          className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap font-semibold cursor-pointer ${
            activeFilter === 'nao_atribuidas'
              ? isDarkMode
                ? 'bg-[#242525] text-[#00a884] border border-[#00a884]/30 shadow-xs'
                : 'bg-[#e9edef] text-[#111b21] shadow-xs'
              : isDarkMode
              ? 'bg-[#1e1f1f] text-[#8696a0] hover:bg-[#242525] hover:text-[#e9edef]'
              : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef] hover:text-[#111b21]'
          }`}
        >
          Não atribuídas
        </button>

        <button
          onClick={() => onFilterChange('todos')}
          className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap font-semibold cursor-pointer ${
            activeFilter === 'todos'
              ? isDarkMode
                ? 'bg-[#242525] text-[#00a884] border border-[#00a884]/30 shadow-xs'
                : 'bg-[#e9edef] text-[#111b21] shadow-xs'
              : isDarkMode
              ? 'bg-[#1e1f1f] text-[#8696a0] hover:bg-[#242525] hover:text-[#e9edef]'
              : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef] hover:text-[#111b21]'
          }`}
        >
          Todos
        </button>
      </div>
    </div>
  );
};

