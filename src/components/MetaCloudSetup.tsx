import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { inboxService } from '../integrations/chatwoot/inboxes';
import { metaCloudSetup, type MetaEmbeddedSignupCompletion, type MetaEmbeddedSignupResult, type MetaHistoryImportSummary } from '../integrations/meta/client';
import { listenForEmbeddedSignupEvents, openEmbeddedSignup, type MetaOnboardingMode } from '../integrations/meta/embeddedSignup';
import type { Inbox } from '../domain/currentUser';
import { errorMessageForUser } from '../integrations/chatwoot/errors';

interface Props { accountId: number; webhookUrl: string; isDarkMode: boolean; inbox?: Inbox | null; onSaved: (inbox: Inbox) => Promise<void> | void; }
type SetupMode = 'embedded' | 'manual';
type EmbeddedStage = 'idle' | 'opening' | 'waiting' | 'authorizing' | 'exchanging_code' | 'validating' | 'configuring_webhook' | 'connected' | 'error';

const stageLabel: Record<Exclude<EmbeddedStage, 'idle' | 'error' | 'connected'>, string> = {
  opening: 'Abrindo a Meta…', waiting: 'Aguardando a conclusão na Meta…', authorizing: 'Autorização recebida…', exchanging_code: 'Trocando autorização com segurança…', validating: 'Validando WABA e número…', configuring_webhook: 'Configurando recebimento de eventos…',
};

