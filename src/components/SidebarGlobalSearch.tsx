import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Search, UserRound, MessageSquare, X } from 'lucide-react';
import { canSearchSidebar, sidebarSearchService, SIDEBAR_SEARCH_DEBOUNCE_MS, type SidebarSearchResults } from '../features/search/sidebarSearch';
import { errorMessageForUser } from '../integrations/chatwoot/errors';

type Props = {
  accountId: number | null;
  isDarkMode: boolean;
  onClose: () => void;
  onOpenConversation: (conversationId: number) => void;
  onOpenContacts: () => void;
};

const emptyResults: SidebarSearchResults = { conversations: [], contacts: [] };

export const SidebarGlobalSearch: React.FC<Props> = ({ accountId, isDarkMode, onClose, onOpenConversation, onOpenContacts }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SidebarSearchResults>(emptyResults);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef(0);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const normalized = query.trim();
    const requestId = ++requestRef.current;
    if (!accountId || !canSearchSidebar(normalized)) {
      setResults(emptyResults); setStatus('idle'); setError(null);
      return undefined;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setStatus('loading'); setError(null);
      try {
        const next = await sidebarSearchService.search(accountId, normalized, controller.signal);
        if (requestRef.current === requestId) { setResults(next); setStatus('ready'); }
      } catch (cause) {
        if (controller.signal.aborted || requestRef.current !== requestId) return;
        setResults(emptyResults); setError(errorMessageForUser(cause)); setStatus('error');
      }
    }, SIDEBAR_SEARCH_DEBOUNCE_MS);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [accountId, query]);

  const noResults = status === 'ready' && !results.conversations.length && !results.contacts.length;
  const panel = isDarkMode ? 'bg-[#202c33] text-white border-white/10' : 'bg-white text-[#111b21] border-black/10';
  const muted = isDarkMode ? 'text-[#aebac1]' : 'text-[#667781]';
  return <div role="dialog" aria-modal="true" aria-label="Pesquisa global" className="fixed inset-0 z-[100] flex items-start justify-center bg-black/45 p-4 pt-[10vh]" onMouseDown={onClose}>
    <section className={`w-full max-w-xl overflow-hidden rounded-2xl border shadow-2xl ${panel}`} onMouseDown={event => event.stopPropagation()}>
      <div className="flex items-center gap-2 border-b border-white/10 p-3">
        <Search className="h-5 w-5 text-[#00a884]" />
        <input ref={inputRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar conversas e contatos" className={`min-w-0 flex-1 bg-transparent outline-none ${muted}`} />
        {status === 'loading' && <Loader2 aria-label="Carregando" className="h-4 w-4 animate-spin" />}
        <button type="button" aria-label="Fechar pesquisa" onClick={onClose} className="rounded p-1 hover:bg-black/10"><X className="h-5 w-5" /></button>
      </div>
      <div className="max-h-[65vh] overflow-y-auto p-3">
        {!canSearchSidebar(query) && <p className={`px-2 py-8 text-center text-sm ${muted}`}>Digite ao menos 2 caracteres para pesquisar.</p>}
        {status === 'error' && <p role="alert" className="px-2 py-8 text-center text-sm text-red-400">{error || 'Não foi possível pesquisar agora.'}</p>}
        {noResults && <p className={`px-2 py-8 text-center text-sm ${muted}`}>Nenhum resultado encontrado.</p>}
        {results.conversations.length > 0 && <ResultGroup icon={<MessageSquare className="h-4 w-4" />} title="Conversas">
          {results.conversations.map(result => <button key={result.id} type="button" onClick={() => onOpenConversation(result.id)} className="w-full rounded-lg px-3 py-2 text-left hover:bg-black/10">
            <p className="truncate text-sm font-semibold">{result.name}</p>
            <p className={`truncate text-xs ${muted}`}>{[result.inbox, result.summary].filter(Boolean).join(' · ')}</p>
          </button>)}
        </ResultGroup>}
        {results.contacts.length > 0 && <ResultGroup icon={<UserRound className="h-4 w-4" />} title="Contatos">
          {results.contacts.map(result => <button key={result.id} type="button" onClick={onOpenContacts} className="w-full rounded-lg px-3 py-2 text-left hover:bg-black/10">
            <p className="truncate text-sm font-semibold">{result.name}</p><p className={`truncate text-xs ${muted}`}>{result.phoneNumber || 'Sem telefone'}</p>
          </button>)}
        </ResultGroup>}
      </div>
    </section>
  </div>;
};

const ResultGroup: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => <section className="mb-4 last:mb-0"><h2 className="mb-1 flex items-center gap-2 px-2 text-xs font-bold uppercase tracking-wide text-[#00a884]">{icon}{title}</h2>{children}</section>;
