import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { inboxService } from '../integrations/chatwoot/inboxes';
import { listenForEmbeddedSignupEvents, openEmbeddedSignup, type MetaEmbeddedSignupEventResult } from '../integrations/meta/embeddedSignup';
import type { Inbox } from '../domain/currentUser';
import { errorMessageForUser } from '../integrations/chatwoot/errors';
import { InboxCollaboratorsPanel } from './InboxCollaboratorsPanel';
import { HybridWhatsAppInboxConfig } from './HybridWhatsAppInboxConfig';

interface Props {
  accountId: number;
  // Existing callers may still pass this. Native webhook ownership is Chatwoot's.
  webhookUrl?: string;
  isDarkMode: boolean;
  inbox?: Inbox | null;
  onSaved: (inbox: Inbox) => Promise<void> | void;
}

type EmbeddedStage = 'idle' | 'opening' | 'waiting' | 'authorizing' | 'creating' | 'connected' | 'error';
type NativeMetaConnectionState = 'connected' | 'connecting' | 'reauthorization_required' | 'disconnected' | 'error';
const stageLabel: Record<Exclude<EmbeddedStage, 'idle' | 'error' | 'connected'>, string> = {
  opening: 'Carregando o cadastro da Meta…', waiting: 'Conclua o cadastro na Meta…', authorizing: 'Autorização recebida…', creating: 'Criando a inbox oficial no Chatwoot…',
};

export const nativeMetaConnectionState = (inbox: Inbox): NativeMetaConnectionState => {
  if (inbox.reauthorizationRequired) return 'reauthorization_required';
  const status = inbox.additionalAttributes.meta_connection_status;
  if (status === 'connecting') return 'connecting';
  if (status === 'disconnected' || status === 'error') return status;
  // Channel::Whatsapp persists `connected` by default. Missing operational
  // metadata must never be interpreted as a WAHA/Evolution disconnection.
  return 'connected';
};

const nativeMetaStatus = (state: NativeMetaConnectionState) => ({
  connected: { label: 'Conectado', detail: 'A Meta Cloud API está operacional.', className: 'border-[#00a884]/35 bg-[#00a884]/10 text-[#00a884]' },
  connecting: { label: 'Conectando', detail: 'A Meta está verificando a conexão.', className: 'border-amber-500/30 bg-amber-500/10 text-amber-600' },
  reauthorization_required: { label: 'Reautorização necessária', detail: 'A autorização da Meta precisa ser renovada.', className: 'border-amber-500/30 bg-amber-500/10 text-amber-600' },
  disconnected: { label: 'Desconectado', detail: 'A Meta reportou que a conexão não está disponível.', className: 'border-red-500/30 bg-red-500/10 text-red-500' },
  error: { label: 'Erro de conexão', detail: 'A Meta reportou um erro de conexão.', className: 'border-red-500/30 bg-red-500/10 text-red-500' },
})[state];

const maskedIdentifier = (value: string) => value.length <= 4 ? value : `••••${value.slice(-4)}`;