export const MetaCloudSetup = ({ accountId, webhookUrl, isDarkMode, inbox: existingInbox, onSaved }: Props) => {
  const [name, setName] = useState(''); const [wabaId, setWabaId] = useState(''); const [phoneNumberId, setPhoneNumberId] = useState(''); const [accessToken, setAccessToken] = useState('');
  const [mode, setMode] = useState<SetupMode>('embedded');
  const [onboardingMode, setOnboardingMode] = useState<MetaOnboardingMode>(existingInbox?.additionalAttributes.meta_onboarding_mode === 'coexistence' ? 'coexistence' : 'standard');
  const [error, setError] = useState<string | null>(null); const [saving, setSaving] = useState(false); const [embeddedStage, setEmbeddedStage] = useState<EmbeddedStage>('idle');
  const [history, setHistory] = useState<MetaHistoryImportSummary | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const sessionRef = useRef<string | null>(null); const codeRef = useRef<string | null>(null); const embeddedResultRef = useRef<MetaEmbeddedSignupResult | null>(null); const completingRef = useRef(false);
  const completeEmbeddedRef = useRef<() => Promise<void>>(async () => {});
  const input = `mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none ${isDarkMode ? 'border-[#2a3942] bg-[#111b21]' : 'border-gray-300 bg-white'}`;

  const resetEmbedded = () => { sessionRef.current = null; codeRef.current = null; embeddedResultRef.current = null; completingRef.current = false; };

  completeEmbeddedRef.current = async () => {
    const onboardingSession = sessionRef.current; const code = codeRef.current; const publicResult = embeddedResultRef.current;
    if (!onboardingSession || !code || !publicResult || completingRef.current) return;
    completingRef.current = true;
    try {
      setEmbeddedStage('exchanging_code');
      const completion: MetaEmbeddedSignupCompletion = await metaCloudSetup.completeEmbeddedSignup(onboardingSession, code, publicResult);
      setEmbeddedStage('validating');
      // Do not create a Chatwoot inbox until the Meta authorization has been
      // exchanged and validated. A cancelled flow leaves no orphan inbox.
      const targetInbox = existingInbox || await inboxService.createWhatsAppApiInbox(accountId, { name: name.trim(), webhookUrl });
      setEmbeddedStage('configuring_webhook');
      const finalized = await metaCloudSetup.finalizeEmbeddedSignup(onboardingSession, targetInbox.id);
      const saved = await inboxService.saveWhatsAppTransport(accountId, targetInbox, 'meta_cloud', {
        whatsapp_provider: 'meta_cloud', meta_connection_status: finalized.webhookReady ? 'connected' : 'pending', meta_onboarding_status: finalized.webhookReady ? 'connected' : 'webhook_pending', meta_onboarding_mode: completion.onboardingMode, meta_business_app_status: completion.onboardingMode === 'coexistence' ? 'active' : 'not_applicable', meta_history_authorized: false, meta_history_status: completion.onboardingMode === 'coexistence' ? 'waiting' : 'not_available', meta_waba_id: completion.connection.wabaId, meta_phone_number_id: completion.connection.phoneNumberId, meta_display_phone_number: completion.connection.displayPhoneNumber,
      }, webhookUrl);
      setEmbeddedStage('connected'); setSaving(false); resetEmbedded(); await onSaved(saved);
    } catch (cause) {
      setEmbeddedStage('error'); setSaving(false); completingRef.current = false; setError(errorMessageForUser(cause));
    }
  };

  useEffect(() => listenForEmbeddedSignupEvents(event => {
    if (!event || !saving) return;
    if (event.kind === 'cancelled') { resetEmbedded(); setSaving(false); setEmbeddedStage('idle'); setError('O Cadastro Incorporado foi cancelado.'); return; }
    if (event.kind === 'error') { resetEmbedded(); setSaving(false); setEmbeddedStage('error'); setError('A Meta retornou dados incompletos para o Cadastro Incorporado.'); return; }
    embeddedResultRef.current = event.result;
    setEmbeddedStage('authorizing');
    void completeEmbeddedRef.current();
  }), [saving]);

  const canSyncHistory = existingInbox?.additionalAttributes.meta_onboarding_mode === 'coexistence'
    && existingInbox.additionalAttributes.meta_history_authorized === true;

  useEffect(() => {
    if (!canSyncHistory || !existingInbox) { setHistory(null); return; }
    let active = true;
    void metaCloudSetup.historySummary(existingInbox.id).then(summary => { if (active) setHistory(summary); }).catch(() => { if (active) setHistory(null); });
    return () => { active = false; };
  }, [canSyncHistory, existingInbox]);

  const importHistory = async (retryFailed = false) => {
    if (!existingInbox || historyLoading) return;
    setHistoryLoading(true); setError(null);
    try {
      setHistory(await metaCloudSetup.importHistory(existingInbox.id, retryFailed));
    } catch (cause) { setError(errorMessageForUser(cause)); }
    finally { setHistoryLoading(false); }
  };

  const startEmbedded = async () => {
    if (!webhookUrl || (!existingInbox && !name.trim()) || saving) return;
    setSaving(true); setError(null); resetEmbedded(); setEmbeddedStage('opening');
    try {
      const [publicConfig, session] = await Promise.all([
        metaCloudSetup.embeddedPublicConfig(),
        metaCloudSetup.startEmbeddedSignup({ accountId, inboxId: existingInbox?.id || null, inboxName: existingInbox ? undefined : name.trim(), onboardingMode }),
      ]);
      sessionRef.current = session.onboardingSession;
      setEmbeddedStage('waiting');
      codeRef.current = await openEmbeddedSignup(publicConfig, onboardingMode);
      setEmbeddedStage('authorizing');
      await completeEmbeddedRef.current();
    } catch (cause) {
      resetEmbedded(); setSaving(false); setEmbeddedStage('error'); setError(errorMessageForUser(cause));
    }
  };

  const saveManual = async () => {
    if (!webhookUrl || (!existingInbox && !name.trim()) || !wabaId.trim() || !phoneNumberId.trim() || !accessToken.trim() || saving) return;
    setSaving(true); setError(null);
    try {
      const targetInbox = existingInbox || await inboxService.createWhatsAppApiInbox(accountId, { name: name.trim(), webhookUrl });
      const connection = await metaCloudSetup.validate({ inboxId: targetInbox.id, wabaId: wabaId.trim(), phoneNumberId: phoneNumberId.trim(), accessToken: accessToken.trim() });
      const saved = await inboxService.saveWhatsAppTransport(accountId, targetInbox, 'meta_cloud', {
        whatsapp_provider: 'meta_cloud', meta_connection_status: 'connected', meta_onboarding_status: 'manual', meta_onboarding_mode: 'standard', meta_business_app_status: 'not_applicable', meta_history_authorized: false, meta_history_status: 'not_available', meta_waba_id: connection.wabaId, meta_phone_number_id: connection.phoneNumberId, meta_display_phone_number: connection.displayPhoneNumber,
      }, webhookUrl);
      setAccessToken(''); await onSaved(saved);
    } catch (cause) { setError(errorMessageForUser(cause)); }
    finally { setSaving(false); }
  };

  const choosingEmbedded = mode === 'embedded';
  return <div className="max-w-lg space-y-4"><div><h4 className="font-bold">API oficial do WhatsApp</h4><p className="mt-1 text-xs text-[#8696a0]">Conecte esta inbox pela Meta ou use a configuração manual existente.</p></div>
    <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => { setMode('embedded'); setError(null); }} className={`rounded-xl border p-3 text-left text-xs ${choosingEmbedded ? 'border-[#00a884] bg-[#00a884]/10' : 'border-[#2a3942]'}`}><b>Cadastro incorporado</b><span className="mt-1 block text-[#8696a0]">Conectar WhatsApp Business</span></button><button type="button" onClick={() => { setMode('manual'); setError(null); }} className={`rounded-xl border p-3 text-left text-xs ${!choosingEmbedded ? 'border-[#00a884] bg-[#00a884]/10' : 'border-[#2a3942]'}`}><b>Configuração manual</b><span className="mt-1 block text-[#8696a0]">Já possuo os dados</span></button></div>
    {!existingInbox && <label className="block text-xs font-bold">Nome da inbox<input value={name} onChange={event => setName(event.target.value)} className={input} placeholder="Ex.: WhatsApp Oficial" /></label>}
    {choosingEmbedded ? <div className="space-y-3 rounded-xl border border-[#2a3942] p-4"><p className="text-xs text-[#8696a0]">Conecte sua conta usando o processo oficial da Meta. Você pode usar um número novo ou o número já usado no WhatsApp Business; nenhum token ou App Secret fica no navegador.</p>
      <div className="grid grid-cols-2 gap-2"><button type="button" disabled={saving} onClick={() => setOnboardingMode('standard')} className={`rounded-lg border p-2 text-left text-[11px] ${onboardingMode === 'standard' ? 'border-[#00a884] bg-[#00a884]/10' : 'border-[#2a3942]'}`}><b>Novo número/API</b><span className="mt-1 block text-[#8696a0]">Conexão padrão da Meta</span></button><button type="button" disabled={saving} onClick={() => setOnboardingMode('coexistence')} className={`rounded-lg border p-2 text-left text-[11px] ${onboardingMode === 'coexistence' ? 'border-[#00a884] bg-[#00a884]/10' : 'border-[#2a3942]'}`}><b>Já uso o WhatsApp Business</b><span className="mt-1 block text-[#8696a0]">Mantém o aplicativo ativo</span></button></div>
      {embeddedStage === 'connected' ? <p className="flex items-center gap-2 text-xs text-[#00a884]"><CheckCircle2 className="h-4 w-4" />WhatsApp conectado com a API oficial Meta.</p> : null}
      {saving && embeddedStage !== 'idle' && embeddedStage !== 'error' ? <p className="flex items-center gap-2 text-xs text-[#8696a0]"><Loader2 className="h-4 w-4 animate-spin" />{stageLabel[embeddedStage as Exclude<EmbeddedStage, 'idle' | 'error' | 'connected'>]}</p> : null}
      <button type="button" disabled={!webhookUrl || saving || (!existingInbox && !name.trim())} onClick={() => void startEmbedded()} className="w-full rounded-xl bg-[#00a884] py-3 text-xs font-bold text-white disabled:opacity-40">{existingInbox ? 'Conectar/reconectar WhatsApp Business' : 'Conectar WhatsApp Business'}</button>
    </div> : <>
      <label className="block text-xs font-bold">WhatsApp Business Account ID (WABA ID)<input value={wabaId} onChange={event => setWabaId(event.target.value)} className={input} /></label>
      <label className="block text-xs font-bold">Phone Number ID<input value={phoneNumberId} onChange={event => setPhoneNumberId(event.target.value)} className={input} /></label>
      <label className="block text-xs font-bold">Access token<input type="password" autoComplete="off" value={accessToken} onChange={event => setAccessToken(event.target.value)} className={input} /></label>
      <button type="button" disabled={!webhookUrl || saving || (!existingInbox && !name.trim()) || !wabaId.trim() || !phoneNumberId.trim() || !accessToken.trim()} onClick={() => void saveManual()} className="w-full rounded-xl bg-[#00a884] py-3 text-xs font-bold text-white disabled:opacity-40">{saving ? <span className="flex justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Validando e salvando…</span> : existingInbox ? 'Adicionar Meta a esta inbox' : 'Validar e salvar conexão Meta'}</button>
    </>}
    {!webhookUrl && <p className="flex gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500"><AlertCircle className="h-4 w-4 shrink-0" />Configure VITE_BRIDGE_PUBLIC_URL antes de salvar.</p>}{error && <p className="flex gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}
    {existingInbox?.additionalAttributes.meta_onboarding_mode === 'coexistence' && <div className="rounded-xl border border-[#2a3942] p-4 text-xs"><b>Histórico do WhatsApp</b>{canSyncHistory ? <><p className="mt-1 text-[#8696a0]">{history?.running ? 'Importando mensagens históricas…' : history?.failed ? `${history.failed} itens precisam de nova tentativa.` : history?.imported ? `${history.imported} mensagens históricas sincronizadas.` : 'Histórico autorizado e pronto para sincronizar.'}</p><div className="mt-3 flex gap-2"><button type="button" disabled={historyLoading || history?.running} onClick={() => void importHistory(false)} className="rounded-lg bg-[#00a884] px-3 py-2 font-bold text-white disabled:opacity-40">{historyLoading || history?.running ? 'Importando…' : history?.imported ? 'Continuar sincronização' : 'Sincronizar'}</button>{history?.failed ? <button type="button" disabled={historyLoading || history.running} onClick={() => void importHistory(true)} className="rounded-lg border border-[#2a3942] px-3 py-2 font-bold disabled:opacity-40">Tentar novamente</button> : null}</div></> : <p className="mt-1 text-[#8696a0]">A Meta ainda não autorizou ou disponibilizou o histórico para esta conexão.</p>}</div>}
  </div>;
};
