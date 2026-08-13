import React, { useState, useRef, useEffect } from 'react';
import { X, Search, GripVertical } from 'lucide-react';
import { Chat } from '../types';

interface SearchMessagesPanelProps {
  chat: Chat;
  isDarkMode: boolean;
  onClose: () => void;
  onSelectMessage?: (messageId: string) => void;
}

export const SearchMessagesPanel: React.FC<SearchMessagesPanelProps> = ({
  chat,
  isDarkMode,
  onClose,
  onSelectMessage,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Resizable panel width state (bounded between 280px and 700px)
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    const saved = localStorage.getItem('wa_search_panel_width');
    return saved ? Math.max(280, Math.min(700, parseInt(saved, 10))) : 380;
  });
  const [isResizing, setIsResizing] = useState(false);
  const isResizingRef = useRef(false);

  useEffect(() => {
    localStorage.setItem('wa_search_panel_width', String(panelWidth));
  }, [panelWidth]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    setIsResizing(true);

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingRef.current) return;
      const newWidth = window.innerWidth - moveEvent.clientX;
      if (newWidth >= 280 && newWidth <= 700) {
        setPanelWidth(newWidth);
      }
    };

    const onMouseUp = () => {
      isResizingRef.current = false;
      setIsResizing(false);
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

  // Helper to normalize text (remove accents/diacritics and convert to lowercase)
  const normalizeString = (str: string) => {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  };

  // Filter messages based on search query
  const filteredMessages = chat.messages.filter((msg) => {
    if (!searchQuery.trim()) {
      return false;
    }

    const query = normalizeString(searchQuery);
    const textMatch = msg.text ? normalizeString(msg.text).includes(query) : false;
    const senderMatch = msg.senderName ? normalizeString(msg.senderName).includes(query) : false;
    const attachmentMatch = msg.attachments?.some((a) => a.title && normalizeString(a.title).includes(query));

    return textMatch || senderMatch || attachmentMatch;
  });

  // Highlight snippet text (case-insensitive and accent-insensitive)
  const renderHighlightedText = (text: string, highlight: string): React.ReactNode => {
    if (!highlight.trim() || !text) return text;
    const normalizedText = normalizeString(text);
    const normalizedHighlight = normalizeString(highlight);

    const matchIndex = normalizedText.indexOf(normalizedHighlight);
    if (matchIndex === -1) return text;

    const before = text.slice(0, matchIndex);
    const matched = text.slice(matchIndex, matchIndex + highlight.length);
    const after = text.slice(matchIndex + highlight.length);

    return (
      <span>
        {before}
        <span className="text-[#00a884] font-semibold underline">{matched}</span>
        {renderHighlightedText(after, highlight)}
      </span>
    );
  };

  return (
    <div
      style={{ width: `${panelWidth}px` }}
      className={`absolute inset-y-0 right-0 sm:relative flex flex-col h-full border-l shrink-0 transition-all duration-75 z-30 shadow-2xl sm:shadow-none select-none ${
        isDarkMode
          ? 'bg-[#111b21] border-[#222d34] text-[#e9edef]'
          : 'bg-white border-[#d1d7db] text-[#111b21]'
      }`}
    >
      {/* Resizable Border Handle (Left Edge) */}
      <div
        onMouseDown={handleMouseDown}
        title="Arrastar para redimensionar painel de pesquisa"
        className={`absolute -left-1.5 top-0 bottom-0 w-3 cursor-col-resize z-50 flex items-center justify-center group transition-colors ${
          isResizing ? 'bg-[#00a884]' : 'hover:bg-[#00a884]/40'
        }`}
      >
        <div
          className={`w-1 h-8 rounded-full transition-colors flex items-center justify-center ${
            isResizing ? 'bg-white' : 'bg-[#8696a0]/40 group-hover:bg-[#00a884]'
          }`}
        >
          <GripVertical className="w-3 h-3 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>
      {/* Panel Header */}
      <div
        className={`h-14 px-4 flex items-center space-x-4 border-b flex-shrink-0 ${
          isDarkMode ? 'bg-[#202c33] border-[#222d34]' : 'bg-[#f0f2f5] border-[#d1d7db]'
        }`}
      >
        <button
          onClick={onClose}
          className={`p-1.5 rounded-full transition-colors cursor-pointer ${
            isDarkMode ? 'hover:bg-[#2a3942] text-[#aebac1]' : 'hover:bg-[#e9edef] text-[#54656f]'
          }`}
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </button>
        <h3 className="font-semibold text-base truncate">Pesquisar mensagens</h3>
      </div>

      {/* Search Bar Row */}
      <div className="p-3">
        <div
          className={`flex items-center rounded-lg px-3 h-9 transition-colors ${
            isDarkMode ? 'bg-[#202c33] text-[#e9edef]' : 'bg-[#f0f2f5] text-[#111b21]'
          }`}
        >
          <Search className={`w-4 h-4 mr-2.5 shrink-0 ${isDarkMode ? 'text-[#8696a0]' : 'text-[#667781]'}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar..."
            className="w-full bg-transparent text-sm focus:outline-none placeholder:text-[#8696a0]"
            autoFocus
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-[#8696a0] hover:text-white p-1 ml-1 cursor-pointer"
              title="Limpar pesquisa"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Results or Empty State */}
      <div className="flex-1 overflow-y-auto">
        {!searchQuery.trim() ? (
          /* Empty State before searching */
          <div className="h-full flex items-center justify-center p-8 text-center text-sm text-[#8696a0]">
            Pesquisar mensagens com {chat.name}.
          </div>
        ) : filteredMessages.length > 0 ? (
          /* Results List */
          <div className="divide-y divide-[#222d34]/30">
            {filteredMessages.map((msg) => (
              <div
                key={msg.id}
                onClick={() => onSelectMessage && onSelectMessage(msg.id)}
                className={`p-4 cursor-pointer transition-colors ${
                  isDarkMode ? 'hover:bg-[#202c33]' : 'hover:bg-[#f0f2f5]'
                }`}
              >
                {/* Date label */}
                <div className="text-xs text-[#8696a0] mb-1">
                  {msg.time ? `${msg.dateLabel || '28/06/2026'} • ${msg.time}` : '28/06/2026'}
                </div>

                {/* Snippet / Content */}
                <div className={`text-sm line-clamp-2 ${isDarkMode ? 'text-[#e9edef]' : 'text-[#111b21]'}`}>
                  {msg.text ? (
                    renderHighlightedText(msg.text, searchQuery)
                  ) : msg.audioDuration || msg.attachments?.some((a) => a.type === 'audio') ? (
                    <span className="flex items-center space-x-1 text-[#8696a0]">
                      <span>🎤 Nota de voz ({msg.audioDuration || '0:25'})</span>
                    </span>
                  ) : (
                    <span className="text-[#8696a0]">Anexo de mídia</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* No results found */
          <div className="p-8 text-center text-sm text-[#8696a0]">
            Nenhuma mensagem encontrada
          </div>
        )}
      </div>
    </div>
  );
};
