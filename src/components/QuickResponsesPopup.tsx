import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Sparkles, Command } from 'lucide-react';
import type { CannedResponse } from '../domain/currentUser';
import type { CannedResponsesStatus } from '../features/cannedResponses/useCannedResponses';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  quickResponses: CannedResponse[];
  onSelectResponse: (response: CannedResponse) => void;
  filterQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  status?: CannedResponsesStatus;
  error?: string | null;
  onRetry?: () => void;
  isDarkMode?: boolean;
}

export const QuickResponsesPopup: React.FC<Props> = ({
  isOpen,
  onClose,
  quickResponses,
  onSelectResponse,
  filterQuery = '',
  onSearchQueryChange,
  status = 'idle',
  error = null,
  onRetry,
  isDarkMode = false,
}) => {
  const [internalSearch, setInternalSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const popupRef = useRef<HTMLDivElement>(null);

  // Combine query from slash input (e.g. /obri) and internal search input
  const activeQuery = (internalSearch.trim() || filterQuery.trim()).toLowerCase();

  useEffect(() => {
    onSearchQueryChange?.(internalSearch.trim() || filterQuery.trim());
  }, [filterQuery, internalSearch, onSearchQueryChange]);

  // Helper to normalize string for diacritics
  const normalizeString = (str: string) => {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  };

  // Filter list
  const filteredList = quickResponses.filter((qr) => {
    if (!activeQuery) return true;
    const normQuery = normalizeString(activeQuery);
    const normShortcut = normalizeString(qr.shortCode);
    const normMessage = normalizeString(qr.content);

    return normShortcut.includes(normQuery) || normMessage.includes(normQuery);
  });

  // Reset selected index when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [activeQuery, quickResponses.length]);

  // Handle keyboard events (Up, Down, Enter, Esc)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (filteredList.length > 0 ? (prev + 1) % filteredList.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          filteredList.length > 0 ? (prev - 1 + filteredList.length) % filteredList.length : 0
        );
      } else if (e.key === 'Enter' && !e.shiftKey) {
        if (filteredList.length > 0 && selectedIndex < filteredList.length) {
          e.preventDefault();
          handlePickItem(filteredList[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredList, selectedIndex]);

  if (!isOpen) return null;

  const handlePickItem = (item: CannedResponse) => {
    // O dashboard original insere o conteúdo salvo sem transformar variáveis localmente.
    onSelectResponse(item);
    onClose();
  };

  // Highlight matching query text
  const renderHighlighted = (text: string, query: string) => {
    if (!query || !text) return text;
    const normText = normalizeString(text);
    const normQuery = normalizeString(query);
    const matchIdx = normText.indexOf(normQuery);

    if (matchIdx === -1) return text;

    const before = text.slice(0, matchIdx);
    const matched = text.slice(matchIdx, matchIdx + query.length);
    const after = text.slice(matchIdx + query.length);

    return (
      <span>
        {before}
        <span className="text-[#00a884] font-semibold underline">{matched}</span>
        {after}
      </span>
    );
  };

  return (
    <div
      ref={popupRef}
      className={`absolute bottom-full mb-2 left-0 right-0 sm:left-4 sm:right-auto sm:w-[480px] max-w-[calc(100vw-2rem)] z-30 rounded-2xl shadow-2xl border overflow-hidden flex flex-col max-h-[380px] animate-in slide-in-from-bottom-2 duration-150 ${
        isDarkMode
          ? 'bg-[#111b21] border-[#222d34] text-[#e9edef]'
          : 'bg-white border-[#d1d7db] text-[#111b21]'
      }`}
    >
      {/* Header matching WhatsApp Quick Responses design */}
      <div
        className={`px-4 py-3 flex items-center justify-between border-b shrink-0 ${
          isDarkMode ? 'bg-[#202c33] border-[#222d34]' : 'bg-[#f0f2f5] border-[#d1d7db]'
        }`}
      >
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-[#00a884]" />
          <h3 className="font-semibold text-sm">Respostas rápidas</h3>
        </div>

        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-full transition-colors cursor-pointer ${
              isDarkMode ? 'hover:bg-[#2a3942] text-[#aebac1]' : 'hover:bg-[#e9edef] text-[#54656f]'
            }`}
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search Input for Custom Fields and Quick Responses */}
      <div className={`p-2.5 border-b shrink-0 ${isDarkMode ? 'border-[#222d34]' : 'border-[#d1d7db]'}`}>
        <div
          className={`flex items-center rounded-lg px-3 h-9 transition-colors border ${
            isDarkMode ? 'bg-[#202c33] border-transparent focus-within:border-[#00a884]/60' : 'bg-[#f0f2f5] border-transparent focus-within:border-[#00a884]/60'
          }`}
        >
          <Search className="w-4 h-4 text-[#8696a0] mr-2 shrink-0" />
          <input
            type="text"
            value={internalSearch}
            onChange={(e) => setInternalSearch(e.target.value)}
            placeholder="Pesquisar atalho, texto ou campo..."
            className="w-full bg-transparent text-xs sm:text-sm outline-none placeholder:text-[#8696a0]"
          />
          {internalSearch && (
            <button onClick={() => setInternalSearch('')} className="text-[#8696a0] hover:text-white p-0.5">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* List of Quick Responses */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#222d34]/20 p-1">
        {status === 'loading' ? (
          <div className="p-6 text-center text-xs text-[#8696a0]">Carregando respostas rápidas…</div>
        ) : status === 'error' ? (
          <div className="p-6 text-center text-xs text-[#8696a0] space-y-3">
            <p>{error || 'Não foi possível carregar as respostas rápidas.'}</p>
            <button type="button" onClick={onRetry} className="text-[#00a884] font-semibold hover:underline">Tentar novamente</button>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#8696a0]">
            Nenhuma resposta rápida encontrada para &quot;{activeQuery}&quot;.
          </div>
        ) : (
          filteredList.map((qr, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <div
                key={qr.id}
                onClick={() => handlePickItem(qr)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`p-3 rounded-xl cursor-pointer transition-colors ${
                  isSelected
                    ? isDarkMode
                      ? 'bg-[#202c33]'
                      : 'bg-[#f0f2f5]'
                    : isDarkMode
                    ? 'hover:bg-[#202c33]/60'
                    : 'hover:bg-[#f8f9fa]'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm text-[#00a884] flex items-center space-x-1">
                    <span>/{renderHighlighted(qr.shortCode, activeQuery)}</span>
                  </span>
                </div>

                <p className="text-xs text-[#8696a0] line-clamp-2 leading-relaxed">
                  {renderHighlighted(qr.content, activeQuery)}
                </p>
                {qr.attachmentName && <p className="mt-1 text-[11px] text-[#00a884] truncate">Anexo: {qr.attachmentName}</p>}
              </div>
            );
          })
        )}
      </div>

      {/* Footer hint */}
      <div
        className={`px-3 py-2 text-[11px] flex items-center justify-between border-t shrink-0 ${
          isDarkMode ? 'bg-[#202c33]/50 border-[#222d34] text-[#8696a0]' : 'bg-[#f8f9fa] border-[#d1d7db] text-[#667781]'
        }`}
      >
        <span className="flex items-center space-x-1">
          <Command className="w-3 h-3 text-[#00a884]" />
          <span>Use <b>/</b> para abrir respostas rápidas</span>
        </span>
        <span className="hidden sm:inline"><b>↑ ↓</b> navegar • <b>Enter</b> selecionar</span>
      </div>
    </div>
  );
};
