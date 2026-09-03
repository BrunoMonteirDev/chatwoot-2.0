import { AlertCircle, Link2, Loader2, QrCode, RefreshCw, RotateCcw, Unlink } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Inbox } from '../domain/currentUser';
import { errorMessageForUser } from '../integrations/chatwoot/errors';
import { inboxService, type HybridWahaBinding, type HybridWahaConfiguration, type HybridWahaQr, type HybridWahaSession } from '../integrations/chatwoot/inboxes';

type Props = { accountId: number; inbox: Inbox; isDarkMode: boolean; onChanged: () => Promise<void> | void };

const metaLabel = (inbox: Inbox) => ({ connected: 'Conectado', connecting: 'Conectando', disconnected: 'Desconectado', error: 'Erro' }[String(inbox.additionalAttributes.meta_connection_status)] || 'Conectado');
const wahaLabel = (status: HybridWahaBinding['wahaStatus']) => ({ connected: 'Conectado', connecting: 'Conectando', disconnected: 'Desconectado', error: 'Erro', missing: 'Sessão não encontrada no WAHA', not_bound: 'Não vinculado' }[status]);

export const HybridWhatsAppInboxConfig = ({ accountId, inbox, isDarkMode, onChanged }: Props) => {
  const [configuration, setConfiguration] = useState<HybridWahaConfiguration | null>(null);
  const [binding, setBinding] = useState<HybridWahaBinding | null>(null);
  const [session, setSession] = useState('');
  const [sessions, setSessions] = useState<HybridWahaSession[]>([]);
  const [managed, setManaged] = useState<HybridWahaSession | null>(null);
  const [connectingSession, setConnectingSession] = useState<string | null>(null);
  const [qr, setQr] = useState<HybridWahaQr | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const card = isDarkMode ? 'border-[#2a3942] bg-[#111b21]' : 'border-gray-300 bg-white';

  const refresh = useCallback(async (preferredSession?: string) => {
    const [nextConfiguration, nextBinding] = await Promise.all([
      inboxService.hybridWahaConfiguration(accountId, inbox.id),
      inboxService.hybridWahaBinding(accountId, inbox.id),
    ]);
    const nextSessions = await inboxService.listHybridWahaSessions(accountId, inbox.id);
    const managedSession = nextBinding.wahaSession || preferredSession;
    setConfiguration(nextConfiguration); setBinding(nextBinding); setSessions(nextSessions); setSession(managedSession || '');
    setManaged(nextSessions.find(item => item.name === managedSession) || null);
  }, [accountId, inbox.id]);

  useEffect(() => { void refresh().catch(cause => setError(errorMessageForUser(cause))); }, [refresh]);

  const saveConfiguration = async (patch: Partial<HybridWahaConfiguration>) => {
    if (!configuration || busy) return;
    setBusy(true); setError(null);
    try {
      const saved = await inboxService.saveHybridWahaConfiguration(accountId, inbox.id, {
        hybridEnabled: patch.hybridEnabled ?? configuration.hybridEnabled,
        outOfWindowStrategy: patch.outOfWindowStrategy ?? configuration.outOfWindowStrategy,
        metaFailureStrategy: patch.metaFailureStrategy ?? configuration.metaFailureStrategy,
      });
      setConfiguration(saved); await refresh(); await onChanged();
    } catch (cause) { setError(errorMessageForUser(cause)); }
    finally { setBusy(false); }
  };

  const bindingAttempt = useRef<string | null>(null);
  const bindConnected = async (name: string) => {
    if (binding?.wahaSession === name || bindingAttempt.current === name) return;
    bindingAttempt.current = name;
    setBusy(true); setError(null);
    try { await inboxService.bindHybridWahaSession(accountId, inbox.id, name); await refresh(name); await onChanged(); setConnectingSession(null); }
    catch (cause) { setError(errorMessageForUser(cause)); setConnectingSession(null); }
    finally { bindingAttempt.current = null; setBusy(false); }
  };

  const showQr = async (name: string) => {
    const result = await inboxService.operateHybridWahaSession(accountId, inbox.id, name, 'qr');
    if (result.session) setManaged(result.session); if (result.qr) setQr(result.qr);
  };

  const connectSession = async (name: string) => {
    if (busy) return;
    setBusy(true); setError(null); setQr(null); setConnectingSession(name);
    try {
      let current = await inboxService.hybridWahaSessionStatus(accountId, inbox.id, name);
      setManaged(current);
      if (current.connectionStatus === 'connected') { setBusy(false); await bindConnected(name); return; }
      if (current.connectionStatus === 'missing') throw new Error('A sessão WAHA não foi encontrada.');
      if (current.connectionStatus !== 'connecting') {
        const result = await inboxService.operateHybridWahaSession(accountId, inbox.id, name, 'restart');
        current = result.session || await inboxService.hybridWahaSessionStatus(accountId, inbox.id, name);
        setManaged(current);
      }
      if (current.connectionStatus !== 'connected') await showQr(name);
    } catch (cause) { setError(errorMessageForUser(cause)); setConnectingSession(null); }
    finally { setBusy(false); }
  };

  const unbind = async () => {
    if (busy || !binding?.wahaSession) return;
    setBusy(true); setError(null);
    try { await inboxService.unbindHybridWahaSession(accountId, inbox.id); await refresh(); await onChanged(); }
    catch (cause) { setError(errorMessageForUser(cause)); }
    finally { setBusy(false); }
  };

  const createAndConnect = async () => {
    if (busy) return;
    setBusy(true); setError(null);
    try { const created = await inboxService.createHybridWahaSession(accountId, inbox.id); setManaged(created); setSession(created.name); setBusy(false); await connectSession(created.name); await refresh(created.name); }
    catch (cause) { setError(errorMessageForUser(cause)); }
    finally { setBusy(false); }
  };

  const operate = async (operation: 'start' | 'restart' | 'logout' | 'qr') => {
    const name = binding?.wahaSession || managed?.name || session;
    if (!name || busy) return;
    setBusy(true); setError(null);
    try { const result = await inboxService.operateHybridWahaSession(accountId, inbox.id, name, operation); if (result.session) setManaged(result.session); if (result.qr) setQr(result.qr); await refresh(); await onChanged(); }
    catch (cause) { setError(errorMessageForUser(cause)); }
    finally { setBusy(false); }
  };

  const deleteSession = async () => {
    const name = binding?.wahaSession || managed?.name;
    if (!name || busy) return;
    setBusy(true); setError(null);
    try { await inboxService.deleteHybridWahaSession(accountId, inbox.id, name); setConfirmDelete(false); setManaged(null); setQr(null); await refresh(); await onChanged(); }
    catch (cause) { setError(errorMessageForUser(cause)); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    const name = connectingSession;
    if (!name) return;
    const poll = async () => {
      try {
        const next = await inboxService.hybridWahaSessionStatus(accountId, inbox.id, name);
        setManaged(next);
        if (next.connectionStatus === 'connected') await bindConnected(name);
      } catch (cause) { setError(errorMessageForUser(cause)); }
    };
    void poll();
    const timer = window.setInterval(() => { void poll(); }, 3000);
    return () => window.clearInterval(timer);
  }, [accountId, connectingSession, inbox.id]);

  if (!configuration || !binding) return <div className={`rounded-xl border p-4 text-xs text-[#8696a0] ${card}`}><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Carregando modo híbrido…</div>;

  return <section className={`space-y-4 rounded-xl border p-4 ${card}`} data-testid="hybrid-whatsapp-config">
    <div><h4 className="text-sm font-bold">Modo híbrido</h4><p className="mt-1 text-xs text-[#8696a0]">O backend decide automaticamente entre Meta e WAHA. Não há seletor de provedor no composer.</p></div>
    <label className="flex cursor-pointer items-center justify-between gap-3 text-xs font-semibold"><span>Meta + WAHA</span><input aria-label="Meta + WAHA" type="checkbox" checked={configuration.hybridEnabled} disabled={busy} onChange={event => void saveConfiguration({ hybridEnabled: event.target.checked })} /></label>
    <>
      <div className="rounded-lg border border-white/10 p-3 text-xs"><div className="flex items-center justify-between gap-2"><span className="font-semibold">Sessão WAHA</span><span className="text-[#8696a0]">{binding.wahaSession || 'Nenhuma sessão vinculada'} · {wahaLabel(binding.wahaStatus)}</span></div>{managed?.me?.id && <p className="mt-1 text-[#8696a0]">{managed.me.id}</p>}{connectingSession && <p className="mt-2 text-[#8696a0]">{managed?.connectionStatus === 'connected' ? 'Validando número conectado…' : qr ? 'Aguardando leitura do QR Code' : 'Iniciando sessão…'}</p>}<div className="mt-3 flex flex-wrap gap-2">{!binding.wahaSession && !managed && <button type="button" onClick={() => void createAndConnect()} disabled={busy} className="rounded-lg bg-[#00a884] px-2 py-1.5 text-xs font-bold text-white">Criar e conectar WAHA</button>}{!binding.wahaSession && !managed && sessions.length > 0 && <><select aria-label="Vincular sessão existente" value={session} onChange={event => setSession(event.target.value)} disabled={busy} className="rounded-lg border border-[#2a3942] bg-transparent px-2 py-1.5 text-xs"><option value="">Vincular sessão existente</option>{sessions.map(item => <option key={item.name} value={item.name}>{item.name}</option>)}</select><button type="button" onClick={() => void connectSession(session.trim())} disabled={busy || !session.trim()} className="inline-flex items-center gap-1 rounded-lg border border-[#00a884]/40 px-2 py-1.5 text-xs font-bold text-[#00a884]"><Link2 className="h-3.5 w-3.5" />Conectar</button></>}{(binding.wahaSession || managed) && <><button type="button" onClick={() => void operate('qr')} disabled={busy || managed?.connectionStatus === 'connected' || binding.wahaStatus === 'missing'} className="rounded-lg border px-2 py-1.5"><QrCode className="inline h-3.5 w-3.5" /> Mostrar QR Code</button><button type="button" onClick={() => void connectSession(binding.wahaSession || managed?.name || '')} disabled={busy || binding.wahaStatus === 'missing'} className="rounded-lg border px-2 py-1.5"><RotateCcw className="inline h-3.5 w-3.5" /> Reconectar</button>{binding.wahaSession && <button type="button" onClick={() => void unbind()} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 px-2 py-1.5 text-xs font-bold text-red-400"><Unlink className="h-3.5 w-3.5" />Desvincular</button>}<button type="button" onClick={() => setConfirmDelete(true)} disabled={busy} className="rounded-lg border border-red-500/40 px-2 py-1.5 text-red-400">Excluir sessão</button></>}</div>{qr && <div className="mt-3 rounded border p-3"><p>Abra o WhatsApp no celular e acesse Aparelhos conectados → Conectar aparelho.</p><img className="mt-2 h-48 w-48" alt="QR Code WAHA" src={qr.data.startsWith('data:') ? qr.data : `data:${qr.mimetype};base64,${qr.data}`} /></div>}{confirmDelete && <div role="dialog" className="mt-3 rounded border border-red-500/40 p-3"><p className="font-semibold">Excluir esta sessão WAHA?</p><p className="mt-1">Isso removerá a sessão do servidor WAHA. A conexão Meta não será alterada.</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => setConfirmDelete(false)}>Cancelar</button><button type="button" onClick={() => void deleteSession()} className="text-red-400">Excluir sessão</button></div></div>}</div>
    </>
    {configuration.hybridEnabled && <>
      <fieldset className="space-y-2 text-xs"><legend className="font-semibold">Fora da janela de atendimento</legend><label className="flex gap-2"><input type="radio" name="outside-window" checked={configuration.outOfWindowStrategy === 'template'} disabled={busy} onChange={() => void saveConfiguration({ outOfWindowStrategy: 'template' })} />Exigir Template Meta</label><label className="flex gap-2"><input type="radio" name="outside-window" checked={configuration.outOfWindowStrategy === 'waha'} disabled={busy} onChange={() => void saveConfiguration({ outOfWindowStrategy: 'waha' })} />Permitir texto livre pelo WAHA</label></fieldset>
      <fieldset className="space-y-2 text-xs"><legend className="font-semibold">Se Meta falhar</legend><label className="flex gap-2"><input type="radio" name="meta-failure" checked={configuration.metaFailureStrategy === 'block'} disabled={busy} onChange={() => void saveConfiguration({ metaFailureStrategy: 'block' })} />Bloquear envio</label><label className="flex gap-2"><input type="radio" name="meta-failure" checked={configuration.metaFailureStrategy === 'waha'} disabled={busy} onChange={() => void saveConfiguration({ metaFailureStrategy: 'waha' })} />Usar WAHA quando o fallback for seguro</label><p className="text-[#8696a0]">Falhas ambíguas da Meta não usam WAHA automaticamente para evitar mensagens duplicadas.</p></fieldset>
      <p className="rounded-lg bg-[#00a884]/10 p-2 text-xs text-[#8696a0]">Grupos serão enviados e recebidos pelo WAHA.</p>
    </>}
    <div className="flex gap-3 text-xs text-[#8696a0]"><span>Meta: {metaLabel(inbox)}</span><span>WAHA: {wahaLabel(binding.wahaStatus)}</span></div>
    {error && <p className="flex gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-500"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}
  </section>;
};
