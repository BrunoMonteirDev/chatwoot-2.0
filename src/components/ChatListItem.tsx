import React, { useState } from 'react';
import { MessageSquare, User, Lock, CornerDownLeft, Pin, Star, VolumeX } from 'lucide-react';
import { Chat } from '../types';
import { getChannelIcon } from './ChannelIcons';

interface Props {
  chat: Chat;
  isSelected: boolean;
  onSelect: (chat: Chat) => void;
  onContextMenu?: (e: React.MouseEvent, chat: Chat) => void;
  isDarkMode?: boolean;
}

export const ChatListItem: React.FC<Props> = ({
  chat,
  isSelected,
  onSelect,
  onContextMenu,
  isDarkMode = false,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const isPinned = chat.pinned || chat.isPinned;
  const isFavorite = chat.favorite || chat.isFavorite;

  // Time format e.g. "6m • now", "21d • 8m", "2h • 7m" or fallback to chat.time
  const formattedTime =
    chat.createdAtRelative && chat.lastMessageRelative
      ? `${chat.createdAtRelative} • ${chat.lastMessageRelative}`
      : chat.createdAtRelative
      ? `${chat.createdAtRelative} ago`
      : chat.time;

  return (
    <div
      onClick={() => onSelect(chat)}
      onContextMenu={(e) => {
        if (onContextMenu) {
          e.preventDefault();
          onContextMenu(e, chat);
        }
      }}
      className={`px-3 py-2.5 flex items-start space-x-3 cursor-pointer select-none transition-colors border-b ${
        isDarkMode
          ? isSelected
            ? 'bg-[#2a3942] border-[#202c33]'
            : 'bg-[#111b21] hover:bg-[#202c33] border-[#202c33]/60'
          : isSelected
          ? 'bg-[#f0f2f5] border-[#e9edef]'
          : 'bg-white hover:bg-[#f5f6f6] border-[#f0f2f5]'
      }`}
    >
      {/* Avatar Container with Channel Icon Badge */}
      <div className="relative shrink-0 mt-0.5">
        <div
          className="w-11 h-11 rounded-full overflow-hidden flex items-center justify-center font-bold text-xs shadow-xs"
          style={{
            backgroundColor:
              chat.avatarType === 'image' && chat.avatar
                ? 'transparent'
                : chat.avatarBg || '#00a884',
          }}
        >
          {chat.avatarType === 'image' && chat.avatar ? (
            <img
              src={chat.avatar}
              alt={chat.name}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="text-white font-bold text-xs">
              {chat.avatar || chat.name.substring(0, 2).toUpperCase()}
            </span>
          )}
        </div>

        {/* Small Channel Badge attached to Avatar */}
        <div className="absolute -bottom-1 -right-1 bg-white dark:bg-[#111b21] rounded-full p-0.5 ring-1 ring-black/10 dark:ring-white/10 shadow-xs flex items-center justify-center">
          {getChannelIcon(chat.channelName) || (
            <MessageSquare className="w-3 h-3 text-[#00a884]" />
          )}
        </div>
      </div>

      {/* Main Info Column */}
      <div className="flex-1 min-w-0 flex flex-col justify-center space-y-0.5">
        {/* Row 1: Channel & Assigned Agent */}
        <div className="flex items-center justify-between text-[11px] leading-tight text-[#8696a0]">
          <span className="truncate font-medium max-w-[55%]">
            {chat.channelName || 'Canal Interno'}
          </span>
          {chat.assignedAgent && (
            <span className="flex items-center space-x-1 shrink-0 font-medium text-[10px] uppercase tracking-wider text-[#8696a0]">
              <User className="w-2.5 h-2.5 opacity-80" />
              <span className="truncate max-w-[110px]">{chat.assignedAgent}</span>
            </span>
          )}
        </div>

        {/* Row 2: Contact Name & Time / Status Icons */}
        <div className="flex items-center justify-between min-w-0">
          <div className="flex items-center min-w-0 mr-2">
            <span
              className={`font-semibold text-[13.5px] truncate leading-tight ${
                isDarkMode ? 'text-[#e9edef]' : 'text-[#111b21]'
              }`}
            >
              {chat.name}
            </span>
            {isFavorite && (
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 ml-1 shrink-0" title="Favorito" />
            )}
          </div>
          <div className="flex items-center space-x-1 shrink-0">
            {isPinned && (
              <Pin className="w-3 h-3 text-[#00a884] transform rotate-45 fill-[#00a884]/20" title="Conversa Fixada" />
            )}
            {chat.muted && (
              <VolumeX className="w-3 h-3 text-[#8696a0]" title="Silenciado" />
            )}
            <span className="text-[11px] text-[#8696a0] font-normal whitespace-nowrap ml-1">
              {formattedTime}
            </span>
          </div>
        </div>

        {/* Row 3: Last Message & Unread Badge */}
        <div className="flex items-center justify-between min-w-0 pt-0.5">
          <div
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            className={`flex items-center truncate mr-2 relative text-[12px] leading-snug ${
              isDarkMode ? 'text-[#aebac1]' : 'text-[#667781]'
            }`}
          >
            {chat.lastMessageByMe && (
              <CornerDownLeft className="w-3 h-3 text-[#8696a0] mr-1 shrink-0 inline transform -rotate-90" />
            )}
            {chat.messages?.[0]?.isPrivate && (
              <Lock className="w-3 h-3 text-amber-500 mr-1 shrink-0 inline" />
            )}
            <span className="truncate">{chat.lastMessage}</span>

            {/* Tooltip */}
            {showTooltip && chat.lastMessage && (
              <div className="absolute left-0 top-full mt-1 z-50 bg-[#202c33] text-white border border-[#2a3942] p-2 max-w-[280px] w-max break-words text-xs pointer-events-none rounded-lg shadow-xl leading-relaxed">
                {chat.lastMessage}
              </div>
            )}
          </div>

          {chat.unreadCount && chat.unreadCount > 0 ? (
            <span className="min-w-[18px] h-[18px] px-1.5 bg-[#00a884] text-white rounded-full text-[10.5px] font-bold flex items-center justify-center leading-none shrink-0 ml-1">
              {chat.unreadCount}
            </span>
          ) : null}
        </div>

        {/* Row 4: Tags / Etiquetas */}
        {chat.tags && chat.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {chat.tags.map((tag, idx) => (
              <span
                key={idx}
                className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                  isDarkMode
                    ? 'bg-[#202c33] text-[#e9edef] border-[#2a3942]'
                    : 'bg-[#f0f2f5] text-[#111b21] border-[#d1d7db]'
                }`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full mr-1 shrink-0"
                  style={{ backgroundColor: tag.color || '#f59e0b' }}
                />
                {tag.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

