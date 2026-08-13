import React from 'react';
import {
  MessageSquare,
  BarChart2,
  Megaphone,
  BookUser,
  Settings,
} from 'lucide-react';
import { NavTab } from '../types';

interface FloatingMobileNavProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  isDarkMode?: boolean;
  unreadCountTotal?: number;
}

export const FloatingMobileNav: React.FC<FloatingMobileNavProps> = ({
  activeTab,
  onTabChange,
  isDarkMode = true,
  unreadCountTotal = 0,
}) => {
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
      id: 'status' as NavTab,
      label: 'Relatórios',
      icon: BarChart2,
    },
    {
      id: 'calls' as NavTab,
      label: 'Campanhas',
      icon: Megaphone,
    },
    {
      id: 'settings' as NavTab,
      label: 'Ajustes',
      icon: Settings,
    },
  ];

  return (
    <div className="fixed bottom-3 left-3 right-3 z-40 md:hidden flex justify-center pointer-events-none">
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