export const MetaCloudSetup = ({ accountId, isDarkMode, inbox: existingInbox, onSaved }: Props) => {
  const [creationMethod, setCreationMethod] = useState<'choice' | 'embedded' | 'manual'>('choice');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState<'connection' | 'hybrid' | 'collaborators'>('connection');
  const [embeddedStage, setEmbeddedStage] = useState<EmbeddedStage>('idle');
  const [templateSync, setTemplateSync] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [manual, setManual] = useState({ name: '', phoneNumber: '', phoneNumberId: '', businessAccountId: '', accessToken: '' });
  const codeRef = useRef<string | null>(null);
  const resultRef = useRef<MetaEmbeddedSignupEventResult | null>(null);
  const completingRef = useRef(false);
  const completeRef = useRef<() => Promise<void>>(async () => {});
  const nativeInbox = existingInbox?.channelType === 'Channel::Whatsapp';
  const connectionState = nativeInbox ? nativeMetaConnectionState(existingInbox) : null;
  const connection = connectionState ? nativeMetaStatus(connectionState) : null;
  const canReauthorize = connectionState === 'reauthorization_required' || connectionState === 'disconnected' || connectionState === 'error';
  const card = isDarkMode ? 'border-[#2a3942] bg-[#111b21]' : 'border-gray-300 bg-white';

  useEffect(() => {
    setCreationMethod('choice'); setError(null); setSaving(false); setSection('connection');
    setEmbeddedStage('idle'); setTemplateSync('idle');
    setManual({ name: '', phoneNumber: '', phoneNumberId: '', businessAccountId: '', accessToken: '' });
  }, [accountId]);

  const reset = () => { codeRef.current = null; resultRef.current = null; completingRef.current = false; };

  completeRef.current = async () => {
    const code = codeRef.current;
    const result = resultRef.current;
    if (!code || !result || completingRef.current) return;
    completingRef.current = true;
    setEmbeddedStage('creating');
    try {
      const input = { code, businessId: result.businessId || '', wabaId: result.wabaId, phoneNumberId: result.phoneNumberId, onboardingMode: result.onboardingMode };
      const saved = nativeInbox
        ? await inboxService.reauthorizeNativeWhatsAppInbox(accountId, existingInbox.id, input)
        : await inboxService.createNativeWhatsAppInbox(accountId, input);
      setEmbeddedStage('connected'); setSaving(false); reset(); await onSaved(saved);
    } catch (cause) {
      setEmbeddedStage('error'); setSaving(false); completingRef.current = false; setError(errorMessageForUser(cause));
    }
  };

  useEffect(() => listenForEmbeddedSignupEvents(event => {
    if (!event || !saving) return;
    if (event.kind === 'cancelled') { reset(); setSaving(false); setEmbeddedStage('idle'); setError('O Cadastro Incorporado foi cancelado.'); return; }
    if (event.kind === 'error') { reset(); setSaving(false); setEmbeddedStage('error'); setError('A Meta retornou dados incompletos para o Cadastro Incorporado.'); return; }
    resultRef.current = event.result;
    setEmbeddedStage('authorizing');
    void completeRef.current();
  }), [saving]);

  const startEmbedded = async () => {
    if (saving || (existingInbox && !nativeInbox)) return;
    setSaving(true); setError(null); reset(); setEmbeddedStage('opening');
    try {
      const publicConfig = await inboxService.nativeWhatsAppEmbeddedSignupConfig(accountId);
      setEmbeddedStage('waiting');
      codeRef.current = await openEmbeddedSignup({ ...publicConfig, embeddedSignupVersion: 4 });
      setEmbeddedStage('authorizing');
      await completeRef.current();
    } catch (cause) {
      reset(); setSaving(false); setEmbeddedStage('error'); setError(errorMessageForUser(cause));
    }
  };

  const syncTemplates = async () => {
    if (!existingInbox || templateSync === 'loading') return;
    setTemplateSync('loading'); setError(null);
    try { await inboxService.syncWhatsAppTemplates(accountId, existingInbox.id); setTemplateSync('success'); await onSaved(existingInbox); }
    catch (cause) { setTemplateSync('error'); setError(errorMessageForUser(cause)); }
  };

  const createManual = async () => {
    if (saving) return;
    const values = { name: manual.name.trim(), phoneNumber: manual.phoneNumber.trim(), phoneNumberId: manual.phoneNumberId.trim(), businessAccountId: manual.businessAccountId.trim(), accessToken: manual.accessToken.trim() };
    if (!values.name || !values.phoneNumber || !values.phoneNumberId || !values.businessAccountId || !values.accessToken) {
      setError('Preencha todos os campos da configuração manual.'); return;
    }
    if (!/^\+[1-9]\d{7,14}$/.test(values.phoneNumber)) {
      setError('Informe o número no formato internacional, por exemplo +5511999999999.'); return;
    }
    if (!/^\d+$/.test(values.phoneNumberId) || !/^\d+$/.test(values.businessAccountId)) {
      setError('Phone Number ID e WABA devem conter somente números.'); return;
    }
    setSaving(true); setError(null);
    try {
      const created = await inboxService.createManualMetaInbox(accountId, values);
      setManual(current => ({ ...current, accessToken: '' }));
      await onSaved(created.inbox);
    } catch (cause) {
      setManual(current => ({ ...current, accessToken: '' }));
      setError(errorMessageForUser(cause));
    } finally { setSaving(false); }
  };

  const manualField = `mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-[#00a884] ${isDarkMode ? 'border-[#2a3942] bg-[#111b21]' : 'border-gray-300 bg-white'}`;
  if (!existingInbox && creationMethod === 'choice') return <div className="max-w-2xl space-y-4"><div><h4 className="font-bold">WhatsApp oficial</h4><p className="mt-1 text-xs text-[#8696a0]">Escolha como configurar a conexão Meta desta inbox.</p></div><div className="grid gap-3 md:grid-cols-2"><button type="button" onClick={() => { setError(null); setCreationMethod('embedded'); }} className={`rounded-xl border p-4 text-left ${card}`}><p className="text-sm font-bold">Meta Embedded Signup</p><p className="mt-2 text-xs text-[#8696a0]">Autoriza pela Meta e cria a inbox automaticamente.</p></button><button type="button" onClick={() => { setError(null); setCreationMethod('manual'); }} className={`rounded-xl border p-4 text-left ${card}`}><p className="text-sm font-bold">Configuração manual</p><p className="mt-2 text-xs text-[#8696a0]">Use credenciais de uma conta e número já configurados na Meta.</p></button></div></div>;

  if (!existingInbox && creationMethod === 'manual') return <div className="max-w-lg space-y-4"><div className="flex items-start justify-between gap-3"><div><h4 className="font-bold">Configuração manual da Meta</h4><p className="mt-1 text-xs text-[#8696a0]">A credencial será enviada diretamente ao Chatwoot e não será salva no navegador.</p></div><button type="button" onClick={() => { setError(null); setCreationMethod('choice'); }} className="text-xs font-bold text-[#00a884]">Trocar método</button></div><form className={`space-y-3 rounded-xl border p-4 ${card}`} onSubmit={event => { event.preventDefault(); void createManual(); }}><label className="block text-xs font-bold">Nome da caixa de entrada<input name="inboxName" autoComplete="off" value={manual.name} onChange={event => setManual(current => ({ ...current, name: event.target.value }))} className={manualField} /></label><label className="block text-xs font-bold">Número de telefone<input name="phoneNumber" autoComplete="tel" placeholder="+5511999999999" value={manual.phoneNumber} onChange={event => setManual(current => ({ ...current, phoneNumber: event.target.value }))} className={manualField} /></label><label className="block text-xs font-bold">Phone Number ID<input name="phoneNumberId" inputMode="numeric" autoComplete="off" value={manual.phoneNumberId} onChange={event => setManual(current => ({ ...current, phoneNumberId: event.target.value }))} className={manualField} /></label><label className="block text-xs font-bold">WABA / Business Account ID<input name="businessAccountId" inputMode="numeric" autoComplete="off" value={manual.businessAccountId} onChange={event => setManual(current => ({ ...current, businessAccountId: event.target.value }))} className={manualField} /></label><label className="block text-xs font-bold">Access Token / Chave da API<input name="accessToken" type="password" autoComplete="new-password" spellCheck={false} value={manual.accessToken} onChange={event => setManual(current => ({ ...current, accessToken: event.target.value }))} className={manualField} /></label>{error && <p role="alert" className="flex gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}<button type="submit" disabled={saving} className="flex w-full justify-center gap-2 rounded-xl bg-[#00a884] py-3 text-xs font-bold text-white disabled:opacity-40">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{saving ? 'Validando credenciais…' : 'Criar inbox oficial'}</button></form></div>;

  return <div className="max-w-lg space-y-4">
    <div className="flex items-start justify-between gap-3"><div><h4 className="font-bold">API oficial do WhatsApp</h4><p className="mt-1 text-xs text-[#8696a0]">O Chatwoot criará e administrará uma inbox nativa <code>Channel::Whatsapp</code>. Tokens e webhook permanecem no backend do Chatwoot.</p></div>{!existingInbox && <button type="button" onClick={() => { setError(null); setCreationMethod('choice'); }} className="shrink-0 text-xs font-bold text-[#00a884]">Trocar método</button>}</div>
    {existingInbox && !nativeInbox && <p className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600"><AlertCircle className="h-4 w-4 shrink-0" />Esta inbox não é WhatsApp nativa. Para evitar híbrido nesta fase, crie uma nova inbox oficial.</p>}
    {nativeInbox && <div className="flex gap-1 overflow-x-auto border-b border-white/10 px-1"><button type="button" onClick={() => setSection('connection')} className={`rounded-t-lg px-3 py-2 text-xs font-semibold ${section === 'connection' ? 'bg-[#00a884] text-white' : 'text-[#8696a0] hover:bg-white/5'}`}>WhatsApp oficial</button><button type="button" onClick={() => setSection('hybrid')} className={`rounded-t-lg px-3 py-2 text-xs font-semibold ${section === 'hybrid' ? 'bg-[#00a884] text-white' : 'text-[#8696a0] hover:bg-white/5'}`}>WhatsApp Híbrido</button><button type="button" onClick={() => setSection('collaborators')} className={`rounded-t-lg px-3 py-2 text-xs font-semibold ${section === 'collaborators' ? 'bg-[#00a884] text-white' : 'text-[#8696a0] hover:bg-white/5'}`}>Colaboradores</button></div>}
    {nativeInbox && section === 'hybrid' ? <HybridWhatsAppInboxConfig accountId={accountId} inbox={existingInbox} isDarkMode={isDarkMode} onChanged={async () => { await onSaved(existingInbox); }} /> : nativeInbox && section === 'collaborators' ? <InboxCollaboratorsPanel accountId={accountId} inboxId={existingInbox.id} isDarkMode={isDarkMode} onSaved={async () => { await onSaved(existingInbox); }} /> : <div className={`space-y-3 rounded-xl border p-4 ${card}`}>
      {nativeInbox && connection && <><div className={`rounded-xl border p-3 text-xs ${connection.className}`}><p className="font-bold">Meta Cloud API · {connection.label}</p><p className="mt-1 opacity-80">{connection.detail}</p></div><dl className="grid gap-2 rounded-xl border border-white/10 bg-black/10 p-3 text-xs"><div className="flex justify-between gap-4"><dt className="text-[#8696a0]">Inbox</dt><dd className="text-right font-medium">{existingInbox.name}</dd></div><div className="flex justify-between gap-4"><dt className="text-[#8696a0]">Provider</dt><dd className="text-right font-medium">Meta Cloud API</dd></div>{existingInbox.phoneNumber && <div className="flex justify-between gap-4"><dt className="text-[#8696a0]">Número WhatsApp</dt><dd className="text-right font-medium">{existingInbox.phoneNumber}</dd></div>}{existingInbox.metaBusinessAccountId && <div className="flex justify-between gap-4"><dt className="text-[#8696a0]">WABA</dt><dd className="text-right font-medium">{maskedIdentifier(existingInbox.metaBusinessAccountId)}</dd></div>}{existingInbox.metaPhoneNumberId && <div className="flex justify-between gap-4"><dt className="text-[#8696a0]">Phone Number ID</dt><dd className="text-right font-medium">{maskedIdentifier(existingInbox.metaPhoneNumberId)}</dd></div>}</dl></>}
      <p className="text-xs text-[#8696a0]">O fluxo nativo da Meta oferece número novo/API ou WhatsApp Business App com coexistência. A confirmação vem do evento oficial; esta interface não grava metadados ou tokens paralelos.</p>
      {embeddedStage === 'connected' && <p className="flex items-center gap-2 text-xs text-[#00a884]"><CheckCircle2 className="h-4 w-4" />Inbox oficial conectada pelo Chatwoot.</p>}
      {saving && embeddedStage !== 'idle' && embeddedStage !== 'error' ? <p className="flex items-center gap-2 text-xs text-[#8696a0]"><Loader2 className="h-4 w-4 animate-spin" />{stageLabel[embeddedStage as Exclude<EmbeddedStage, 'idle' | 'error' | 'connected'>]}</p> : null}
      {nativeInbox && <div className="space-y-2"><button type="button" disabled={templateSync === 'loading'} onClick={() => void syncTemplates()} className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#00a884]/40 py-2.5 text-xs font-bold text-[#00a884] disabled:opacity-40"><RefreshCw className={`h-4 w-4 ${templateSync === 'loading' ? 'animate-spin' : ''}`} />{templateSync === 'loading' ? 'Sincronizando templates…' : 'Sincronizar templates'}</button>{templateSync === 'success' && <p className="text-center text-xs text-[#00a884]">Sincronização de templates iniciada com sucesso.</p>}</div>}
      {(!nativeInbox || canReauthorize) && <button type="button" disabled={saving || Boolean(existingInbox && !nativeInbox)} onClick={() => void startEmbedded()} className="w-full rounded-xl bg-[#00a884] py-3 text-xs font-bold text-white disabled:opacity-40">{nativeInbox ? 'Reautorizar WhatsApp Business' : 'Conectar WhatsApp Business'}</button>}
    </div>}
    {error && <p className="flex gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}
  </div>;
};
