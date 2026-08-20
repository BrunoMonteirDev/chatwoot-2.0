import { Check, CircleAlert, Loader2, MoreVertical, Tag, UserRound } from 'lucide-react';
import { useState } from 'react';
import type { ConversationManagementCatalogs } from '../integrations/chatwoot/conversationManagement';
import type { ConversationPriority, ConversationSummary } from '../domain/currentUser';

interface Props {
  conversation: ConversationSummary;
  catalogs: ConversationManagementCatalogs;
  catalogStatus: 'idle' | 'loading' | 'ready' | 'error';
  catalogError: string | null;
  pendingAction: string | null;
  onRetryCatalogs: () => void;
  onSetPriority: (priority: ConversationPriority) => void;
  onAssignAgent: (agentId: number | null) => void;
  onAssignTeam: (teamId: number | null) => void;
  onSetLabels: (labels: string[]) => void;
  onMarkRead: () => void;
  onMarkUnread: () => void;
}

const priorityOptions: { value: ConversationPriority; label: string }[] = [
  { value: null, label: 'Sem prioridade' }, { value: 'low', label: 'Baixa' }, { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' }, { value: 'urgent', label: 'Urgente' },
];

export const ConversationManagementMenu = ({
  conversation, catalogs, catalogStatus, catalogError, pendingAction, onRetryCatalogs,
  onSetPriority, onAssignAgent, onAssignTeam, onSetLabels, onMarkRead, onMarkUnread,
}: Props) => {
  const [open, setOpen] = useState(false);
  const busy = pendingAction !== null;
  const selectedLabels = new Set(conversation.labels);
  const toggleLabel = (title: string) => {
    const next = new Set(selectedLabels);
    next.has(title) ? next.delete(title) : next.add(title);
    onSetLabels([...next]);
  };
  const selectClass = 'w-full rounded-md border border-white/10 bg-black/10 px-2 py-1.5 text-xs text-inherit outline-none disabled:opacity-60 dark:bg-black/20';

  return (
    <div className="relative">
      <button type="button" title="Gerenciar conversa" aria-label="Gerenciar conversa" disabled={busy}
        onClick={() => setOpen((current) => !current)}
        className="w-10 h-10 flex items-center justify-center rounded-full transition-colors disabled:opacity-50 hover:bg-[#2a3942]">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreVertical className="w-5 h-5" />}
      </button>
      {open && <>
        <button type="button" aria-label="Fechar menu de gerenciamento" onClick={() => setOpen(false)} className="fixed inset-0 z-40 cursor-default" />
        <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-xl border border-[#374248] bg-[#182228] p-3 text-[#e9edef] shadow-2xl">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#aebac1]"><UserRound className="w-3.5 h-3.5" /> Gerenciar conversa</div>
          {catalogStatus === 'loading' && <div className="py-4 text-center text-xs text-[#aebac1]"><Loader2 className="mr-1 inline w-3.5 h-3.5 animate-spin" />Carregando opções…</div>}
          {catalogStatus === 'error' && <div className="rounded-lg bg-red-500/10 p-2 text-xs text-red-200"><CircleAlert className="mr-1 inline w-3.5 h-3.5" />{catalogError}<button type="button" onClick={onRetryCatalogs} className="ml-1 font-semibold underline">Tentar novamente</button></div>}
          {catalogStatus === 'ready' && <div className="space-y-3">
            <label className="block text-[11px] text-[#aebac1]">Prioridade
              <select value={conversation.priority || ''} disabled={busy} onChange={(event) => onSetPriority((event.target.value || null) as ConversationPriority)} className={selectClass}>
                {priorityOptions.map((option) => <option key={option.value || 'none'} value={option.value || ''}>{option.label}</option>)}
              </select>
            </label>
            <label className="block text-[11px] text-[#aebac1]">Responsável
              <select value={conversation.assigneeId || ''} disabled={busy} onChange={(event) => onAssignAgent(event.target.value ? Number(event.target.value) : null)} className={selectClass}>
                <option value="">Não atribuído</option>
                {catalogs.agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
              </select>
            </label>
            <label className="block text-[11px] text-[#aebac1]">Equipe
              <select value={conversation.teamId || ''} disabled={busy} onChange={(event) => onAssignTeam(event.target.value ? Number(event.target.value) : null)} className={selectClass}>
                <option value="">Sem equipe</option>
                {catalogs.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
              </select>
            </label>
            <div className="border-t border-white/10 pt-2"><div className="mb-1 flex items-center gap-1 text-[11px] text-[#aebac1]"><Tag className="w-3.5 h-3.5" />Labels</div>
              <div className="max-h-28 space-y-1 overflow-y-auto">
                {catalogs.labels.length ? catalogs.labels.map((label) => <button key={label.id} type="button" disabled={busy} onClick={() => toggleLabel(label.title)} className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-xs hover:bg-white/10 disabled:opacity-60">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: label.color || '#8696a0' }} />{label.title}
                  {selectedLabels.has(label.title) && <Check className="ml-auto h-3.5 w-3.5 text-[#00a884]" />}
                </button>) : <span className="text-xs text-[#8696a0]">Nenhuma label disponível.</span>}
              </div>
            </div>
          </div>}
        </div>
      </>}
    </div>
  );
};
