import React, { useEffect, useMemo, useState } from 'react';
import { Search, Send, X } from 'lucide-react';
import type { Chat, Message } from '../types';
import type { Inbox } from '../domain/currentUser';
import { whatsappConfigurationForInbox } from '../integrations/whatsapp/provider';
import { conversationService } from '../integrations/chatwoot/conversations';
import { toChatListItem } from '../features/conversations/toChatListItem';

type Props = {
  message: Message;
  accountId: number | null;
  sourceConversationId: string;
  chats: Chat[];
  inboxes: Inbox[];
  isDarkMode: boolean;
  isSubmitting: boolean;
  error: string | null;
  onClose: () => void;
  onForward: (destinationConversationId: string) => void;
};

export const ForwardMessageModal: React.FC<Props> = ({ message, accountId, sourceConversationId, chats, inboxes, isDarkMode, isSubmitting, error, onClose, onForward }) => {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadedChats, setLoadedChats] = useState<Chat[]>(chats);
  useEffect(() => {
    if (!accountId) return;
    let active = true;
    const whatsappInboxes = inboxes.filter((inbox) => Boolean(whatsappConfigurationForInbox(inbox)));
    void Promise.all(whatsappInboxes.map((inbox) => conversationService.list({ accountId, inboxId: inbox.id, page: 1 })))
      .then((pages) => { if (active) setLoadedChats(pages.flatMap((page) => page.conversations.map((conversation) => toChatListItem(conversation, inboxes)))); })
      .catch(() => { if (active) setLoadedChats(chats); });
    return () => { active = false; };
  }, [accountId, chats, inboxes]);
  const destinations = useMemo(() => loadedChats.filter((chat) => {
    if (chat.id === sourceConversationId || !chat.inboxId) return false;
    const inbox = inboxes.find((item) => item.id === chat.inboxId);
    if (!inbox || !whatsappConfigurationForInbox(inbox)) return false;
    const value = `${chat.name} ${chat.channelName || ''} ${chat.phone || ''}`.toLocaleLowerCase();
    return value.includes(query.trim().toLocaleLowerCase());
  }), [inboxes, loadedChats, query, sourceConversationId]);
  const selected = destinations.find((chat) => chat.id === selectedId);
  const summary = message.text?.trim() || (message.attachments?.length ? `${message.attachments.length} anexo${message.attachments.length > 1 ? 's' : ''}` : 'Mensagem');
  const panel = isDarkMode ? 'border-[#2a3942] bg-[#111b21] text-[#e9edef]' : 'border-[#d1d7db] bg-white text-[#111b21]';

  return <div className="fixed inset-0 z-[10002] grid place-items-center bg-black/65 p-4" role="dialog" aria-modal="true" aria-labelledby="forward-message-title">
    <div className={`w-full max-w-lg rounded-2xl border shadow-2xl ${panel}`}>
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4"><div><h2 id="forward-message-title" className="text-base font-bold">Encaminhar mensagem</h2><p className="mt-1 truncate text-xs text-[#8696a0]">{summary}</p></div><button type="button" onClick={onClose} disabled={isSubmitting} className="rounded-lg p-2 hover:bg-white/10" aria-label="Fechar"><X className="h-5 w-5" /></button></div>
      <div className="p-5"><label className="relative block"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8696a0]" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar conversa WhatsApp" className="w-full rounded-lg border border-[#3b4a54] bg-transparent py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#00a884]" /></label>
        <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-white/10">
          {destinations.map((chat) => <button key={chat.id} type="button" onClick={() => setSelectedId(chat.id)} className={`flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-white/5 ${selectedId === chat.id ? 'bg-[#00a884]/15' : ''}`}><div className="grid h-9 w-9 place-items-center rounded-full bg-[#00a884] text-xs font-bold text-white">{chat.name.slice(0, 2).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-sm font-semibold">{chat.name}</p><p className="truncate text-xs text-[#8696a0]">{chat.channelName || 'WhatsApp'}</p></div></button>)}
          {!destinations.length && <p className="p-5 text-center text-sm text-[#8696a0]">Nenhuma conversa WhatsApp disponível.</p>}
        </div>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <p className="mt-3 text-xs leading-5 text-[#8696a0]">Será enviada como nova mensagem, sem copiar a resposta original.</p>
      </div>
      <div className="flex justify-end gap-2 border-t border-white/10 px-5 py-4"><button type="button" onClick={onClose} disabled={isSubmitting} className="rounded-lg px-3 py-2 text-sm hover:bg-white/10">Cancelar</button><button type="button" disabled={!selected || isSubmitting} onClick={() => selected && onForward(selected.id)} className="inline-flex items-center gap-2 rounded-lg bg-[#00a884] px-3 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-4 w-4" />{isSubmitting ? 'Encaminhando…' : 'Encaminhar'}</button></div>
    </div>
  </div>;
};
