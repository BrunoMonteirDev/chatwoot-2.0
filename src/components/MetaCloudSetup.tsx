import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { inboxService } from '../integrations/chatwoot/inboxes';
import { listenForEmbeddedSignupEvents, openEmbeddedSignup, type MetaEmbeddedSignupEventResult } from '../integrations/meta/embeddedSignup';
import type { Inbox } from '../domain/currentUser';
import { errorMessageForUser } from '../integrations/chatwoot/errors';
import { InboxCollaboratorsPanel } from './InboxCollaboratorsPanel';

interface Props {
  accountId: number;
  // Existing callers may still pass this. Native webhook ownership is Chatwoot's.
  webhookUrl?: string;
  isDarkMode: boolean;
  inbox?: Inbox | null;
  onSaved: (inbox: Inbox) => Promise<void> | void;
}

type EmbeddedStage = 'idle' | 'opening' | 'waiting' | 'authorizing' | 'creating' | 'connected' | 'error';
const stageLabel: Record<Exclude<EmbeddedStage, 'idle' | 'error' | 'connected'>, string> = {
  opening: 'Carregando o cadastro da Meta…', waiting: 'Conclua o cadastro na Meta…', authorizing: 'Autorização recebida…', creating: 'Criando a inbox oficial no Chatwoot…',
};

export const MetaCloudSetup = ({ accountId, isDarkMode, inbox: existingInbox, onSaved }: Props) => {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState<'connection' | 'collaborators'>('connection');
  const [embeddedStage, setEmbeddedStage] = useState<EmbeddedStage>('idle');
  const codeRef = useRef<string | null>(null);
  const resultRef = useRef<MetaEmbeddedSignupEventResult | null>(null);
  const completingRef = useRef(false);
  const completeRef = useRef<() => Promise<void>>(async () => {});
  const nativeInbox = existingInbox?.channelType === 'Channel::Whatsapp';
  const card = isDarkMode ? 'border-[#2a3942] bg-[#111b21]' : 'border-gray-300 bg-white';

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

  return <div className="max-w-lg space-y-4">
    <div><h4 className="font-bold">API oficial do WhatsApp</h4><p className="mt-1 text-xs text-[#8696a0]">O Chatwoot criará e administrará uma inbox nativa <code>Channel::Whatsapp</code>. Tokens e webhook permanecem no backend do Chatwoot.</p></div>
    {existingInbox && !nativeInbox && <p className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600"><AlertCircle className="h-4 w-4 shrink-0" />Esta inbox não é WhatsApp nativa. Para evitar híbrido nesta fase, crie uma nova inbox oficial.</p>}
    {nativeInbox && <div className="flex gap-1 overflow-x-auto border-b border-white/10 px-1"><button type="button" onClick={() => setSection('connection')} className={`rounded-t-lg px-3 py-2 text-xs font-semibold ${section === 'connection' ? 'bg-[#00a884] text-white' : 'text-[#8696a0] hover:bg-white/5'}`}>WhatsApp oficial</button><button type="button" onClick={() => setSection('collaborators')} className={`rounded-t-lg px-3 py-2 text-xs font-semibold ${section === 'collaborators' ? 'bg-[#00a884] text-white' : 'text-[#8696a0] hover:bg-white/5'}`}>Colaboradores</button></div>}
    {nativeInbox && section === 'collaborators' ? <InboxCollaboratorsPanel accountId={accountId} inboxId={existingInbox.id} isDarkMode={isDarkMode} onSaved={async () => { await onSaved(existingInbox); }} /> : <div className={`space-y-3 rounded-xl border p-4 ${card}`}>
      <p className="text-xs text-[#8696a0]">O fluxo nativo da Meta oferece número novo/API ou WhatsApp Business App com coexistência. A confirmação vem do evento oficial; esta interface não grava metadados ou tokens paralelos.</p>
      {embeddedStage === 'connected' && <p className="flex items-center gap-2 text-xs text-[#00a884]"><CheckCircle2 className="h-4 w-4" />Inbox oficial conectada pelo Chatwoot.</p>}
      {saving && embeddedStage !== 'idle' && embeddedStage !== 'error' ? <p className="flex items-center gap-2 text-xs text-[#8696a0]"><Loader2 className="h-4 w-4 animate-spin" />{stageLabel[embeddedStage as Exclude<EmbeddedStage, 'idle' | 'error' | 'connected'>]}</p> : null}
      <button type="button" disabled={saving || Boolean(existingInbox && !nativeInbox)} onClick={() => void startEmbedded()} className="w-full rounded-xl bg-[#00a884] py-3 text-xs font-bold text-white disabled:opacity-40">{nativeInbox ? 'Conectar/reautorizar WhatsApp Business' : 'Conectar WhatsApp Business'}</button>
    </div>}
    {error && <p className="flex gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}
  </div>;
};
