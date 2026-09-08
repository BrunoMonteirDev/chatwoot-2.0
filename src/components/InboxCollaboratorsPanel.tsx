import { ChevronDown, Loader2, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { AssignableAgent } from '../domain/currentUser';
import { errorMessageForUser } from '../integrations/chatwoot/errors';
import { inboxService } from '../integrations/chatwoot/inboxes';

interface Props {
  accountId: number;
  inboxId: number;
  isDarkMode: boolean;
  onSaved?: () => Promise<void> | void;
}

export const InboxCollaboratorsPanel = ({ accountId, inboxId, isDarkMode, onSaved }: Props) => {
  const [agents, setAgents] = useState<AssignableAgent[]>([]);
  const [members, setMembers] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([inboxService.listAgents(accountId), inboxService.listMembers(accountId, inboxId)])
      .then(([availableAgents, inboxMembers]) => {
        if (!active) return;
        setAgents(availableAgents);
        setMembers(inboxMembers.map((agent) => agent.id));
      })
      .catch((cause) => { if (active) setError(errorMessageForUser(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [accountId, inboxId]);

  const toggleMember = (agentId: number) => setMembers((current) => current.includes(agentId) ? current.filter((id) => id !== agentId) : [...current, agentId]);
  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await inboxService.setMembers(accountId, inboxId, members);
      setMembers(updated.map((agent) => agent.id));
      await onSaved?.();
    } catch (cause) {
      setError(errorMessageForUser(cause));
    } finally {
      setSaving(false);
    }
  };

  const selectedAgents = agents.filter((agent) => members.includes(agent.id));
  const availableAgents = agents.filter((agent) => !members.includes(agent.id) && agent.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

  return <section className="relative z-50"><div className="flex items-start justify-between gap-4"><div><h5 className="flex items-center gap-2 text-sm font-bold"><Users className="h-4 w-4 text-[#00a884]" />Colaboradores</h5><p className="mt-1 text-xs text-[#8696a0]">Escolha quem pode visualizar e atender as conversas desta caixa.</p></div><button type="button" onClick={() => void save()} disabled={loading || saving} className="shrink-0 rounded-lg bg-[#00a884] px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#008069] disabled:opacity-40">{saving ? 'Salvando…' : 'Salvar alterações'}</button></div>
    {error && <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">{error}</p>}
    <div className="mt-5 rounded-xl border border-white/10 bg-black/10 p-3">
      <label className="mb-2 block text-[11px] font-medium text-[#8696a0]">Agentes com acesso a esta caixa</label>
      {loading ? <p className="p-3 text-xs text-[#8696a0]"><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />Carregando agentes…</p> : <div className="relative">
        <div role="combobox" aria-expanded={pickerOpen} tabIndex={0} onClick={() => setPickerOpen((open) => !open)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setPickerOpen((open) => !open); } }} className={`flex min-h-12 w-full cursor-pointer flex-wrap items-center gap-1.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${pickerOpen ? 'border-[#00a884] ring-1 ring-[#00a884]/30' : 'border-white/10 hover:border-[#8696a0]/50'} ${isDarkMode ? 'bg-[#202c33]' : 'bg-white'}`}>
          {selectedAgents.length ? selectedAgents.map((agent) => <span key={agent.id} className="flex max-w-full items-center gap-1 rounded-md bg-[#2a3942] px-2 py-1 text-[11px] font-medium text-[#e9edef]" onClick={(event) => event.stopPropagation()}><span className="grid h-4 w-4 place-items-center overflow-hidden rounded-full bg-[#00a884]/20 text-[8px] text-[#00a884]">{agent.avatarUrl ? <img src={agent.avatarUrl} alt="" className="h-full w-full object-cover" /> : agent.name.slice(0, 2).toUpperCase()}</span><span className="max-w-32 truncate">{agent.name}</span><button type="button" onClick={() => toggleMember(agent.id)} aria-label={`Remover ${agent.name}`} className="rounded p-0.5 text-[#aebac1] hover:bg-white/10 hover:text-white"><X className="h-3 w-3" /></button></span>) : <span className="px-1 text-xs text-[#8696a0]">Selecione os agentes que terão acesso</span>}
          <ChevronDown className={`ml-auto h-4 w-4 shrink-0 text-[#8696a0] transition-transform ${pickerOpen ? 'rotate-180' : ''}`} />
        </div>
        {pickerOpen && <><button type="button" aria-label="Fechar seleção de colaboradores" onClick={() => setPickerOpen(false)} className="fixed inset-0 z-30 cursor-default" /><div className={`absolute z-40 mt-2 w-full overflow-hidden rounded-xl border shadow-2xl ${isDarkMode ? 'border-[#374248] bg-[#202c33]' : 'border-gray-200 bg-white'}`}><div className="border-b border-white/10 p-2"><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar agente…" className={`w-full rounded-lg border px-2.5 py-2 text-xs outline-none ${isDarkMode ? 'border-white/10 bg-[#111b21] text-white' : 'border-gray-200 bg-gray-50 text-[#111b21]'}`} /></div><div className="max-h-52 overflow-y-auto p-1.5">{availableAgents.length ? availableAgents.map((agent) => <button key={agent.id} type="button" onClick={() => { toggleMember(agent.id); setQuery(''); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs hover:bg-white/10"><span className="grid h-6 w-6 place-items-center overflow-hidden rounded-full bg-[#00a884]/20 text-[9px] font-bold text-[#00a884]">{agent.avatarUrl ? <img src={agent.avatarUrl} alt="" className="h-full w-full object-cover" /> : agent.name.slice(0, 2).toUpperCase()}</span>{agent.name}</button>) : <p className="p-3 text-center text-xs text-[#8696a0]">Nenhum outro agente encontrado.</p>}</div></div></>}
      </div>}
      <p className="mt-2 text-[11px] leading-4 text-[#8696a0]">Os agentes selecionados terão acesso às conversas desta inbox. Remova um agente para retirar o acesso.</p>
    </div>
  </section>;
};
