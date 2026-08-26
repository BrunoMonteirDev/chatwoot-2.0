import React, { useEffect, useRef, useState } from 'react';
import {
  MessageSquare,
  BookUser,
  Settings,
  StickyNote,
  Plus,
  UserPlus,
  MessageSquarePlus,
  Users,
} from 'lucide-react';
import { NavTab } from '../types';

interface FloatingMobileNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  isDarkMode?: boolean;
  unreadCountTotal?: number;
  onNewConversation?: () => void;
  onNewContact?: () => void;
  onNewGroup?: () => void;
}

export const FloatingMobileNav: React.FC<FloatingMobileNavProps> = ({
  activeTab,
  onTabChange,
  isDarkMode = true,
  unreadCountTotal = 0,
  onNewConversation,
  onNewContact,
  onNewGroup,
}) => {
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const createMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (createMenuRef.current && !createMenuRef.current.contains(event.target as Node)) setIsCreateMenuOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  const runCreateAction = (action?: () => void) => {
    setIsCreateMenuOpen(false);
    action?.();
  };
  const tabs = [
    {
      id: 'chats' as NavTab,
      label: 'Conversas',
      icon: MessageSquare,
      badge: unreadCountTotal > 0 ? unreadCountTotal : null,
    },
    {
      id: 'communities' as NavTab,
      label: 'Contatos',
      icon: BookUser,
    },
    {
      id: 'tools' as NavTab,
      label: 'Notas',
      icon: StickyNote,
    },
    {
      id: 'settings' as NavTab,
      label: 'Ajustes',
      icon: Settings,
    },
  ];

  return (
    <div className="fixed bottom-3 left-3 right-3 z-40 md:hidden flex justify-center pointer-events-none">
      {activeTab === 'chats' && (
        <div ref={createMenuRef} className="pointer-events-auto absolute bottom-[84px] right-4 z-50">
          {isCreateMenuOpen && (
            <div className={`absolute bottom-full right-0 mb-3 w-56 overflow-hidden rounded-2xl border py-1.5 shadow-2xl ${
              isDarkMode ? 'border-[#2a3942] bg-[#1f2c34] text-white' : 'border-gray-200 bg-white text-[#111b21]'
            }`}>
              <button type="button" onClick={() => runCreateAction(onNewConversation)} className={`flex w-full items-center gap-3 px-4 py-3 text-left text-xs font-semibold ${isDarkMode ? 'hover:bg-[#202c33]' : 'hover:bg-gray-100'}`}>
                <MessageSquarePlus className="h-4 w-4 text-[#00a884]" /> Criar conversa
              </button>
              <button type="button" onClick={() => runCreateAction(onNewContact)} className={`flex w-full items-center gap-3 px-4 py-3 text-left text-xs font-semibold ${isDarkMode ? 'hover:bg-[#202c33]' : 'hover:bg-gray-100'}`}>
                <UserPlus className="h-4 w-4 text-[#00a884]" /> Criar contato
              </button>
              <button type="button" onClick={() => runCreateAction(onNewGroup)} className={`flex w-full items-center gap-3 px-4 py-3 text-left text-xs font-semibold ${isDarkMode ? 'hover:bg-[#202c33]' : 'hover:bg-gray-100'}`}>
                <Users className="h-4 w-4 text-[#00a884]" /> Criar grupo
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setIsCreateMenuOpen((open) => !open)}
            aria-label="Criar conversa, contato ou grupo"
            className={`flex h-14 w-14 items-center justify-center rounded-full bg-[#00a884] text-white shadow-[0_8px_22px_rgba(0,168,132,0.35)] ring-4 transition-all active:scale-95 ${
              isCreateMenuOpen
                ? 'rotate-45 ring-[#00a884]/15'
                : isDarkMode
                  ? 'ring-[#151717] hover:bg-[#008f72]'
                  : 'ring-white hover:bg-[#008f72]'
            }`}
          >
            <Plus className="h-7 w-7 stroke-[2.75]" />
          </button>
        </div>
      )}
      <nav
        className={`pointer-events-auto w-full max-w-md rounded-2xl sm:rounded-3xl p-1.5 flex items-center justify-between border shadow-2xl transition-all duration-200 backdrop-blur-xl ${
          isDarkMode
            ? 'bg-[#1e1f1f]/95 border-[#2a3238]/80 text-[#aebac1]'
            : 'bg-white/95 border-gray-200 text-[#54656f]'
        }`}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`flex-1 relative flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all cursor-pointer ${
                isActive
                  ? isDarkMode
                    ? 'bg-[#242525] text-[#00a884]'
                    : 'bg-[#e9edef] text-[#00a884]'
                  : isDarkMode
                  ? 'text-[#8696a0] hover:text-[#e9edef]'
                  : 'text-[#54656f] hover:text-[#111b21]'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    isActive ? 'scale-110 text-[#00a884]' : ''
                  }`}
                />
                {tab.badge ? (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 bg-[#00a884] text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                    {tab.badge}
                  </span>
                ) : null}
              </div>
              <span
                className={`text-[11px] mt-1 font-medium leading-none truncate max-w-full ${
                  isActive ? 'font-bold text-[#00a884]' : ''
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
