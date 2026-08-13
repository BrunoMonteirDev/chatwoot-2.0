import React from 'react';
import { Users } from 'lucide-react';

export interface GroupMember {
  id: string;
  name: string;
  displayName?: string;
  avatar?: string;
}

export const defaultGroupMembers: GroupMember[] = [
  {
    id: 'm-ricardo',
    name: 'Ricardo Freitas',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
  },
  {
    id: 'm-diego',
    name: '~ Diego Jacob',
    displayName: 'Diego Jacob',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
  },
  {
    id: 'm-vinicius',
    name: 'Vinicius Prado Salgado',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&q=80',
  },
  {
    id: 'm-allan',
    name: 'Allan Silva',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=150&q=80',
  },
  {
    id: 'm-frune',
    name: 'Frunê',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
  },
  {
    id: 'm-tiago',
    name: 'Tiago Carvalho',
    avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=150&q=80',
  },
  {
    id: 'm-ferlon',
    name: 'Férlon Piran',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=150&q=80',
  },
];

interface MentionsPopupProps {
  isOpen: boolean;
  onClose: () => void;
  members: GroupMember[];
  filterQuery: string;
  onSelectMember: (mentionText: string) => void;
  isDarkMode?: boolean;
}

export const MentionsPopup: React.FC<MentionsPopupProps> = ({
  isOpen,
  onClose,
  members,
  filterQuery,
  onSelectMember,
  isDarkMode = true,
}) => {
  if (!isOpen) return null;

  const showTodos =
    !filterQuery ||
    'todos'.includes(filterQuery.toLowerCase()) ||
    'mencione todos'.includes(filterQuery.toLowerCase());

  const filteredMembers = members.filter((m) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    const cleanName = m.name.replace(/^~\s*/, '').toLowerCase();
    const displayName = (m.displayName || '').toLowerCase();
    return cleanName.includes(q) || displayName.includes(q) || m.name.toLowerCase().includes(q);
  });

  return (
    <>
      {/* Backdrop overlay to close on click outside */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div
        className={`absolute bottom-[68px] left-3 z-50 w-[300px] sm:w-[350px] max-h-[300px] rounded-2xl shadow-2xl border overflow-hidden flex flex-col transition-all duration-150 animate-in fade-in slide-in-from-bottom-2 select-none ${
          isDarkMode
            ? 'bg-[#111b21] border-[#222d34] text-[#e9edef]'
            : 'bg-white border-[#d1d7db] text-[#111b21]'
        }`}
      >
        <div className="p-1.5 overflow-y-auto space-y-0.5 max-h-[280px]">
          {/* 'todos' option at the top matching screenshot */}
          {showTodos && (
            <div
              onClick={() => onSelectMember('todos')}
              className={`p-2.5 rounded-xl flex items-center space-x-3 cursor-pointer transition-colors ${
                isDarkMode
                  ? 'hover:bg-[#202c33] active:bg-[#2a3942]'
                  : 'hover:bg-[#f0f2f5] active:bg-[#e9edef]'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-[#202c33] dark:bg-[#2a3942] flex items-center justify-center shrink-0 border border-white/5">
                <Users className="w-5 h-5 text-[#8696a0]" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-[15px] leading-snug truncate text-[#e9edef] dark:text-[#e9edef]">
                  todos
                </span>
                <span className="text-xs text-[#8696a0] truncate mt-0.5">
                  Mencione todos os membros do grupo
                </span>
              </div>
            </div>
          )}

          {/* Group Members List */}
          {filteredMembers.map((member) => (
            <div
              key={member.id}
              onClick={() => onSelectMember(member.name.replace(/^~\s*/, ''))}
              className={`p-2.5 rounded-xl flex items-center space-x-3 cursor-pointer transition-colors ${
                isDarkMode
                  ? 'hover:bg-[#202c33] active:bg-[#2a3942]'
                  : 'hover:bg-[#f0f2f5] active:bg-[#e9edef]'
              }`}
            >
              {/* Member Avatar */}
              <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-[#2563eb] flex items-center justify-center text-white font-bold text-sm">
                {member.avatar ? (
                  <img
                    src={member.avatar}
                    alt={member.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span>{member.name.replace(/^~\s*/, '').substring(0, 2).toUpperCase()}</span>
                )}
              </div>

              {/* Name & Secondary Display Name */}
              <div className="flex flex-col min-w-0">
                <span className="font-medium text-[15px] leading-snug truncate">
                  {member.name}
                </span>
                {member.displayName && (
                  <span className="text-xs text-[#8696a0] truncate mt-0.5">
                    {member.displayName}
                  </span>
                )}
              </div>
            </div>
          ))}

          {!showTodos && filteredMembers.length === 0 && (
            <div className="p-4 text-center text-xs text-[#8696a0]">
              Nenhum membro encontrado
            </div>
          )}
        </div>
      </div>
    </>
  );
};
