import { Check, Edit2, FileText, Loader2, Mail, Phone, RefreshCw, Save, Tag, User, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import type { AccountLabel, AssignableAgent, ContactNote, ContactProfile, ConversationPriority, ConversationSummary, ConversationTeam } from '../domain/currentUser';
import type { ContactUpdate } from '../integrations/chatwoot/contacts';

interface Props {
  contact: ContactProfile | null;
  notes: ContactNote[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  isSaving: boolean;
  isCreatingNote: boolean;
  isDarkMode: boolean;
  initialTab?: 'contact' | 'attributes';
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
}

const stringify = (value: Record<string, unknown>) => JSON.stringify(value, null, 2);

const priorityOptions: { value: ConversationPriority; label: string }[] = [
  { value: null, label: 'Sem prioridade' },
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' },
  { value: 'urgent', label: 'Urgente' },
];

export const ContactDetailsPanel = ({ contact, notes, status, error, isSaving, isCreatingNote, isDarkMode, initialTab = 'contact', conversation = null, conversationLabels = [], conversationAgents = [], conversationTeams = [], conversationParticipants = [], managementPendingAction = null, onSetConversationPriority, onAssignConversationAgent, onAssignConversationTeam, onSetConversationLabels, onSetConversationParticipants, onClose, onRetry, onUpdate, onCreateNote }: Props) => {
  const [tab, setTab] = useState<'contact' | 'attributes'>(initialTab);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: '', email: '', phoneNumber: '', identifier: '', companyName: '' });
  const [additionalText, setAdditionalText] = useState('{}');
  const [customText, setCustomText] = useState('{}');
  const [noteText, setNoteText] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

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
  const toggleConversationLabel = (title: string) => {
    if (!onSetConversationLabels) return;
    const next = new Set(selectedLabels);
    next.has(title) ? next.delete(title) : next.add(title);
    onSetConversationLabels([...next]);
  };
  const participantIds = conversationParticipants.map((participant) => participant.id);
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
    try {
      const additionalAttributes = JSON.parse(additionalText) as Record<string, unknown>;
      const customAttributes = JSON.parse(customText) as Record<string, unknown>;
      await onUpdate({ name: draft.name.trim(), email: draft.email.trim() || null, phoneNumber: draft.phoneNumber.trim() || null, identifier: draft.identifier.trim() || null, companyName: draft.companyName.trim() || null, additionalAttributes, customAttributes });
      setEditing(false); setFeedback('Contato salvo.');
    } catch { setFeedback('Não foi possível salvar. Revise os atributos JSON e tente novamente.'); }
  };
  const addNote = async () => {
    try {
      const note = await onCreateNote(noteText);
      if (note) { setNoteText(''); setFeedback('Nota adicionada.'); }
    } catch { setFeedback('Não foi possível adicionar a nota.'); }
  };

  return <div className={`h-full w-[380px] max-w-[90vw] shrink-0 border-l flex flex-col z-30 ${surface}`}>
    <div className={`h-14 px-3 flex items-center justify-between border-b shrink-0 ${isDarkMode ? 'bg-[#151717] border-[#1e1f1f]' : 'bg-[#f0f2f5] border-[#d1d7db]'}`}>
      <div className="flex items-center gap-2"><button type="button" onClick={onClose} title="Fechar painel" className="p-1.5 rounded-full hover:bg-white/10"><X className="w-5 h-5 text-[#8696a0]" /></button><span className="font-bold text-sm">Dados do contato</span></div>
      {contact && <button type="button" disabled={isSaving} onClick={() => editing ? void save() : setEditing(true)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[#00a884] hover:bg-[#00a884]/10 disabled:opacity-50">{isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : editing ? <Save className="w-3.5 h-3.5" /> : <Edit2 className="w-3.5 h-3.5" />}{editing ? 'Salvar' : 'Editar'}</button>}
    </div>
    <div className="p-3 flex gap-1 border-b border-white/10"><button type="button" onClick={() => setTab('contact')} className={`px-3 py-1 rounded-md text-xs font-semibold ${tab === 'contact' ? 'bg-[#00a884] text-white' : 'text-[#8696a0]'}`}>Dados</button><button type="button" onClick={() => setTab('attributes')} className={`px-3 py-1 rounded-md text-xs font-semibold ${tab === 'attributes' ? 'bg-[#00a884] text-white' : 'text-[#8696a0]'}`}>Atributos</button></div>
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {status === 'loading' && <div className="py-12 text-center text-sm text-[#8696a0]"><Loader2 className="inline w-4 h-4 animate-spin mr-2" />Carregando contato…</div>}
      {status === 'error' && <div className="py-12 text-center text-sm text-red-300">{error}<button type="button" onClick={onRetry} className="block mx-auto mt-3 text-[#00a884] font-semibold"><RefreshCw className="inline w-3.5 h-3.5 mr-1" />Tentar novamente</button></div>}
      {status === 'ready' && contact && <>
        {feedback && <div className="rounded-lg bg-[#00a884]/10 p-2 text-xs text-[#7de2cc]">{feedback}</div>}
        {tab === 'contact' && <>
          <div className="flex flex-col items-center gap-2 text-center"><div className="w-20 h-20 rounded-full overflow-hidden bg-[#00a884] flex items-center justify-center text-white text-xl font-bold">{contact.avatarUrl ? <img src={contact.avatarUrl} alt={contact.name} className="w-full h-full object-cover" /> : contact.name.slice(0, 2).toUpperCase()}</div>{editing ? <input value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} className={`${input} text-center font-semibold`} /> : <h2 className="font-bold text-base">{contact.name}</h2>}</div>
          <div className="space-y-3 text-xs">
            <Field label="Telefone" icon={<Phone className="w-4 h-4" />} editing={editing} value={draft.phoneNumber} display={contact.phoneNumber || 'Não informado'} onChange={value => setDraft({ ...draft, phoneNumber: value })} inputClass={input} />
            <Field label="E-mail" icon={<Mail className="w-4 h-4" />} editing={editing} value={draft.email} display={contact.email || 'Não informado'} onChange={value => setDraft({ ...draft, email: value })} inputClass={input} />
            <Field label="Identificador" icon={<Tag className="w-4 h-4" />} editing={editing} value={draft.identifier} display={contact.identifier || 'Não informado'} onChange={value => setDraft({ ...draft, identifier: value })} inputClass={input} />
            <Field label="Empresa" icon={<User className="w-4 h-4" />} editing={editing} value={draft.companyName} display={contact.companyName || 'Não informada'} onChange={value => setDraft({ ...draft, companyName: value })} inputClass={input} />
          </div>
          <div className="border-t border-white/10 pt-3"><div className="mb-2 flex items-center gap-1 text-xs font-bold"><FileText className="w-4 h-4 text-[#00a884]" />Notas</div><textarea value={noteText} onChange={event => setNoteText(event.target.value)} disabled={isCreatingNote} placeholder="Adicionar nota interna sobre o contato…" className={`${input} min-h-16 resize-y`} /><button type="button" disabled={!noteText.trim() || isCreatingNote} onClick={() => void addNote()} className="mt-2 rounded-lg bg-[#00a884] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{isCreatingNote ? 'Salvando…' : 'Adicionar nota'}</button><div className="mt-3 space-y-2">{notes.length ? notes.map(note => <div key={note.id} className="rounded-lg bg-black/10 p-2.5 text-xs"><p className="whitespace-pre-wrap">{note.content}</p><span className="mt-1 block text-[10px] text-[#8696a0]">{note.authorName || 'Agente'} · {new Date(note.createdAt * 1000).toLocaleString()}</span></div>) : <p className="text-xs text-[#8696a0]">Nenhuma nota para este contato.</p>}</div></div>
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
      </>}
    </div>
  </div>;
};

const Field = ({ label, icon, editing, value, display, onChange, inputClass }: { label: string; icon: ReactNode; editing: boolean; value: string; display: string; onChange: (value: string) => void; inputClass: string }) => <div className="border-b border-white/10 pb-2"><span className="mb-1 flex items-center gap-2 text-[#8696a0]">{icon}{label}</span>{editing ? <input value={value} onChange={event => onChange(event.target.value)} className={inputClass} /> : <span className="block pl-6 text-[#e9edef] break-all">{display}</span>}</div>;
