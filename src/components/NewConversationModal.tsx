import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, FileText, Lock, Mail, MessageSquarePlus, Paperclip, Search, Send, UserPlus, X } from 'lucide-react';
import type { Chat } from '../types';
import type { Inbox } from '../domain/currentUser';
import type { ContactsStatus } from '../features/contacts/useContacts';
import { errorMessageForUser } from '../integrations/chatwoot/errors';
import { normalizeBrazilianPhone } from '../../phone';

const COUNTRY_CODES = [
  { code: '55', label: 'Brasil +55' }, { code: '1', label: 'EUA/Canadá +1' },
  { code: '351', label: 'Portugal +351' }, { code: '44', label: 'Reino Unido +44' },
  { code: '34', label: 'Espanha +34' }, { code: '52', label: 'México +52' },
  { code: '54', label: 'Argentina +54' }, { code: '56', label: 'Chile +56' },
  { code: '57', label: 'Colômbia +57' }, { code: '598', label: 'Uruguai +598' },
];

interface Props {
  contacts: Chat[];
  contactsStatus?: ContactsStatus;
  contactsError?: string | null;
  onRetryContacts?: () => void;
  inboxes: Inbox[];
  defaultInboxId?: number | null;
  onCreateContact: (input: { name: string; phoneNumber?: string; email?: string; inboxId: number }) => Promise<Chat | null>;
  onStartConversation: (input: { contactId: number; inboxId: number; initialContent?: string; private: boolean; files?: File[] }) => Promise<void>;
  onClose: () => void;
  isDarkMode?: boolean;
}

