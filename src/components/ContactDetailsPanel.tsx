import { Check, Clock, Download, FileText, History, Image as ImageIcon, Link, Loader2, Mail, Phone, RefreshCw, Save, Tag, User, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import type { AccountLabel, AssignableAgent, ContactNote, ContactProfile, ConversationAttachmentSummary, ConversationPriority, ConversationSummary, ConversationTeam } from '../domain/currentUser';
import type { ContactUpdate } from '../integrations/chatwoot/contacts';
import { contactConversationHistoryItem, previousContactConversations } from '../features/contacts/contactConversationHistory';
import type { Inbox } from '../domain/currentUser';
import type { Message } from '../types';
import { attachmentsWithinDates, contentGroups, linksMatchingSearch } from '../features/attachments/conversationContent';
import { documentPresentation, triggerAttachmentDownload } from '../features/attachments/fileUtils';

interface Props {
  contact: ContactProfile | null;
  notes: ContactNote[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  isSaving: boolean;
  isCreatingNote: boolean;
  isDarkMode: boolean;
  initialTab?: 'contact' | 'attributes' | 'content';
  onTabChange?: (tab: 'contact' | 'attributes' | 'content') => void;
  conversation?: ConversationSummary | null;
  conversationLabels?: AccountLabel[];
  conversationAgents?: AssignableAgent[];
  conversationTeams?: ConversationTeam[];
  conversationParticipants?: AssignableAgent[];
  managementPendingAction?: string | null;
  onSetConversationPriority?: (priority: ConversationPriority) => void;
  onAssignConversationAgent?: (agentId: number | null) => void;
  onAssignConversationTeam?: (teamId: number | null) => void;
  onSetConversationLabels?: (labels: string[]) => void;
  onSetConversationParticipants?: (userIds: number[]) => Promise<AssignableAgent[]>;
  onClose: () => void;
  onRetry: () => void;
  onUpdate: (update: ContactUpdate) => Promise<ContactProfile | null>;
  onCreateNote: (content: string) => Promise<ContactNote | null>;
  contactConversations?: ConversationSummary[];
  contactConversationsStatus?: 'idle' | 'loading' | 'ready' | 'error';
  contactConversationsError?: string | null;
  inboxes?: Inbox[];
  onOpenConversation?: (conversationId: number) => void;
  attachments?: ConversationAttachmentSummary[]; attachmentStatus?: 'idle' | 'loading' | 'ready' | 'error'; attachmentError?: string | null; hasMoreAttachments?: boolean; onLoadMoreAttachments?: () => void; onRetryAttachments?: () => void; messages?: Message[]; onOpenImage?: (url: string, title?: string) => void;
}

const stringify = (value: Record<string, unknown>) => JSON.stringify(value, null, 2);

const priorityOptions: { value: ConversationPriority; label: string }[] = [
  { value: null, label: 'Sem prioridade' },
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
];

export const ContactDetailsPanel = ({ contact, notes, status, error, isSaving, isCreatingNote, isDarkMode, initialTab = 'contact', onTabChange, conversation = null, conversationLabels = [], conversationAgents = [], conversationTeams = [], conversationParticipants = [], managementPendingAction = null, onSetConversationPriority, onAssignConversationAgent, onAssignConversationTeam, onSetConversationLabels, onSetConversationParticipants, onClose, onRetry, onUpdate, onCreateNote, contactConversations = [], contactConversationsStatus = 'idle', contactConversationsError = null, inboxes = [], onOpenConversation, attachments = [], attachmentStatus = 'idle', attachmentError = null, hasMoreAttachments = false, onLoadMoreAttachments, onRetryAttachments, messages = [], onOpenImage }: Props) => {
  const [tab, setTab] = useState<'contact' | 'attributes' | 'content'>(initialTab);
  const [draft, setDraft] = useState({ name: '', email: '', phoneNumber: '', identifier: '', companyName: '' });
  const [additionalText, setAdditionalText] = useState('{}');
  const [customText, setCustomText] = useState('{}');
  const [noteText, setNoteText] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const selectTab = (nextTab: 'contact' | 'attributes' | 'content') => { setTab(nextTab); onTabChange?.(nextTab); };

  useEffect(() => { setTab(initialTab); }, [initialTab]);
  useEffect(() => {
    if (!contact) return;
    setDraft({ name: contact.name, email: contact.email || '', phoneNumber: contact.phoneNumber || '', identifier: contact.identifier || '', companyName: contact.companyName || '' });
    setAdditionalText(stringify(contact.additionalAttributes));
    setCustomText(stringify(contact.customAttributes));
  }, [contact]);

  const surface = isDarkMode ? 'bg-[#111b21] border-[#222d34] text-[#e9edef]' : 'bg-white border-[#d1d7db] text-[#111b21]';
  const input = `w-full rounded-lg border px-2.5 py-2 text-xs outline-none ${isDarkMode ? 'border-[#374248] bg-[#202c33] text-white' : 'border-[#d1d7db] bg-white text-[#111b21]'}`;
  const selectedLabels = new Set(conversation?.labels ?? []);
  const managementBusy = managementPendingAction !== null;
  const hasChanges = Boolean(contact && (
    draft.name !== contact.name ||
    draft.email !== (contact.email || '') ||
    draft.phoneNumber !== (contact.phoneNumber || '') ||
    draft.identifier !== (contact.identifier || '') ||
    draft.companyName !== (contact.companyName || '') ||
    additionalText !== stringify(contact.additionalAttributes) ||
    customText !== stringify(contact.customAttributes)
  ));
  const toggleConversationLabel = (title: string) => {
    if (!onSetConversationLabels) return;
    const next = new Set(selectedLabels);
    next.has(title) ? next.delete(title) : next.add(title);
    onSetConversationLabels([...next]);
  };
  const participantIds = conversationParticipants.map((participant) => participant.id);
  const previousConversations = previousContactConversations(contactConversations, conversation?.id || null);
  const [contentTab, setContentTab] = useState<'media' | 'links' | 'documents'>('media');
  const [attachmentDateFrom, setAttachmentDateFrom] = useState('');
  const [attachmentDateTo, setAttachmentDateTo] = useState('');
  const [linkSearch, setLinkSearch] = useState('');
  const content = contentGroups(attachmentsWithinDates(attachments, attachmentDateFrom, attachmentDateTo), messages);
  const filteredLinks = linksMatchingSearch(content.links, linkSearch);
  const toggleConversationParticipant = async (agentId: number) => {
    if (!onSetConversationParticipants || managementBusy) return;
    const next = new Set(participantIds);
    next.has(agentId) ? next.delete(agentId) : next.add(agentId);
    try {
      await onSetConversationParticipants([...next]);
    } catch {
      setFeedback('Não foi possível atualizar os responsáveis da conversa.');
    }
  };
  const save = async () => {
    if (!hasChanges || !window.confirm('Deseja salvar as alterações deste contato?')) return;
    try {
      const additionalAttributes = JSON.parse(additionalText) as Record<string, unknown>;
      const customAttributes = JSON.parse(customText) as Record<string, unknown>;
      await onUpdate({ name: draft.name.trim(), email: draft.email.trim() || null, phoneNumber: draft.phoneNumber.trim() || null, identifier: draft.identifier.trim() || null, companyName: draft.companyName.trim() || null, additionalAttributes, customAttributes });
      setFeedback('Contato salvo.');
    } catch { setFeedback('Não foi possível salvar. Revise os atributos JSON e tente novamente.'); }
  };
  const addNote = async () => {
    try {
      const note = await onCreateNote(noteText);
      if (note) { setNoteText(''); setFeedback('Nota adicionada.'); }
    } catch { setFeedback('Não foi possível adicionar a nota.'); }
  };

  return <div className={`fixed inset-0 z-[80] flex h-full w-full flex-col ${surface} md:relative md:z-30 md:w-[380px] md:max-w-[90vw] md:shrink-0 md:border-l`}>
    <div className={`h-14 px-3 flex items-center justify-between border-b shrink-0 ${isDarkMode ? 'bg-[#151717] border-[#1e1f1f]' : 'bg-[#f0f2f5] border-[#d1d7db]'}`}>
      <div className="flex items-center gap-2"><button type="button" onClick={onClose} title="Fechar painel" className="p-1.5 rounded-full hover:bg-white/10"><X className="w-5 h-5 text-[#8696a0]" /></button><span className="font-bold text-sm">Dados do contato</span></div>
    </div>
    <div className="p-3 flex gap-1 border-b border-white/10"><button type="button" onClick={() => selectTab('contact')} className={`px-3 py-1 rounded-md text-xs font-semibold ${tab === 'contact' ? 'bg-[#00a884] text-white' : 'text-[#8696a0]'}`}>Dados</button><button type="button" onClick={() => selectTab('attributes')} className={`px-3 py-1 rounded-md text-xs font-semibold ${tab === 'attributes' ? 'bg-[#00a884] text-white' : 'text-[#8696a0]'}`}>Atributos</button><button type="button" onClick={() => selectTab('content')} className={`px-3 py-1 rounded-md text-xs font-semibold ${tab === 'content' ? 'bg-[#00a884] text-white' : 'text-[#8696a0]'}`}>Conteúdo</button></div>
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {status === 'loading' && <div className="py-12 text-center text-sm text-[#8696a0]"><Loader2 className="inline w-4 h-4 animate-spin mr-2" />Carregando contato…</div>}
      {status === 'error' && <div className="py-12 text-center text-sm text-red-300">{error}<button type="button" onClick={onRetry} className="block mx-auto mt-3 text-[#00a884] font-semibold"><RefreshCw className="inline w-3.5 h-3.5 mr-1" />Tentar novamente</button></div>}
      {status === 'ready' && contact && <>
        {feedback && <div className="rounded-lg bg-[#00a884]/10 p-2 text-xs text-[#7de2cc]">{feedback}</div>}
        {tab === 'contact' && <>
          <div className="flex flex-col items-center gap-2 text-center"><div className="w-20 h-20 rounded-full overflow-hidden bg-[#00a884] flex items-center justify-center text-white text-xl font-bold">{contact.avatarUrl ? <img src={contact.avatarUrl} alt={contact.name} className="w-full h-full object-cover" /> : contact.name.slice(0, 2).toUpperCase()}</div><label className="w-full text-left"><span className="mb-1 flex items-center gap-2 text-xs text-[#8696a0]"><User className="h-4 w-4" />Nome</span><input value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} className={`${input} text-center font-semibold`} /></label></div>
          <div className="space-y-3 text-xs">
            <Field label="Telefone" icon={<Phone className="w-4 h-4" />} value={draft.phoneNumber} onChange={value => setDraft({ ...draft, phoneNumber: value })} inputClass={input} />
            <Field label="E-mail" icon={<Mail className="w-4 h-4" />} value={draft.email} onChange={value => setDraft({ ...draft, email: value })} inputClass={input} />
            <Field label="Identificador" icon={<Tag className="w-4 h-4" />} value={draft.identifier} onChange={value => setDraft({ ...draft, identifier: value })} inputClass={input} />
            <Field label="Empresa" icon={<User className="w-4 h-4" />} value={draft.companyName} onChange={value => setDraft({ ...draft, companyName: value })} inputClass={input} />
          </div>
          <div className="border-t border-white/10 pt-3"><div className="mb-2 flex items-center gap-1 text-xs font-bold"><FileText className="w-4 h-4 text-[#00a884]" />Notas</div><textarea value={noteText} onChange={event => setNoteText(event.target.value)} disabled={isCreatingNote} placeholder="Adicionar nota interna sobre o contato…" className={`${input} min-h-16 resize-y`} /><button type="button" disabled={!noteText.trim() || isCreatingNote} onClick={() => void addNote()} className="mt-2 rounded-lg bg-[#00a884] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{isCreatingNote ? 'Salvando…' : 'Adicionar nota'}</button><div className="mt-3 space-y-2">{notes.length ? notes.map(note => <div key={note.id} className="rounded-lg bg-black/10 p-2.5 text-xs"><p className="whitespace-pre-wrap">{note.content}</p><span className="mt-1 block text-[10px] text-[#8696a0]">{note.authorName || 'Agente'} · {new Date(note.createdAt * 1000).toLocaleString()}</span></div>) : <p className="text-xs text-[#8696a0]">Nenhuma nota para este contato.</p>}</div></div>
          <section className="border-t border-white/10 pt-3"><div className="mb-2 flex items-center gap-1 text-xs font-bold"><History className="w-4 h-4 text-[#00a884]" />Conversas anteriores</div>{contactConversationsStatus === 'loading' ? <p className="text-xs text-[#8696a0]">Carregando conversas…</p> : contactConversationsStatus === 'error' ? <p className="text-xs text-red-400">{contactConversationsError || 'Não foi possível carregar as conversas deste contato.'}</p> : previousConversations.length ? <div className="space-y-2">{previousConversations.map((item) => { const summary = contactConversationHistoryItem(item, inboxes); return <button key={item.id} type="button" onClick={() => onOpenConversation?.(item.id)} className={`w-full rounded-lg border p-2.5 text-left text-xs transition-colors ${isDarkMode ? 'border-[#2a3942] bg-[#182229] hover:border-[#00a884]' : 'border-[#d1d7db] bg-[#f8f9fa] hover:border-[#00a884]'}`}><div className="flex items-center justify-between gap-2"><span className="truncate font-semibold text-[#00a884]">{summary.inboxName}</span><span className="shrink-0 capitalize text-[#8696a0]">{summary.status}</span></div><p className="mt-1 truncate text-[#8696a0]">{summary.preview}</p><span className="mt-1.5 flex items-center gap-1 text-[10px] text-[#8696a0]"><Clock className="h-3 w-3" />{new Date(summary.lastActivityAt * 1000).toLocaleString()}</span></button>; })}</div> : contactConversationsStatus === 'ready' ? <p className="text-xs text-[#8696a0]">Nenhuma conversa anterior para este contato.</p> : null}</section>
        </>}
        {tab === 'attributes' && <div className="space-y-4">
          {conversation && <section className={`rounded-xl border p-3 ${isDarkMode ? 'border-[#222d34] bg-[#182229]/60' : 'border-gray-200 bg-gray-50'}`}>
            <h4 className="mb-3 flex items-center gap-1.5 text-xs font-bold text-[#00a884]"><User className="h-3.5 w-3.5" />Gerenciar conversa</h4>
            <label className="block text-[11px] text-[#8696a0]">Prioridade
              <select
                value={conversation.priority || ''}
                disabled={managementBusy || !onSetConversationPriority}
                onChange={(event) => onSetConversationPriority?.((event.target.value || null) as ConversationPriority)}
                className={`${input} mt-1 disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {priorityOptions.map((option) => <option key={option.value || 'none'} value={option.value || ''}>{option.label}</option>)}
              </select>
            </label>

            <label className="mt-3 block text-[11px] text-[#8696a0]">Responsável principal
              <select
                value={conversation.assigneeId || ''}
                disabled={managementBusy || !onAssignConversationAgent}
                onChange={(event) => onAssignConversationAgent?.(event.target.value ? Number(event.target.value) : null)}
                className={`${input} mt-1 disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <option value="">Não atribuído</option>
                {conversationAgents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
              </select>
            </label>

            <div className="mt-3 border-t border-white/10 pt-3">
              <div className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold text-[#8696a0]"><User className="h-3.5 w-3.5" />Responsáveis</div>
              <p className="mb-1.5 text-[11px] leading-4 text-[#8696a0]">Os agentes selecionados também visualizam esta conversa em “Minhas”.</p>
              <div className="max-h-36 space-y-1 overflow-y-auto">
                {conversationAgents.length ? conversationAgents.map((agent) => <button
                  key={agent.id}
                  type="button"
                  disabled={managementBusy || !onSetConversationParticipants}
                  onClick={() => void toggleConversationParticipant(agent.id)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${participantIds.includes(agent.id) ? 'border-[#00a884] bg-[#00a884] text-white' : 'border-[#8696a0]/60'}`}>{participantIds.includes(agent.id) && <Check className="h-3 w-3" />}</span>
                  <span className="min-w-0 flex-1 truncate">{agent.name}</span>
                  {conversation.assigneeId === agent.id && <span className="text-[10px] text-[#00a884]">principal</span>}
                </button>) : <p className="px-2 py-1 text-xs text-[#8696a0]">Nenhum agente disponível nesta caixa.</p>}
              </div>
            </div>

            <label className="mt-3 block border-t border-white/10 pt-3 text-[11px] text-[#8696a0]">Time
              <select
                value={conversation.teamId || ''}
                disabled={managementBusy || !onAssignConversationTeam}
                onChange={(event) => onAssignConversationTeam?.(event.target.value ? Number(event.target.value) : null)}
                className={`${input} mt-1 disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <option value="">Sem time</option>
                {conversationTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
            </label>

            <div className="mt-3 border-t border-white/10 pt-3">
              <div className="mb-1.5 flex items-center gap-1 text-[11px] font-semibold text-[#8696a0]"><Tag className="h-3.5 w-3.5" />Labels</div>
              <div className="max-h-32 space-y-1 overflow-y-auto">
                {conversationLabels.length ? conversationLabels.map((label) => <button
                  key={label.id}
                  type="button"
                  disabled={managementBusy || !onSetConversationLabels}
                  onClick={() => toggleConversationLabel(label.title)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: label.color || '#8696a0' }} />
                  <span className="min-w-0 flex-1 truncate">{label.title}</span>
                  {selectedLabels.has(label.title) && <Check className="h-3.5 w-3.5 text-[#00a884]" />}
                </button>) : <p className="px-2 py-1 text-xs text-[#8696a0]">Nenhuma label disponível.</p>}
              </div>
            </div>

          </section>}
        </div>}
        {tab === 'content' && <section><div className="mb-3 flex gap-1"><button type="button" onClick={() => setContentTab('media')} className={`rounded px-2 py-1 text-xs ${contentTab === 'media' ? 'bg-[#00a884] text-white' : 'text-[#8696a0]'}`}>Mídias</button><button type="button" onClick={() => setContentTab('links')} className={`rounded px-2 py-1 text-xs ${contentTab === 'links' ? 'bg-[#00a884] text-white' : 'text-[#8696a0]'}`}>Links</button><button type="button" onClick={() => setContentTab('documents')} className={`rounded px-2 py-1 text-xs ${contentTab === 'documents' ? 'bg-[#00a884] text-white' : 'text-[#8696a0]'}`}>Documentos</button></div>{contentTab !== 'links' && <div className="mb-3 grid grid-cols-2 gap-2"><label className="text-[10px] text-[#8696a0]">De<input type="date" value={attachmentDateFrom} onChange={event => setAttachmentDateFrom(event.target.value)} className={`${input} mt-1`} /></label><label className="text-[10px] text-[#8696a0]">Até<input type="date" value={attachmentDateTo} onChange={event => setAttachmentDateTo(event.target.value)} className={`${input} mt-1`} /></label></div>}{contentTab === 'links' && <><p className="mb-2 text-[10px] text-[#8696a0]">Links encontrados nas mensagens já carregadas.</p><input type="search" value={linkSearch} onChange={event => setLinkSearch(event.target.value)} placeholder="Pesquisar por URL ou domínio" aria-label="Pesquisar links" className={`${input} mb-3`} /></>}{attachmentStatus === 'loading' && contentTab !== 'links' ? <p className="text-xs text-[#8696a0]">Carregando anexos…</p> : attachmentStatus === 'error' && contentTab !== 'links' ? <div className="text-xs text-red-400">{attachmentError}<button type="button" onClick={onRetryAttachments} className="ml-2 text-[#00a884]">Tentar novamente</button></div> : contentTab === 'media' ? <div className="grid grid-cols-3 gap-2">{content.media.map(item => item.kind === 'image' ? <button key={item.id} type="button" onClick={() => onOpenImage?.(item.url, item.title || undefined)} className="relative aspect-square overflow-hidden rounded-lg bg-black/10"><img src={item.thumbnailUrl || item.url} alt={item.title || 'Imagem'} className="h-full w-full object-cover" /><span className="absolute inset-x-0 bottom-0 bg-black/60 px-1 py-0.5 text-[9px] text-white">{new Date(item.createdAt * 1000).toLocaleDateString()}</span></button> : <div key={item.id} className="relative aspect-square overflow-hidden rounded-lg bg-black/10"><video controls src={item.url} preload="metadata" className="h-full w-full object-cover" /><span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/60 px-1 py-0.5 text-[9px] text-white">{new Date(item.createdAt * 1000).toLocaleDateString()}</span></div>)}{!content.media.length && <p className="col-span-3 py-6 text-center text-xs text-[#8696a0]">Nenhuma mídia.</p>}</div> : contentTab === 'documents' ? <div className="space-y-2">{content.documents.map(item => <div key={item.id} className="flex items-center gap-2 rounded-lg border border-white/10 p-2"><FileText className="h-5 w-5 text-[#00a884]" /><span className="min-w-0 flex-1 truncate text-xs">{item.title || documentPresentation(item.title).label}{item.size ? ` · ${(item.size / 1024 / 1024).toFixed(1)} MB` : ''}<small className="mt-0.5 block text-[10px] text-[#8696a0]">Enviado em {new Date(item.createdAt * 1000).toLocaleString()}</small></span><button type="button" onClick={() => triggerAttachmentDownload(item.url, item.title || undefined)} title="Baixar arquivo"><Download className="h-4 w-4" /></button></div>)}{!content.documents.length && <p className="py-6 text-center text-xs text-[#8696a0]">Nenhum documento.</p>}</div> : <div className="space-y-2">{filteredLinks.map(url => <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block rounded-lg border border-white/10 p-2 text-xs text-[#53bdeb]"><span className="flex items-center gap-1"><Link className="h-3 w-3" />{new URL(url).hostname}</span><span className="mt-1 block truncate">{url}</span></a>)}{!content.links.length ? <p className="py-6 text-center text-xs text-[#8696a0]">Nenhum link nas mensagens carregadas.</p> : !filteredLinks.length && <p className="py-6 text-center text-xs text-[#8696a0]">Nenhum link encontrado.</p>}</div>}{hasMoreAttachments && contentTab !== 'links' && <button type="button" onClick={onLoadMoreAttachments} className="mt-3 text-xs font-semibold text-[#00a884]">Carregar mais</button>}</section>}
      </>}
    </div>
    {status === 'ready' && contact && <div className="border-t border-white/10 p-3"><button type="button" disabled={!hasChanges || isSaving} onClick={() => void save()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00a884] px-3 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Salvar alterações</button></div>}
  </div>;
};

const Field = ({ label, icon, value, onChange, inputClass }: { label: string; icon: ReactNode; value: string; onChange: (value: string) => void; inputClass: string }) => <div className="border-b border-white/10 pb-2"><span className="mb-1 flex items-center gap-2 text-[#8696a0]">{icon}{label}</span><input value={value} onChange={event => onChange(event.target.value)} className={inputClass} /></div>;
