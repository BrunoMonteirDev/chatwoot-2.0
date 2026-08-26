import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronLeft, Check, Loader2, MessageCircle, Plus, QrCode, RefreshCw, Trash2, Unplug, Users, Wifi, WifiOff } from 'lucide-react';
import type { AssignableAgent, Inbox } from '../domain/currentUser';
import { errorMessageForUser } from '../integrations/chatwoot/errors';
import { evolutionQrCode, evolutionService, type EvolutionConnection, type EvolutionConnectionStatus } from '../integrations/evolution/client';
import { evolutionMetadataForInbox, isEvolutionInbox } from '../integrations/evolution/inbox';
import { inboxService } from '../integrations/chatwoot/inboxes';
import { wahaClient } from '../integrations/waha/client';
import { MetaCloudSetup } from './MetaCloudSetup';
import { WahaSetup } from './WahaSetup';
import { metaCloudMetadataForInbox, transportStatusesForInbox, whatsappConfigurationForInbox, whatsappProviderForInbox } from '../integrations/whatsapp/provider';

interface Props {
  accountId: number | null;
  inboxes: Inbox[];
  inboxesStatus: 'idle' | 'loading' | 'ready' | 'error';
  inboxesError: string | null;
  onRefresh: () => Promise<void> | void;
  isDarkMode: boolean;
}

type Screen = 'list' | 'provider' | 'create' | 'configure' | 'adopt' | 'meta' | 'waha';
const instanceOf = (inbox: Inbox) => evolutionMetadataForInbox(inbox)?.evolution_instance_name ?? null;
const formatNumber = (number: string | null) => number ? `+${number}` : 'Número ainda não disponível';
const instanceNameFor = (accountId: number, name: string) => `cw-${accountId}-${name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 36) || 'whatsapp'}-${Date.now()}`;
const bridgeWebhookUrl = () => {
  const configured = (import.meta.env.VITE_BRIDGE_PUBLIC_URL || '').replace(/\/$/, '');
  if (!configured) return null;
  try {
    // `/bridge` is a browser-only proxy. Chatwoot delivers outgoing-message
    // webhooks from its own container, where `localhost` points at Rails, not
    // at the frontend proxy. Persist the Docker-network address instead.
    if (configured.startsWith('/')) return 'http://bridge:3100/webhooks/chatwoot';
    const url = new URL(configured, window.location.origin);
    if (url.protocol === 'https:' || url.protocol === 'http:') return `${url.toString().replace(/\/$/, '')}/webhooks/chatwoot`;
  } catch { /* A mensagem abaixo orienta a configuração inválida. */ }
  return null;
};
const chatwootWebhookUrl = bridgeWebhookUrl();

