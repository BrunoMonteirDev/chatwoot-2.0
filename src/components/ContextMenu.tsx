import React, { useEffect, useRef, useState } from 'react';
import {
  Eye,
  Edit2,
  Copy,
  Trash2,
  Share2,
  Download,
  Printer,
  History,
  Star,
  CheckCircle,
  MoreHorizontal,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

export interface ContextMenuItem {
  id?: string;
  label: string;
  icon?: React.ReactNode;
  action?: () => void;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
  shortcut?: string;
}

interface ContextMenuProps {
  x: number;
  y: number;
  isOpen: boolean;
  onClose: () => void;
  items: ContextMenuItem[];
  isDarkMode?: boolean;
  title?: string;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  isOpen,
  onClose,
  items,
  isDarkMode = true,
  title,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [coords, setCoords] = useState<{ x: number; y: number }>({ x, y });

  // Adjust coordinates so the context menu stays strictly inside window viewport boundaries
  useEffect(() => {
    if (!isOpen) return;

    const menu = menuRef.current;
    let newX = x;
    let newY = y;

    if (menu) {
      const rect = menu.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (x + rect.width > viewportWidth - 8) {
        newX = Math.max(8, viewportWidth - rect.width - 8);
      }
      if (y + rect.height > viewportHeight - 8) {
        newY = Math.max(8, viewportHeight - rect.height - 8);
      }
    }

    setCoords({ x: newX, y: newY });
    setSelectedIndex(-1);
  }, [x, y, isOpen, items]);

  // Handle click outside & escape key & keyboard arrows
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      const clickableIndices = items
        .map((item, idx) => (item.divider || item.disabled ? -1 : idx))
        .filter((idx) => idx !== -1);

      if (clickableIndices.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => {
          const currentPos = clickableIndices.indexOf(prev);
          const nextPos = (currentPos + 1) % clickableIndices.length;
          return clickableIndices[nextPos];
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => {
          const currentPos = clickableIndices.indexOf(prev);
          const prevPos =
            currentPos <= 0 ? clickableIndices.length - 1 : currentPos - 1;
          return clickableIndices[prevPos];
        });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIndex >= 0 && items[selectedIndex]) {
          const selected = items[selectedIndex];
          if (!selected.disabled && !selected.divider && selected.action) {
            selected.action();
            onClose();
          }
        }
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, items, selectedIndex, onClose]);

  if (!isOpen || items.length === 0) return null;

  return (
    <div
      ref={menuRef}
      style={{
        left: `${coords.x}px`,
        top: `${coords.y}px`,
      }}
      className={`fixed z-[9999] min-w-[210px] max-w-[280px] rounded-2xl border shadow-2xl py-1.5 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100 select-none overflow-hidden ${
        isDarkMode
          ? 'bg-[#182229]/95 border-[#2a3942] text-[#e9edef] shadow-black/60'
          : 'bg-white/95 border-gray-200 text-[#111b21] shadow-xl'
      }`}
    >
      {title && (
        <div className="px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-[#8696a0] border-b border-white/5 mb-1 truncate">
          {title}
        </div>
      )}

      <div className="max-h-[75vh] overflow-y-auto no-scrollbar py-0.5">
        {items.map((item, index) => {
          if (item.divider) {
            return (
              <div
                key={index}
                className={`my-1 border-t ${
                  isDarkMode ? 'border-[#2a3942]/60' : 'border-gray-100'
                }`}
              />
            );
          }

          const isFocused = selectedIndex === index;

          return (
            <button
              key={index}
              type="button"
              disabled={item.disabled}
              onClick={() => {
                if (item.action && !item.disabled) {
                  item.action();
                  onClose();
                }
              }}
              onMouseEnter={() => setSelectedIndex(index)}
              className={`w-full px-3.5 py-2 text-xs flex items-center justify-between font-medium transition-colors cursor-pointer text-left ${
                item.disabled
                  ? 'opacity-40 cursor-not-allowed'
                  : item.danger
                  ? isFocused
                    ? 'bg-red-500/20 text-red-400'
                    : 'text-red-400 hover:bg-red-500/10'
                  : isFocused
                  ? isDarkMode
                    ? 'bg-[#202c33] text-[#00a884]'
                    : 'bg-gray-100 text-[#00a884]'
                  : isDarkMode
                  ? 'text-[#e9edef] hover:bg-[#202c33]'
                  : 'text-[#111b21] hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center space-x-2.5 truncate mr-2">
                {item.icon && (
                  <span
                    className={`w-4 h-4 shrink-0 flex items-center justify-center ${
                      item.danger
                        ? 'text-red-400'
                        : isFocused
                        ? 'text-[#00a884]'
                        : isDarkMode
                        ? 'text-[#8696a0]'
                        : 'text-gray-500'
                    }`}
                  >
                    {item.icon}
                  </span>
                )}
                <span className="truncate">{item.label}</span>
              </div>

              {item.shortcut && (
                <span className="text-[10px] text-[#8696a0] font-mono shrink-0 ml-2">
                  {item.shortcut}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