export const NewConversationModal: React.FC<Props> = ({
  contacts,
  contactsStatus = 'idle',
  contactsError = null,
  onRetryContacts,
  inboxes,
  defaultInboxId = null,
  onCreateContact,
  onStartConversation,
  onClose,
  isDarkMode = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [countryCode, setCountryCode] = useState('55');
  const [selectedContact, setSelectedContact] = useState<Chat | null>(null);
  const [selectedInboxId, setSelectedInboxId] = useState('');
  const [initialMessageText, setInitialMessageText] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [isCreatingContact, setIsCreatingContact] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const preferred = defaultInboxId && inboxes.some((inbox) => inbox.id === defaultInboxId) ? defaultInboxId : inboxes[0]?.id;
    if (!preferred) { setSelectedInboxId(''); return; }
    if (!inboxes.some((inbox) => String(inbox.id) === selectedInboxId)) setSelectedInboxId(String(preferred));
  }, [defaultInboxId, inboxes, selectedInboxId]);

  const normalizedPhone = (value: string) => {
    const trimmed = value.trim();
    if (trimmed.startsWith('+')) return normalizeBrazilianPhone(`+${trimmed.slice(1).replace(/\D/g, '')}`);
    const digits = trimmed.replace(/\D/g, '');
    if (!digits) return '';
    return normalizeBrazilianPhone(`+${digits.startsWith('55') ? digits : `${countryCode}${digits}`}`);
  };

  const matchingContacts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const normalizedQuery = normalizedPhone(searchQuery).toLowerCase();
    if (!query) return contacts;
    return contacts.filter((contact) =>
      contact.name.toLowerCase().includes(query) ||
      contact.phone?.toLowerCase().includes(query) ||
      (normalizedQuery ? contact.phone?.replace(/\D/g, '') === normalizedQuery.replace(/\D/g, '') : false) ||
      contact.email?.toLowerCase().includes(query) ||
      contact.identifier?.toLowerCase().includes(query)
    );
  }, [contacts, countryCode, searchQuery]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedContact || !selectedInboxId || isSubmitting) return;
    setError(null);
    setIsSubmitting(true);
    try {
      await onStartConversation({
        contactId: Number(selectedContact.id),
        inboxId: Number(selectedInboxId),
        initialContent: initialMessageText.trim() || undefined,
        private: isPrivate,
        files,
      });
      onClose();
    } catch (cause) {
      setError(errorMessageForUser(cause));
    } finally {
      setIsSubmitting(false);
    }
  };

  const createSuggestedContact = async () => {
    const identifier = searchQuery.trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
    const phone = normalizedPhone(identifier);
    if ((!isEmail && phone.length < 7) || !selectedInboxId || isCreatingContact) return;
    setError(null); setIsCreatingContact(true);
    try {
      // A API exige um nome; o Chatwoot usa o próprio identificador até o agente editar o contato.
      const contact = await onCreateContact({ name: isEmail ? identifier : phone, inboxId: Number(selectedInboxId), ...(isEmail ? { email: identifier } : { phoneNumber: phone }) });
      if (!contact) throw new Error('Não foi possível criar o contato.');
      setSelectedContact(contact); setSearchQuery(identifier);
    } catch (cause) { setError(errorMessageForUser(cause)); }
    finally { setIsCreatingContact(false); }
  };

  const suggestedIdentifier = useMemo(() => {
    const value = searchQuery.trim();
    if (!value || matchingContacts.length || contactsStatus !== 'ready') return null;
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { value, type: 'email' as const };
    const phone = normalizedPhone(value);
    return phone.length >= 7 ? { value: phone, type: 'phone' as const } : null;
  }, [contactsStatus, countryCode, matchingContacts.length, searchQuery]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className={`w-full max-w-2xl rounded-2xl shadow-2xl border flex flex-col overflow-hidden max-h-[90vh] ${isDarkMode ? 'bg-[#1f2c34] border-[#2a3942] text-white' : 'bg-white border-gray-200 text-[#111b21]'}`}>
        <div className={`px-5 py-4 flex items-center justify-between border-b ${isDarkMode ? 'border-[#2a3942] bg-[#111b21]' : 'border-gray-200 bg-gray-50'}`}>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#00a884]/20 text-[#00a884] flex items-center justify-center"><MessageSquarePlus className="w-5 h-5" /></div>
            <div><h2 className="font-bold text-base leading-tight">Nova Conversa</h2><p className="text-xs text-[#8696a0]">Selecione um contato e uma caixa de entrada para iniciar o atendimento</p></div>
          </div>
          <button type="button" onClick={onClose} className={`p-1.5 rounded-full transition-colors cursor-pointer ${isDarkMode ? 'hover:bg-white/10 text-[#8696a0] hover:text-white' : 'hover:bg-black/10 text-[#54656f]'}`}><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={submit} className="p-5 flex-1 overflow-y-auto space-y-5">
          <div><label className="block text-xs font-bold text-[#00a884] uppercase tracking-wider mb-2">1. Escolher Caixa de Entrada</label><select value={selectedInboxId} onChange={(event) => setSelectedInboxId(event.target.value)} className={`w-full px-3 py-2.5 rounded-xl border text-xs outline-none cursor-pointer ${isDarkMode ? 'bg-[#202c33] border-[#2a3942] text-white' : 'bg-gray-50 border-gray-300 text-black'}`}><option value="">Selecione uma caixa de entrada</option>{inboxes.map((inbox) => <option key={inbox.id} value={inbox.id}>{inbox.name} · {inbox.channelType.replace('Channel::', '')}</option>)}</select>{!inboxes.length && <p className="mt-1 text-xs text-red-500">Nenhuma inbox disponível para esta conta.</p>}</div>
          <div>
            <label className="block text-xs font-bold text-[#00a884] uppercase tracking-wider mb-2">2. Selecionar ou Pesquisar Contato</label>
            <div className={`flex items-center h-10 rounded-xl border ${isDarkMode ? 'bg-[#202c33] border-[#2a3942]' : 'bg-gray-100 border-gray-200'}`}>
              {!searchQuery.includes('@') && <select value={countryCode} onChange={(event) => setCountryCode(event.target.value)} aria-label="DDI" className={`h-full max-w-31 shrink-0 rounded-l-xl border-r px-2 text-xs outline-none ${isDarkMode ? 'bg-[#202c33] border-[#2a3942] text-white' : 'bg-gray-100 border-gray-200 text-black'}`}>{COUNTRY_CODES.map(item => <option key={item.code} value={item.code}>{item.label}</option>)}</select>}
              <Search className="w-4 h-4 text-[#8696a0] mr-2 shrink-0" />
              <input type="text" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Pesquisar por nome, telefone ou e-mail..." className="w-full bg-transparent text-xs outline-none" />
              {searchQuery && <button type="button" onClick={() => setSearchQuery('')} className="text-[#8696a0] hover:text-white cursor-pointer"><X className="w-3.5 h-3.5" /></button>}
            </div>
            <div className={`mt-2 max-h-44 overflow-y-auto rounded-xl border p-1 space-y-1 ${isDarkMode ? 'border-[#2a3942] bg-[#111b21]' : 'border-gray-200 bg-gray-50'}`}>
              {contactsStatus === 'loading' ? <p className="p-4 text-center text-xs text-[#8696a0]">Carregando contatos…</p>
                : contactsStatus === 'error' ? <div className="p-4 text-center text-xs text-[#8696a0] space-y-2"><p>{contactsError || 'Não foi possível carregar os contatos.'}</p><button type="button" onClick={onRetryContacts} className="text-[#00a884] font-semibold hover:underline">Tentar novamente</button></div>
                  : matchingContacts.length ? matchingContacts.map((contact) => {
                    const isSelected = selectedContact?.id === contact.id;
                    return <div key={contact.id} onClick={() => setSelectedContact(contact)} className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${isSelected ? isDarkMode ? 'bg-[#00a884]/25 text-white border border-[#00a884]/40' : 'bg-[#00a884]/15 text-black border border-[#00a884]/30' : isDarkMode ? 'hover:bg-white/5 text-[#aebac1]' : 'hover:bg-black/5 text-[#54656f]'}`}>
                      <div className="flex items-center space-x-3 min-w-0"><div className="w-8 h-8 rounded-full bg-[#00a884] text-white flex items-center justify-center overflow-hidden font-bold text-xs shrink-0">{contact.avatarType === 'image' ? <img src={contact.avatar} alt="" className="w-full h-full object-cover" /> : contact.name.slice(0, 2).toUpperCase()}</div><div className="min-w-0"><p className="text-xs font-bold truncate text-white/90">{contact.name}</p><p className="text-[11px] text-[#8696a0] truncate">{contact.phone || contact.email || 'Sem telefone e e-mail'}</p></div></div>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-[#00a884] shrink-0" />}
                    </div>;
                  }) : <p className="p-4 text-center text-xs text-[#8696a0]">Nenhum contato encontrado</p>}
            </div>
            {suggestedIdentifier && <button type="button" disabled={isCreatingContact || !selectedInboxId} onClick={() => void createSuggestedContact()} className={`mt-2 flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors disabled:opacity-50 ${isDarkMode ? 'border-[#2a3942] bg-[#111b21] hover:bg-white/5' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'}`}><span className="grid h-8 w-8 place-items-center rounded-full bg-[#00a884]/15 text-[#00a884]">{suggestedIdentifier.type === 'email' ? <Mail className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}</span><span className="min-w-0 flex-1"><span className="block text-xs font-bold">{suggestedIdentifier.value}</span><span className="block text-[11px] text-[#8696a0]">{!selectedInboxId ? 'Escolha uma caixa de entrada primeiro' : isCreatingContact ? 'Criando contato…' : 'Criar novo contato com este ' + (suggestedIdentifier.type === 'email' ? 'e-mail' : 'telefone')}</span></span></button>}
          </div>

          {selectedContact && <div className="space-y-4 animate-fade-in border-t border-white/10 pt-4">
            <label className="block text-xs font-bold text-[#00a884] uppercase tracking-wider">3. Configurar Novo Atendimento</label>
            <div><label className="block text-xs font-semibold text-[#8696a0] mb-1">Primeira Mensagem ou Nota Inicial (Opcional)</label><textarea value={initialMessageText} onChange={(event) => setInitialMessageText(event.target.value)} rows={3} placeholder="Digite a primeira mensagem para enviar ao cliente..." className={`w-full p-3 rounded-xl border text-xs outline-none resize-none ${isDarkMode ? 'bg-[#202c33] border-[#2a3942] focus:border-[#00a884] text-white placeholder-[#8696a0]' : 'bg-gray-50 border-gray-300 focus:border-[#00a884] text-black placeholder-gray-400'}`} /></div>
            <div className={`rounded-xl border p-3 space-y-2 ${isDarkMode ? 'border-[#2a3942] bg-[#111b21]' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold text-[#8696a0]">Anexos (opcional)</span><input ref={fileInputRef} type="file" multiple className="hidden" onChange={(event) => { const selected = Array.from(event.target.files || []); setFiles((current) => [...current, ...selected]); event.target.value = ''; }} /><button type="button" disabled={isSubmitting} onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-1 text-xs font-bold text-[#00a884] hover:underline disabled:opacity-40"><Paperclip className="w-3.5 h-3.5" />Selecionar arquivos</button></div>
              {files.length > 0 && <div className="space-y-1.5">{files.map((file, index) => <div key={`${file.name}-${file.size}-${index}`} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 bg-black/5 dark:bg-white/5 text-xs"><span className="min-w-0 truncate flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 shrink-0 text-[#00a884]" />{file.name} <span className="text-[#8696a0]">({Math.ceil(file.size / 1024)} KB)</span></span><button type="button" disabled={isSubmitting} onClick={() => setFiles((current) => current.filter((_, currentIndex) => currentIndex !== index))} className="text-[#8696a0] hover:text-red-500 disabled:opacity-40"><X className="w-3.5 h-3.5" /></button></div>)}</div>}
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-black/10 dark:bg-white/5 border border-white/5"><div className="flex items-center space-x-2 text-xs"><Lock className="w-4 h-4 text-amber-400 shrink-0" /><div><p className="font-bold text-white/90">Nota Privada Interna</p><p className="text-[10px] text-[#8696a0]">Apenas visível para a equipe</p></div></div><button type="button" onClick={() => setIsPrivate((value) => !value)} className={`w-9 h-5 rounded-full transition-colors relative cursor-pointer ${isPrivate ? 'bg-amber-500' : 'bg-gray-600'}`}><span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${isPrivate ? 'left-4.5' : 'left-0.5'}`} /></button></div>
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="pt-2 flex items-center space-x-3"><button type="button" onClick={onClose} disabled={isSubmitting} className={`flex-1 py-2.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${isDarkMode ? 'border-[#2a3942] text-[#aebac1] hover:bg-white/5' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}>Cancelar</button><button type="submit" disabled={!selectedContact || !selectedInboxId || isSubmitting} className="flex-1 py-2.5 rounded-xl bg-[#00a884] hover:bg-[#008f70] text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center space-x-2 disabled:opacity-40"><Send className="w-4 h-4" /><span>{isSubmitting ? 'Iniciando…' : 'Iniciar Atendimento'}</span></button></div>
          </div>}
        </form>
      </div>
    </div>
  );
};
