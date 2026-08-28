import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, Loader2, LogOut, QrCode, RefreshCw, RotateCcw, Save, Trash2, Users, X } from 'lucide-react';
import type { AssignableAgent, Inbox } from '../domain/currentUser';
import { errorMessageForUser } from '../integrations/chatwoot/errors';
import { inboxService } from '../integrations/chatwoot/inboxes';
import { wahaClient, type WahaHistoryJob, type WahaHistoryRange, type WahaQrCode, type WahaSession } from '../integrations/waha/client';
import { MetaCloudSetup } from './MetaCloudSetup';

type Props = { accountId: number; inbox: Inbox; webhookUrl: string; isDarkMode: boolean; onSaved: () => Promise<void> | void };
const statusLabel: Record<string, string> = { STOPPED: 'Parada', STARTING: 'Iniciando', SCAN_QR_CODE: 'Aguardando QR Code', WORKING: 'Conectada', FAILED: 'Erro' };

export const WahaSetup = ({ accountId, inbox, isDarkMode, onSaved }: Props) => {
  const context = { accountId, inboxId: inbox.id };
  const [sessions, setSessions] = useState<WahaSession[]>([]);
  const [selected, setSelected] = useState(inbox.additionalAttributes.waha_session_name as string || '');
  const [newSession, setNewSession] = useState('');
  const [associatedSession, setAssociatedSession] = useState(inbox.additionalAttributes.waha_session_name as string || '');
  const [current, setCurrent] = useState<WahaSession | null>(null);
  const [qr, setQr] = useState<WahaQrCode | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'general' | 'collaborators' | 'unofficial' | 'official'>('general');
  const [inboxName, setInboxName] = useState(inbox.name);
  const [agents, setAgents] = useState<AssignableAgent[]>([]);
  const [members, setMembers] = useState<number[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [savingMembers, setSavingMembers] = useState(false);
  const [isCollaboratorPickerOpen, setIsCollaboratorPickerOpen] = useState(false);
  const [collaboratorQuery, setCollaboratorQuery] = useState('');
  const [historyRange, setHistoryRange] = useState<WahaHistoryRange>('30d');
  const [historyJob, setHistoryJob] = useState<WahaHistoryJob | null>(null);
  const [confirmAllHistory, setConfirmAllHistory] = useState(false);
  const card = isDarkMode ? 'border-[#2a3942] bg-[#182228]' : 'border-[#d1d7db] bg-[#f0f2f5]';

  const refresh = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      const result = await wahaClient.listSessions(context);
      setSessions(result.sessions);
      const name = selected || result.sessions[0]?.name || '';
      if (name) { setSelected(name); setCurrent(result.sessions.find(item => item.name === name) || await wahaClient.getSession(context, name).then(result => result.session)); }
    } catch (cause) { setError(errorMessageForUser(cause)); }
    finally { setBusy(false); }
  }, [accountId, inbox.id, selected]);
  useEffect(() => { void refresh(); }, []);
  useEffect(() => { setInboxName(inbox.name); }, [inbox.name]);
  useEffect(() => { setAssociatedSession(inbox.additionalAttributes.waha_session_name as string || ''); }, [inbox.additionalAttributes.waha_session_name]);
  useEffect(() => {
    let active = true;
    setMembersLoading(true);
    Promise.all([inboxService.listAgents(accountId), inboxService.listMembers(accountId, inbox.id)])
      .then(([availableAgents, inboxMembers]) => {
        if (!active) return;
        setAgents(availableAgents);
        setMembers(inboxMembers.map((agent) => agent.id));
      })
      .catch((cause) => { if (active) setError(errorMessageForUser(cause)); })
      .finally(() => { if (active) setMembersLoading(false); });
    return () => { active = false; };
  }, [accountId, inbox.id]);
  useEffect(() => {
    let active = true;
    void wahaClient.getCurrentHistoryImport(context)
      .then((result) => { if (active) setHistoryJob(result.job); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [accountId, inbox.id]);
  useEffect(() => {
    if (!historyJob || !['pending', 'running'].includes(historyJob.status)) return;
    const timer = window.setInterval(() => {
      void wahaClient.getHistoryImport(context, historyJob.id)
        .then((result) => setHistoryJob(result.job))
        .catch((cause) => setError(errorMessageForUser(cause)));
    }, 1500);
    return () => window.clearInterval(timer);
  }, [accountId, inbox.id, historyJob?.id, historyJob?.status]);

  const selectSession = async (name: string) => {
    setSelected(name); setQr(null); setBusy(true); setError(null);
    try { setCurrent((await wahaClient.getSession(context, name)).session); }
    catch (cause) { setError(errorMessageForUser(cause)); }
    finally { setBusy(false); }
  };
  const create = async () => {
    const name = newSession.trim(); if (!name || busy) return;
    setBusy(true); setError(null);
    try { const result = await wahaClient.createSession(context, name); setNewSession(''); setSelected(result.session.name); setCurrent(result.session); await refresh(); }
    catch (cause) { setError(errorMessageForUser(cause)); }
    finally { setBusy(false); }
  };
  const run = async (action: 'start' | 'restart' | 'logout' | 'delete' | 'qr') => {
    if (!selected || busy) return; setBusy(true); setError(null);
    try {
      if (action === 'start') setCurrent((await wahaClient.startSession(context, selected)).session);
      if (action === 'restart') setCurrent((await wahaClient.restartSession(context, selected)).session);
      if (action === 'logout') { await wahaClient.logoutSession(context, selected); setCurrent(null); setQr(null); }
      if (action === 'delete') { await wahaClient.deleteSession(context, selected); setSelected(''); setAssociatedSession(''); setCurrent(null); setQr(null); setSessions([]); await onSaved(); }
      if (action === 'qr') setQr(await wahaClient.getQrCode(context, selected));
    } catch (cause) { setError(errorMessageForUser(cause)); }
    finally { setBusy(false); }
  };
  const save = async () => {
    if (!selected || busy) return; setBusy(true); setError(null);
    try {
      await wahaClient.associateSession(context, selected);
      setAssociatedSession(selected);
      await onSaved();
    } catch (cause) { setError(errorMessageForUser(cause)); }
    finally { setBusy(false); }
  };
  const startHistoryImport = async () => {
    if (!isConnected || !isAssociated || busy) return;
    if (historyRange === 'all' && !confirmAllHistory) { setConfirmAllHistory(true); return; }
    setBusy(true); setError(null);
    try { setHistoryJob((await wahaClient.startHistoryImport(context, historyRange)).job); setConfirmAllHistory(false); }
    catch (cause) { setError(errorMessageForUser(cause)); }
    finally { setBusy(false); }
  };
  const cancelHistoryImport = async () => {
    if (!historyJob || busy) return;
    setBusy(true); setError(null);
    try { setHistoryJob((await wahaClient.cancelHistoryImport(context, historyJob.id)).job); }
    catch (cause) { setError(errorMessageForUser(cause)); }
    finally { setBusy(false); }
  };
  const saveInboxName = async () => {
    const name = inboxName.trim();
    if (!name || savingName) return;
    setSavingName(true); setError(null);
    try { await inboxService.updateName(accountId, inbox.id, name); await onSaved(); }
    catch (cause) { setError(errorMessageForUser(cause)); }
    finally { setSavingName(false); }
  };
  const toggleMember = (agentId: number) => setMembers((currentMembers) => currentMembers.includes(agentId) ? currentMembers.filter((id) => id !== agentId) : [...currentMembers, agentId]);
  const saveMembers = async () => {
    if (savingMembers) return;
    setSavingMembers(true); setError(null);
    try { const updated = await inboxService.setMembers(accountId, inbox.id, members); setMembers(updated.map((agent) => agent.id)); await onSaved(); }
    catch (cause) { setError(errorMessageForUser(cause)); }
    finally { setSavingMembers(false); }
  };
  const qrSrc = qr ? (qr.data.startsWith('data:') ? qr.data : `data:${qr.mimetype};base64,${qr.data}`) : null;
  const isConnected = current?.status === 'WORKING';
  const hasSession = sessions.length > 0;
  const isAssociated = selected.length > 0 && associatedSession === selected;
  const selectedAgents = agents.filter((agent) => members.includes(agent.id));
  const availableAgents = agents.filter((agent) => !members.includes(agent.id) && agent.name.toLocaleLowerCase().includes(collaboratorQuery.trim().toLocaleLowerCase()));
  // The collaborators list is an overlay. The card must not clip it when the
  // picker opens near the bottom of the settings panel.
  return <div className={`mx-auto max-w-3xl overflow-visible rounded-2xl border ${card}`}>
    <div className="border-b border-white/10 p-5"><h4 className="font-bold">Configurações da caixa de entrada</h4><p className="mt-1 text-xs text-[#8696a0]">Gerencie a inbox, colaboradores e as conexões WhatsApp.</p></div>
    <div className="flex gap-1 overflow-x-auto border-b border-white/10 px-4 pt-3">
      {([['general', 'Geral'], ['collaborators', 'Colaboradores'], ['unofficial', 'WhatsApp não oficial'], ['official', 'WhatsApp oficial']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setTab(value)} className={`whitespace-nowrap rounded-t-lg px-3 py-2 text-xs font-semibold ${tab === value ? 'bg-[#00a884] text-white' : 'text-[#8696a0] hover:bg-white/5 hover:text-[#e9edef]'}`}>{label}</button>)}
    </div>
    <div className="space-y-4 p-5">
    {error && <div className="flex gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
    {tab === 'general' && <section className="space-y-3"><div><h5 className="text-sm font-bold">Nome da caixa de entrada</h5><p className="mt-1 text-xs text-[#8696a0]">Este nome é exibido para a equipe na lista de canais.</p></div><div className="flex gap-2"><input value={inboxName} onChange={(event) => setInboxName(event.target.value)} maxLength={160} className={`min-w-0 flex-1 rounded-xl border px-3 py-3 text-sm ${isDarkMode ? 'border-[#2a3942] bg-[#111b21]' : 'border-gray-300 bg-white'}`} /><button type="button" onClick={() => void saveInboxName()} disabled={!inboxName.trim() || inboxName.trim() === inbox.name || savingName} className="rounded-xl bg-[#00a884] px-4 text-xs font-bold text-white disabled:opacity-40">{savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}<span className="sr-only">Salvar nome</span></button></div></section>}
    {tab === 'collaborators' && <section className="relative z-50"><div className="flex items-start justify-between gap-4"><div><h5 className="flex items-center gap-2 text-sm font-bold"><Users className="h-4 w-4 text-[#00a884]" />Colaboradores</h5><p className="mt-1 text-xs text-[#8696a0]">Escolha quem pode visualizar e atender as conversas desta caixa.</p></div><button type="button" onClick={() => void saveMembers()} disabled={membersLoading || savingMembers} className="shrink-0 rounded-lg bg-[#00a884] px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#008069] disabled:opacity-40">{savingMembers ? 'Salvando…' : 'Salvar alterações'}</button></div>
      <div className="mt-5 rounded-xl border border-white/10 bg-black/10 p-3">
        <label className="mb-2 block text-[11px] font-medium text-[#8696a0]">Agentes com acesso a esta caixa</label>
        {membersLoading ? <p className="p-3 text-xs text-[#8696a0]"><Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />Carregando agentes…</p> : <div className="relative">
          <div role="combobox" aria-expanded={isCollaboratorPickerOpen} tabIndex={0} onClick={() => setIsCollaboratorPickerOpen((open) => !open)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setIsCollaboratorPickerOpen((open) => !open); } }} className={`flex min-h-12 w-full cursor-pointer flex-wrap items-center gap-1.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${isCollaboratorPickerOpen ? 'border-[#00a884] ring-1 ring-[#00a884]/30' : 'border-white/10 hover:border-[#8696a0]/50'} ${isDarkMode ? 'bg-[#202c33]' : 'bg-white'}`}>
            {selectedAgents.length ? selectedAgents.map((agent) => <span key={agent.id} className="flex max-w-full items-center gap-1 rounded-md bg-[#2a3942] px-2 py-1 text-[11px] font-medium text-[#e9edef]" onClick={(event) => event.stopPropagation()}><span className="grid h-4 w-4 place-items-center overflow-hidden rounded-full bg-[#00a884]/20 text-[8px] text-[#00a884]">{agent.avatarUrl ? <img src={agent.avatarUrl} alt="" className="h-full w-full object-cover" /> : agent.name.slice(0, 2).toUpperCase()}</span><span className="max-w-32 truncate">{agent.name}</span><button type="button" onClick={() => toggleMember(agent.id)} aria-label={`Remover ${agent.name}`} className="rounded p-0.5 text-[#aebac1] hover:bg-white/10 hover:text-white"><X className="h-3 w-3" /></button></span>) : <span className="px-1 text-xs text-[#8696a0]">Selecione os agentes que terão acesso</span>}
            <ChevronDown className={`ml-auto h-4 w-4 shrink-0 text-[#8696a0] transition-transform ${isCollaboratorPickerOpen ? 'rotate-180' : ''}`} />
          </div>
          {isCollaboratorPickerOpen && <><button type="button" aria-label="Fechar seleção de colaboradores" onClick={() => setIsCollaboratorPickerOpen(false)} className="fixed inset-0 z-30 cursor-default" /><div className={`absolute z-40 mt-2 w-full overflow-hidden rounded-xl border shadow-2xl ${isDarkMode ? 'border-[#374248] bg-[#202c33]' : 'border-gray-200 bg-white'}`}><div className="border-b border-white/10 p-2"><input autoFocus value={collaboratorQuery} onChange={(event) => setCollaboratorQuery(event.target.value)} placeholder="Buscar agente…" className={`w-full rounded-lg border px-2.5 py-2 text-xs outline-none ${isDarkMode ? 'border-white/10 bg-[#111b21] text-white' : 'border-gray-200 bg-gray-50 text-[#111b21]'}`} /></div><div className="max-h-52 overflow-y-auto p-1.5">{availableAgents.length ? availableAgents.map((agent) => <button key={agent.id} type="button" onClick={() => { toggleMember(agent.id); setCollaboratorQuery(''); }} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs hover:bg-white/10"><span className="grid h-6 w-6 place-items-center overflow-hidden rounded-full bg-[#00a884]/20 text-[9px] font-bold text-[#00a884]">{agent.avatarUrl ? <img src={agent.avatarUrl} alt="" className="h-full w-full object-cover" /> : agent.name.slice(0, 2).toUpperCase()}</span>{agent.name}</button>) : <p className="p-3 text-center text-xs text-[#8696a0]">Nenhum outro agente encontrado.</p>}</div></div></>}
        </div>}
        <p className="mt-2 text-[11px] leading-4 text-[#8696a0]">Os agentes selecionados terão acesso às conversas desta inbox. Remova um agente para retirar o acesso.</p>
      </div>
    </section>}
    {tab === 'unofficial' && <section className="space-y-5">
      <div><h5 className="font-bold">Conexão WhatsApp não oficial</h5><p className="mt-1 text-xs text-[#8696a0]">Conecte uma sessão WAHA por QR Code. A conexão é privada desta inbox.</p></div>

      <div className="rounded-xl border border-white/10 p-4">
        <div className="mb-3 flex items-start gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#00a884] text-xs font-bold text-white">1</span><div><p className="text-xs font-bold">Conexão desta caixa</p><p className="mt-1 text-[11px] leading-4 text-[#8696a0]">Cada caixa permite apenas uma conexão WAHA. Para usar outro número, exclua primeiro a conexão atual.</p></div></div>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]"><select value={selected} disabled className={`rounded-xl border px-3 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-70 ${isDarkMode ? 'border-[#2a3942] bg-[#111b21]' : 'border-gray-300 bg-white'}`}><option value="">Nenhuma conexão criada</option>{sessions.map(session => <option key={session.name} value={session.name}>{session.name} · {statusLabel[session.status] || session.status}</option>)}</select><button type="button" onClick={() => void refresh()} disabled={busy} className="rounded-xl border border-[#00a884]/40 px-3 text-xs font-bold text-[#00a884]"><RefreshCw className={`inline h-4 w-4 ${busy ? 'animate-spin' : ''}`} /> Atualizar</button></div>
      </div>

      {!hasSession && <div className="rounded-xl border border-white/10 p-4">
        <div className="mb-3 flex items-start gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#00a884] text-xs font-bold text-white">2</span><div><p className="text-xs font-bold">Ou crie uma nova conexão</p><p className="mt-1 text-[11px] leading-4 text-[#8696a0]">Dê um nome interno para identificar este telefone, por exemplo: <b>WhatsApp-Vendas</b>. Em seguida você verá o QR Code para conectar o aparelho.</p></div></div>
        <div className="flex gap-2"><input value={newSession} onChange={event => setNewSession(event.target.value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80))} placeholder="Ex.: WhatsApp-Vendas" className={`min-w-0 flex-1 rounded-xl border px-3 py-3 text-sm ${isDarkMode ? 'border-[#2a3942] bg-[#111b21]' : 'border-gray-300 bg-white'}`} /><button type="button" onClick={() => void create()} disabled={!newSession || busy || hasSession} className="rounded-xl bg-[#00a884] px-4 text-xs font-bold text-white disabled:opacity-40">Criar conexão</button></div>
      </div>}

      {current && <div className={`rounded-xl border p-4 text-xs ${isConnected ? 'border-[#00a884]/35 bg-[#00a884]/10' : 'border-amber-500/30 bg-amber-500/10'}`}><div className="flex items-center justify-between gap-3"><div><p className="font-bold">{isConnected ? 'WhatsApp conectado' : 'WhatsApp ainda não conectado'}</p><p className="mt-1 text-[#8696a0]">{current.me?.id ? `Número conectado: ${current.me.id}` : `Conexão: ${current.name}`}</p></div><span className={`rounded-full px-2 py-1 text-[11px] font-bold ${isConnected ? 'bg-[#00a884]/20 text-[#00a884]' : 'bg-amber-500/20 text-amber-500'}`}>{statusLabel[current.status] || current.status}</span></div><p className="mt-3 text-[11px] text-[#8696a0]">Tecnologia: WAHA / {current.engine || 'GOWS'}</p></div>}

      {selected && <div className="rounded-xl border border-white/10 p-4"><div className="mb-3 flex items-start gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#00a884] text-xs font-bold text-white">3</span><div><p className="text-xs font-bold">Conecte ou administre o telefone</p><p className="mt-1 text-[11px] leading-4 text-[#8696a0]">Para uma conexão nova, inicie e abra o QR Code. Depois de escaneá-lo no celular, o status mudará para “Conectada”.</p></div></div><div className="flex flex-wrap gap-2">{!isConnected && <button type="button" onClick={() => void run('start')} disabled={busy} className="rounded-xl bg-[#00a884] px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Iniciar conexão</button>}<button type="button" onClick={() => void run('qr')} disabled={busy || isConnected} className="rounded-xl border border-[#00a884]/40 px-3 py-2 text-xs font-bold text-[#00a884] disabled:opacity-40"><QrCode className="inline h-4 w-4" /> {qrSrc ? 'Atualizar QR Code' : 'Mostrar QR Code'}</button><button type="button" onClick={() => void run('restart')} disabled={busy} className="rounded-xl border border-[#00a884]/40 px-3 py-2 text-xs font-bold text-[#00a884] disabled:opacity-40"><RotateCcw className="inline h-4 w-4" /> Reconectar</button><button type="button" onClick={() => void run('logout')} disabled={busy} className="rounded-xl border border-red-500/40 px-3 py-2 text-xs font-bold text-red-400 disabled:opacity-40"><LogOut className="inline h-4 w-4" /> Desconectar WhatsApp</button><button type="button" onClick={() => { if (window.confirm('Excluir esta conexão? Será necessário criar e conectar uma nova sessão.')) void run('delete'); }} disabled={busy} className="rounded-xl border border-red-500/40 px-3 py-2 text-xs font-bold text-red-400 disabled:opacity-40"><Trash2 className="inline h-4 w-4" /> Excluir conexão</button></div></div>}
      {qrSrc && <div className="rounded-xl bg-white p-4 text-center"><img src={qrSrc} alt="QR Code do WhatsApp" className="mx-auto max-h-64 max-w-full" /><p className="mt-2 text-xs text-slate-600">No celular: WhatsApp → aparelhos conectados → conectar um aparelho. Aponte a câmera para este QR Code.</p></div>}
      {selected && <><button type="button" onClick={() => void save()} disabled={busy || isAssociated} className="flex w-full justify-center gap-2 rounded-xl bg-[#00a884] py-3 text-xs font-bold text-white disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />}<CheckCircle2 className="h-4 w-4" />{isAssociated ? 'Esta conexão já está vinculada à caixa' : 'Usar esta conexão nesta caixa'}</button>
      {!isAssociated && <p className="-mt-3 text-center text-[11px] text-[#8696a0]">Só clique depois de confirmar que este é o WhatsApp correto para esta caixa.</p>}
    <div className="rounded-xl border border-white/10 bg-black/10 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold">Histórico do WhatsApp</p><p className="mt-1 max-w-xl text-xs leading-5 text-[#8696a0]">Importe manualmente as mensagens que já foram sincronizadas pelo WhatsApp nesta sessão. O histórico disponível depende do que o WhatsApp sincronizou com esta sessão.</p></div>{isConnected ? <span className="rounded-full bg-[#00a884]/15 px-2 py-1 text-[11px] font-semibold text-[#00a884]">Sessão conectada</span> : <span className="rounded-full bg-amber-500/15 px-2 py-1 text-[11px] font-semibold text-amber-500">Conecte a sessão para importar</span>}</div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row"><select value={historyRange} onChange={(event) => { setHistoryRange(event.target.value as WahaHistoryRange); setConfirmAllHistory(false); }} disabled={!isConnected || !isAssociated || busy || ['pending', 'running'].includes(historyJob?.status || '')} className={`min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-sm ${isDarkMode ? 'border-[#2a3942] bg-[#111b21]' : 'border-gray-300 bg-white'}`}><option value="7d">Últimos 7 dias</option><option value="30d">Últimos 30 dias</option><option value="90d">Últimos 90 dias</option><option value="all">Tudo disponível</option></select><button type="button" onClick={() => void startHistoryImport()} disabled={!isConnected || !isAssociated || busy || ['pending', 'running'].includes(historyJob?.status || '')} className="rounded-xl bg-[#00a884] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40">{historyRange === 'all' && !confirmAllHistory ? 'Continuar' : historyJob && ['pending', 'running'].includes(historyJob.status) ? 'Importando…' : confirmAllHistory ? 'Confirmar importação' : 'Importar histórico'}</button></div>
      {historyRange === 'all' && confirmAllHistory && <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] leading-4 text-amber-500">Esta operação pode importar muitas mensagens e mídias. Clique em “Confirmar importação” para iniciar.</p>}
      {historyJob && <div className={`mt-4 rounded-xl border p-3 text-xs ${historyJob.status === 'failed' ? 'border-red-500/30 bg-red-500/10' : historyJob.status === 'completed' ? 'border-[#00a884]/30 bg-[#00a884]/10' : 'border-white/10 bg-white/5'} `}><div className="flex items-center justify-between gap-3"><p className="font-semibold">{historyJob.status === 'completed' ? 'Importação concluída' : historyJob.status === 'failed' ? 'Importação finalizada com erro' : historyJob.status === 'cancelled' ? 'Importação cancelada' : 'Importando histórico…'}</p><div className="flex items-center gap-2"><span className="text-[#8696a0]">{historyJob.processed} processadas</span>{['pending', 'running'].includes(historyJob.status) && <button type="button" onClick={() => void cancelHistoryImport()} disabled={busy} className="rounded-md border border-red-500/40 px-2 py-1 text-[11px] font-semibold text-red-400 disabled:opacity-40">Cancelar</button>}</div></div><div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[#8696a0] sm:grid-cols-3"><span>Conversas: {historyJob.conversations}</span><span>Importadas: {historyJob.imported}</span><span>Já existentes: {historyJob.duplicates}</span><span>Ignoradas: {historyJob.skipped}</span><span>Falhas: {historyJob.failed}</span><span>Mídias: {historyJob.mediaImported}{historyJob.mediaFailed ? ` (${historyJob.mediaFailed} falhas)` : ''}</span></div>{historyJob.lastError && <p className="mt-2 text-red-400">{historyJob.lastError}</p>}</div>}
    </div></>}
    </section>}
    {tab === 'official' && <section><MetaCloudSetup accountId={accountId} inbox={inbox} webhookUrl={webhookUrl} isDarkMode={isDarkMode} onSaved={async () => { await onSaved(); }} /></section>}
    </div>
  </div>;
};