export const EvolutionInboxesPanel: React.FC<Props> = ({ accountId, inboxes, inboxesStatus, inboxesError, onRefresh, isDarkMode }) => {
  const [screen, setScreen] = useState<Screen>('list');
  const [selectedInbox, setSelectedInbox] = useState<Inbox | null>(null);
  const [name, setName] = useState('');
  const [existingInstanceName, setExistingInstanceName] = useState('');
  const [createInstanceForExistingInbox, setCreateInstanceForExistingInbox] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<EvolutionConnection | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loadingConnection, setLoadingConnection] = useState(false);
  const [agents, setAgents] = useState<AssignableAgent[]>([]);
  const [members, setMembers] = useState<number[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [savingMembers, setSavingMembers] = useState(false);
  const [inboxPendingDeletion, setInboxPendingDeletion] = useState<Inbox | null>(null);
  const [deletingInbox, setDeletingInbox] = useState(false);

  const selectedInstance = selectedInbox ? instanceOf(selectedInbox) : null;
  const selectedConfiguration = selectedInbox ? whatsappConfigurationForInbox(selectedInbox) : null;
  const card = isDarkMode ? 'bg-[#182228] border-[#2a3942]' : 'bg-[#f0f2f5] border-[#d1d7db]';

  const loadConnection = useCallback(async (withQr = false) => {
    if (!selectedInstance) return;
    setLoadingConnection(true); setError(null);
    try {
      const next = await evolutionService.getConnection(selectedInstance);
      setConnection(next);
      if (withQr || next.status !== 'connected') setQrCode(evolutionQrCode(await evolutionService.getQrCode(selectedInstance)));
      else setQrCode(null);
    } catch (cause) { setError(errorMessageForUser(cause)); setConnection({ status: 'error', number: null, raw: null }); }
    finally { setLoadingConnection(false); }
  }, [selectedInstance]);

  const loadAgents = useCallback(async () => {
    if (!accountId || !selectedInbox) return;
    setLoadingAgents(true); setError(null);
    try {
      const [available, assigned] = await Promise.all([inboxService.listAgents(accountId), inboxService.listMembers(accountId, selectedInbox.id)]);
      setAgents(available); setMembers(assigned.map(agent => agent.id));
    } catch (cause) { setError(errorMessageForUser(cause)); }
    finally { setLoadingAgents(false); }
  }, [accountId, selectedInbox]);

  useEffect(() => {
    if (screen !== 'configure' || !selectedInstance) return;
    void loadConnection(true); void loadAgents();
  }, [screen, selectedInstance, loadConnection, loadAgents]);

  useEffect(() => {
    if (screen !== 'configure' || !selectedInstance || connection?.status === 'connected') return;
    const timer = window.setInterval(() => void loadConnection(false), 5_000);
    return () => window.clearInterval(timer);
  }, [screen, selectedInstance, connection?.status, loadConnection]);

  const openConfig = (inbox: Inbox) => {
    setSelectedInbox(inbox); setError(null); setConnection(null); setQrCode(null); setScreen('configure');
    if (accountId && chatwootWebhookUrl && inbox.webhookUrl !== chatwootWebhookUrl) {
      const metadata = evolutionMetadataForInbox(inbox);
      if (!metadata) return;
      void inboxService.saveWhatsAppTransport(accountId, inbox, 'evolution', { ...metadata }, chatwootWebhookUrl)
        .then(setSelectedInbox).catch(cause => setError(errorMessageForUser(cause)));
    }
  };
  const openEvolutionSetup = (inbox: Inbox) => { setSelectedInbox(inbox); setExistingInstanceName(''); setCreateInstanceForExistingInbox(false); setError(null); setScreen('adopt'); };
  const create = async () => {
    if (!accountId || !name.trim() || creating || !chatwootWebhookUrl) return;
    setCreating(true); setError(null);
    try {
      const inbox = await inboxService.createEvolutionInbox(accountId, { name: name.trim(), webhookUrl: chatwootWebhookUrl });
      await onRefresh(); setSelectedInbox(inbox); setScreen('waha'); setName('');
    } catch (cause) { setError(errorMessageForUser(cause)); }
    finally { setCreating(false); }
  };
  const configureExistingInbox = async () => {
    if (!accountId || !selectedInbox || !existingInstanceName.trim() || !chatwootWebhookUrl || creating) return;
    setCreating(true); setError(null);
    try {
      const instance = createInstanceForExistingInbox
        ? await evolutionService.createInstance(existingInstanceName.trim())
        : { instanceName: existingInstanceName.trim(), instanceId: null };
      if (!createInstanceForExistingInbox) await evolutionService.getConnection(instance.instanceName);
      await evolutionService.configureWebhook(instance.instanceName);
      const saved = await inboxService.saveWhatsAppTransport(accountId, selectedInbox, 'evolution', {
        evolution_provider: 'evolution', whatsapp_provider: 'evolution', evolution_instance_name: instance.instanceName, evolution_instance_id: instance.instanceId,
      }, chatwootWebhookUrl);
      await onRefresh(); setSelectedInbox(saved); setScreen('configure');
    } catch (cause) { setError(errorMessageForUser(cause)); }
    finally { setCreating(false); }
  };
  const disconnect = async () => { if (!selectedInstance) return; setLoadingConnection(true); setError(null); try { await evolutionService.disconnect(selectedInstance); await loadConnection(false); } catch (cause) { setError(errorMessageForUser(cause)); } finally { setLoadingConnection(false); } };
  // Evolution API v2 does not provide /instance/restart. Requesting a fresh
  // QR from /instance/connect is the supported way to start or renew a
  // Baileys pairing session.
  const reconnect = async () => { if (!selectedInstance) return; await loadConnection(true); };
  const saveMembers = async () => { if (!accountId || !selectedInbox || savingMembers) return; setSavingMembers(true); setError(null); try { const updated = await inboxService.setMembers(accountId, selectedInbox.id, members); setMembers(updated.map(agent => agent.id)); } catch (cause) { setError(errorMessageForUser(cause)); } finally { setSavingMembers(false); } };
  const toggleMember = (id: number) => setMembers(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const deleteInbox = async () => {
    if (!accountId || !inboxPendingDeletion || deletingInbox) return;
    setDeletingInbox(true); setError(null);
    try {
      const wahaSession = inboxPendingDeletion.additionalAttributes.waha_session_name;
      if (typeof wahaSession === 'string' && wahaSession) await wahaClient.deleteInboxAndSession({ accountId, inboxId: inboxPendingDeletion.id });
      else await inboxService.delete(accountId, inboxPendingDeletion.id);
      if (selectedInbox?.id === inboxPendingDeletion.id) { setSelectedInbox(null); setScreen('list'); }
      setInboxPendingDeletion(null);
      await onRefresh();
    } catch (cause) { setError(errorMessageForUser(cause)); }
    finally { setDeletingInbox(false); }
  };
  const status = connection?.status ?? 'disconnected';
  const statusLabel: Record<EvolutionConnectionStatus, string> = { connected: 'Conectado', connecting: 'Conectando', disconnected: 'Desconectado', error: 'Erro' };
  const statusIcon = status === 'connected' ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />;

  return <div className={`p-6 rounded-2xl border shadow-xl space-y-6 ${isDarkMode ? 'bg-[#111b21] border-[#222d34]' : 'bg-white border-[#d1d7db]'}`}>
    <div className="flex items-center justify-between border-b pb-4 border-white/10">
      <div><h3 className="text-lg font-bold">Caixas de Entrada</h3><p className="text-xs text-[#8696a0]">WhatsApp via Meta Cloud API, Evolution ou modo híbrido.</p></div>
      {screen !== 'list' && <button type="button" onClick={() => { setScreen('list'); setError(null); }} className="px-3 py-2 text-xs font-bold rounded-xl border border-[#00a884]/40 text-[#00a884] flex gap-1 items-center"><ChevronLeft className="w-4 h-4" /> Voltar à lista</button>}
    </div>
    {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-500 flex gap-2"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
    {screen === 'list' && <>
      <div className="flex justify-end"><button type="button" disabled={!accountId} onClick={() => { setName(''); setError(null); setScreen('provider'); }} className="px-3.5 py-2 bg-[#00a884] hover:bg-[#008069] disabled:opacity-40 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"><Plus className="w-4 h-4" />Adicionar caixa de entrada</button></div>
      {inboxesStatus === 'loading' && <div className="py-12 text-center text-xs text-[#8696a0]"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />Carregando caixas de entrada…</div>}
      {inboxesStatus === 'error' && <div className="py-10 text-center text-xs text-red-500">{inboxesError}<button type="button" onClick={() => void onRefresh()} className="block mx-auto mt-3 text-[#00a884] font-bold">Tentar novamente</button></div>}
      {inboxesStatus === 'ready' && !inboxes.length && <div className="py-12 text-center text-xs text-[#8696a0]">Nenhuma caixa de entrada configurada nesta conta.</div>}
      <div className="space-y-3">{inboxes.map(inbox => {
        const configuration = whatsappConfigurationForInbox(inbox);
        const meta = metaCloudMetadataForInbox(inbox);
        const transportStatuses = transportStatusesForInbox(inbox);
        const historyLabel = meta?.meta_history_status === 'synced' ? 'Histórico sincronizado' : meta?.meta_history_status === 'importing' ? 'Histórico importando' : meta?.meta_history_status === 'ready' ? 'Histórico disponível' : meta?.meta_history_status === 'receiving' ? 'Histórico recebendo' : meta?.meta_history_status === 'waiting' ? 'Histórico aguardando autorização' : meta?.meta_history_status === 'failed' ? 'Histórico com falha' : meta?.meta_history_status === 'not_available' ? 'Histórico não autorizado' : null;
        const action = configuration?.transports.includes('waha') ? <button type="button" onClick={() => { setSelectedInbox(inbox); setScreen('waha'); }} className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-[#00a884]/15 text-[#00a884] border border-[#00a884]/30">Gerenciar WAHA</button> : configuration?.mode === 'hybrid' ? <button type="button" onClick={() => openConfig(inbox)} className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-[#00a884]/15 text-[#00a884] border border-[#00a884]/30">Gerenciar</button> : isEvolutionInbox(inbox) ? <button type="button" onClick={() => openConfig(inbox)} className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-[#00a884]/15 text-[#00a884] border border-[#00a884]/30">Configurar</button> : whatsappProviderForInbox(inbox) === 'meta_cloud' && meta?.meta_business_app_status === 'offboarded' ? <button type="button" onClick={() => { setSelectedInbox(inbox); setScreen('meta'); }} className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-[#00a884]/15 text-[#00a884] border border-[#00a884]/30">Reconectar Meta</button> : whatsappProviderForInbox(inbox) === 'meta_cloud' ? <button type="button" onClick={() => { setSelectedInbox(inbox); setScreen('waha'); }} className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-[#00a884]/15 text-[#00a884] border border-[#00a884]/30">Adicionar sessão WAHA</button> : inbox.channelType === 'Channel::Api' ? <button type="button" onClick={() => { setSelectedInbox(inbox); setScreen('waha'); }} className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-[#00a884]/15 text-[#00a884] border border-[#00a884]/30">Conectar WAHA</button> : <span className="px-3 py-1.5 rounded-xl text-[11px] font-bold bg-gray-500/15 text-[#8696a0]">Em breve</span>;
        return <div key={inbox.id} className={`p-4 rounded-xl border flex items-center justify-between ${card}`}><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-[#00a884]/20 text-[#00a884] flex items-center justify-center"><Wifi className="w-5 h-5" /></div><div><h4 className="font-bold text-xs sm:text-sm">{inbox.name}</h4><p className="text-[11px] text-[#8696a0]">{configuration ? `WhatsApp · ${configuration.mode === 'hybrid' ? 'Modo híbrido' : configuration.mode === 'official' ? 'Meta Cloud API' : 'Sessão Evolution'} · ${configuration.transports.join(' + ')}` : inbox.channelType}</p>{meta?.meta_onboarding_mode === 'coexistence' && <p className="text-[11px] text-[#8696a0]">WhatsApp Business App: {meta.meta_business_app_status === 'offboarded' ? 'reconexão necessária' : 'coexistência ativa'} · {historyLabel || 'Histórico aguardando'}</p>}{configuration?.mode === 'hybrid' && <p className="text-[11px] text-[#8696a0]">Meta: {meta?.meta_display_phone_number || 'validada'} ({transportStatuses.meta_cloud === 'connected' ? 'conectada' : transportStatuses.meta_cloud}) · Evolution: {configuration.evolutionInstanceName || 'pendente'} ({transportStatuses.evolution})</p>}</div></div><div className="flex items-center gap-2">{action}<button type="button" onClick={() => setInboxPendingDeletion(inbox)} aria-label={`Excluir ${inbox.name}`} title="Excluir caixa de entrada" className="rounded-xl border border-red-500/30 p-2 text-red-400 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></button></div></div>;
      })}</div>
      <p className="text-[11px] text-[#8696a0]">Outros canais permanecem indisponíveis neste MVP.</p>
    </>}
    {screen === 'provider' && <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-3"><button type="button" onClick={() => { setSelectedInbox(null); setScreen('meta'); }} className={`rounded-2xl border p-5 text-left ${card}`}><p className="font-bold">API oficial Meta</p><p className="mt-2 text-xs text-[#8696a0]">Cadastro incorporado ou configuração manual.</p></button><button type="button" onClick={() => setScreen('create')} className={`rounded-2xl border p-5 text-left ${card}`}><p className="font-bold">Sessão WhatsApp Web</p><p className="mt-2 text-xs text-[#8696a0]">WAHA via QR Code. Evolution permanece como legado.</p></button><button type="button" onClick={() => { setSelectedInbox(null); setScreen('meta'); }} className={`rounded-2xl border p-5 text-left ${card}`}><p className="font-bold">Modo híbrido</p><p className="mt-2 text-xs text-[#8696a0]">Comece pela Meta; depois adicione a sessão WAHA na mesma inbox.</p></button></div>}
    {screen === 'meta' && accountId && <MetaCloudSetup accountId={accountId} inbox={selectedInbox} webhookUrl={chatwootWebhookUrl || ''} isDarkMode={isDarkMode} onSaved={async () => { await onRefresh(); setScreen('list'); }} />}
    {screen === 'waha' && accountId && selectedInbox && <WahaSetup accountId={accountId} inbox={selectedInbox} webhookUrl={chatwootWebhookUrl || ''} isDarkMode={isDarkMode} onSaved={onRefresh} />}
    {screen === 'create' && <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3 text-xs">
        {[['1', 'Canal'], ['2', 'Configuração'], ['3', 'Conectar']].map(([step, label], index) => <React.Fragment key={step}><div className={`flex items-center gap-2 ${index === 0 ? 'text-[#00a884]' : 'text-[#8696a0]'}`}><span className={`w-6 h-6 rounded-full grid place-items-center font-bold ${index === 0 ? 'bg-[#00a884] text-[#0b141a]' : 'bg-[#2a3942]'}`}>{index === 0 ? <Check className="w-4 h-4" /> : step}</span>{label}</div>{index < 2 && <div className="h-px flex-1 bg-[#2a3942]" />}</React.Fragment>)}
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <section className={`rounded-2xl border p-5 ${card}`}>
          <p className="text-sm font-bold">Escolha o canal</p><p className="mt-1 text-xs text-[#8696a0]">Selecione como os clientes entrarão em contato com sua equipe.</p>
          <button type="button" className="mt-5 flex w-full items-start gap-4 rounded-xl border border-[#00a884] bg-[#00a884]/10 p-4 text-left ring-1 ring-[#00a884]/20">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#25d366] text-[#0b141a]"><MessageCircle className="w-6 h-6" /></span>
            <span className="flex-1"><span className="flex items-center justify-between text-sm font-bold">WhatsApp <span className="rounded-full bg-[#00a884] px-2 py-0.5 text-[10px] text-[#0b141a]">Selecionado</span></span><span className="mt-1 block text-xs text-[#8696a0]">Conecte uma sessão WAHA por QR Code.</span></span>
          </button>
          <p className="mt-4 rounded-lg border border-[#2a3942] bg-black/10 p-3 text-[11px] leading-5 text-[#8696a0]">Outros canais podem ser criados no Chatwoot original. Nesta interface, novas conexões WhatsApp Web usam WAHA; Evolution continua disponível para inboxes legadas.</p>
        </section>
        <section className={`rounded-2xl border p-5 ${card}`}>
          <p className="text-sm font-bold">Detalhes da caixa de entrada</p><p className="mt-1 text-xs text-[#8696a0]">Use um nome que sua equipe reconheça facilmente.</p>
          {!chatwootWebhookUrl && <div className="mt-4 flex gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300"><AlertCircle className="h-4 w-4 shrink-0" />Configure <code>VITE_BRIDGE_PUBLIC_URL</code> antes de conectar o WhatsApp.</div>}
          <label className="mt-5 block text-xs font-bold">Nome da caixa de entrada<input autoFocus value={name} onChange={event => setName(event.target.value)} placeholder="Ex.: WhatsApp Vendas" className={`mt-2 w-full px-3 py-3 rounded-xl border outline-none transition focus:border-[#00a884] ${isDarkMode ? 'bg-[#111b21] border-[#2a3942]' : 'bg-gray-50 border-gray-300'}`} /></label>
          <button type="button" disabled={!name.trim() || creating || !chatwootWebhookUrl} onClick={() => void create()} className="mt-5 w-full py-3 bg-[#00a884] hover:bg-[#008069] text-[#0b141a] rounded-xl text-xs font-bold disabled:opacity-40 flex justify-center gap-2">{creating && <Loader2 className="w-4 h-4 animate-spin" />}{creating ? 'Criando caixa…' : 'Continuar para conectar WAHA'}</button>
        </section>
      </div>
    </div>}
    {screen === 'adopt' && selectedInbox && <div className="max-w-lg mx-auto space-y-5"><div className={`p-4 rounded-xl border ${card}`}><p className="text-sm font-bold">Configurar {selectedInbox.name} como Evolution</p><p className="text-[11px] mt-1 text-[#8696a0]">A inbox atual será preservada. Apenas os metadados Evolution e o webhook do bridge serão configurados.</p></div>{!chatwootWebhookUrl && <p className="text-xs text-red-500">Configure VITE_BRIDGE_PUBLIC_URL antes de continuar.</p>}<label className="block text-xs font-bold">Nome da instância Evolution<input autoFocus value={existingInstanceName} onChange={event => setExistingInstanceName(event.target.value)} placeholder="Ex.: cw-suporte" className={`mt-2 w-full px-3 py-2.5 rounded-xl border outline-none ${isDarkMode ? 'bg-[#182228] border-[#2a3942]' : 'bg-gray-50 border-gray-300'}`} /></label><label className="flex gap-2 text-xs items-center cursor-pointer"><input type="checkbox" checked={createInstanceForExistingInbox} onChange={event => setCreateInstanceForExistingInbox(event.target.checked)} />Criar uma nova instância com esse nome</label><p className="text-[11px] text-[#8696a0]">Sem essa opção, o bridge valida uma instância Evolution já existente antes de salvar.</p><button type="button" disabled={!existingInstanceName.trim() || creating || !chatwootWebhookUrl} onClick={() => void configureExistingInbox()} className="w-full py-2.5 bg-[#00a884] text-white rounded-xl text-xs font-bold disabled:opacity-40 flex justify-center gap-2">{creating && <Loader2 className="w-4 h-4 animate-spin" />}{creating ? 'Configurando…' : 'Salvar e conectar Evolution'}</button></div>}
    {screen === 'configure' && selectedInbox && <div className="space-y-5"><div className={`p-4 rounded-xl border ${card}`}><div className="flex justify-between gap-3"><div><p className="font-bold text-sm">{selectedInbox.name}</p><p className="text-[11px] text-[#8696a0]">Instância Evolution: {selectedInstance}</p><p className="text-[11px] text-[#8696a0]">{formatNumber(connection?.number ?? null)}</p></div><span className={`h-fit px-2 py-1 rounded-full text-[11px] font-bold flex gap-1 items-center ${status === 'connected' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-amber-500/20 text-amber-500'}`}>{statusIcon}{statusLabel[status]}</span></div><div className="mt-4 flex gap-2"><button type="button" disabled={loadingConnection} onClick={() => void reconnect()} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#00a884] text-white flex gap-1">{loadingConnection ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}Conectar/reconectar</button><button type="button" disabled={loadingConnection || status !== 'connected'} onClick={() => void disconnect()} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-red-500/40 text-red-500 flex gap-1"><Unplug className="w-3.5 h-3.5" />Desconectar</button></div></div>
      {selectedConfiguration?.mode === 'web' && <div className={`p-4 rounded-xl border ${card}`}><p className="text-sm font-bold">API oficial Meta</p><p className="mt-1 text-[11px] text-[#8696a0]">Adicione a API oficial à mesma inbox para usar modo híbrido.</p><button type="button" onClick={() => setScreen('meta')} className="mt-3 rounded-lg bg-[#00a884] px-3 py-1.5 text-xs font-bold text-white">Adicionar API oficial</button></div>}
      {selectedConfiguration?.mode === 'hybrid' && <div className={`p-4 rounded-xl border ${card}`}><p className="text-sm font-bold">Modo híbrido</p><p className="mt-1 text-[11px] text-[#8696a0]">Meta Cloud API: {metaCloudMetadataForInbox(selectedInbox)?.meta_display_phone_number || 'conectada'} · Sessão complementar Evolution: {statusLabel[status].toLowerCase()}.</p>{metaCloudMetadataForInbox(selectedInbox)?.meta_business_app_status === 'offboarded' && <button type="button" onClick={() => setScreen('meta')} className="mt-3 rounded-lg bg-[#00a884] px-3 py-1.5 text-xs font-bold text-white">Reconectar Meta</button>}</div>}
      {status !== 'connected' && <div className={`p-5 rounded-xl border text-center ${card}`}><QrCode className="w-6 h-6 mx-auto mb-2 text-[#00a884]" /><p className="text-xs font-bold">Aponte o WhatsApp para o QR Code</p>{qrCode ? <img src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`} className="w-52 h-52 mx-auto mt-3 bg-white p-2" alt="QR Code da Evolution" /> : <p className="mt-3 text-[11px] text-[#8696a0]">Solicitando QR Code…</p>}<button type="button" onClick={() => void loadConnection(true)} className="mt-3 text-xs font-bold text-[#00a884]">Atualizar QR Code</button></div>}
      <div className={`p-4 rounded-xl border ${card}`}><div className="flex items-center justify-between"><div><p className="text-sm font-bold flex gap-2 items-center"><Users className="w-4 h-4 text-[#00a884]" />Agentes da caixa</p><p className="text-[11px] text-[#8696a0]">Selecione quem poderá atender nesta inbox.</p></div><button type="button" disabled={savingMembers || loadingAgents} onClick={() => void saveMembers()} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-[#00a884] text-white disabled:opacity-40">{savingMembers ? 'Salvando…' : 'Salvar agentes'}</button></div>{loadingAgents ? <Loader2 className="w-4 h-4 animate-spin my-4" /> : <div className="mt-3 space-y-2">{agents.map(agent => <label key={agent.id} className="flex items-center gap-2 text-xs cursor-pointer"><input type="checkbox" checked={members.includes(agent.id)} onChange={() => toggleMember(agent.id)} />{agent.avatarUrl && <img src={agent.avatarUrl} className="w-5 h-5 rounded-full" alt="" />}{agent.name}</label>)}{!agents.length && <p className="text-xs text-[#8696a0]">Nenhum agente disponível.</p>}</div>}</div>
      {status === 'connected' && <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 text-xs flex gap-2"><CheckCircle2 className="w-4 h-4" />Caixa de entrada pronta. Clique em voltar à lista para concluir.</div>}
    </div>}
    {inboxPendingDeletion && <div className="fixed inset-0 z-[10001] grid place-items-center bg-black/65 p-4" role="dialog" aria-modal="true"><div className={`w-full max-w-sm rounded-2xl border p-5 shadow-2xl ${isDarkMode ? 'border-[#2a3942] bg-[#182228] text-[#e9edef]' : 'border-[#d1d7db] bg-white text-[#111b21]'}`}><h3 className="text-sm font-bold">Excluir caixa de entrada?</h3><p className="mt-2 text-xs leading-5 text-[#8696a0]">“{inboxPendingDeletion.name}” será removida do Chatwoot. Isso não apaga a instância Evolution nem mensagens já existentes.</p><div className="mt-5 flex justify-end gap-2"><button type="button" disabled={deletingInbox} onClick={() => setInboxPendingDeletion(null)} className="rounded-lg px-3 py-2 text-xs font-bold text-[#aebac1] hover:bg-white/5">Cancelar</button><button type="button" disabled={deletingInbox} onClick={() => void deleteInbox()} className="rounded-lg bg-red-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{deletingInbox ? 'Excluindo…' : 'Excluir caixa'}</button></div></div></div>}
  </div>;
};
