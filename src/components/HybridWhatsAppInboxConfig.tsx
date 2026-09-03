import { AlertCircle, Link2, Loader2, Unlink } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { Inbox } from '../domain/currentUser';
import { errorMessageForUser } from '../integrations/chatwoot/errors';
import { inboxService, type HybridWahaBinding, type HybridWahaConfiguration } from '../integrations/chatwoot/inboxes';

type Props = { accountId: number; inbox: Inbox; isDarkMode: boolean; onChanged: () => Promise<void> | void };

const metaLabel = (inbox: Inbox) => ({ connected: 'Conectado', connecting: 'Conectando', disconnected: 'Desconectado', error: 'Erro' }[String(inbox.additionalAttributes.meta_connection_status)] || 'Conectado');
const wahaLabel = (status: HybridWahaBinding['wahaStatus']) => ({ connected: 'Conectado', connecting: 'Conectando', disconnected: 'Desconectado', error: 'Erro', not_bound: 'Não vinculado' }[status]);

export const HybridWhatsAppInboxConfig = ({ accountId, inbox, isDarkMode, onChanged }: Props) => {
  const [configuration, setConfiguration] = useState<HybridWahaConfiguration | null>(null);
  const [binding, setBinding] = useState<HybridWahaBinding | null>(null);
  const [session, setSession] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const card = isDarkMode ? 'border-[#2a3942] bg-[#111b21]' : 'border-gray-300 bg-white';

  const refresh = useCallback(async () => {
    const [nextConfiguration, nextBinding] = await Promise.all([
      inboxService.hybridWahaConfiguration(accountId, inbox.id),
      inboxService.hybridWahaBinding(accountId, inbox.id),
    ]);
    setConfiguration(nextConfiguration); setBinding(nextBinding); setSession(nextBinding.wahaSession || '');
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

  const bind = async () => {
    if (!session.trim() || busy) return;
    setBusy(true); setError(null);
    try { await inboxService.bindHybridWahaSession(accountId, inbox.id, session.trim()); await refresh(); await onChanged(); }
    catch (cause) { setError(errorMessageForUser(cause)); }
    finally { setBusy(false); }
  };

  const unbind = async () => {
    if (busy || !binding?.wahaSession) return;
    setBusy(true); setError(null);
    try { await inboxService.unbindHybridWahaSession(accountId, inbox.id); await refresh(); await onChanged(); }
    catch (cause) { setError(errorMessageForUser(cause)); }
    finally { setBusy(false); }
  };

  if (!configuration || !binding) return <div className={`rounded-xl border p-4 text-xs text-[#8696a0] ${card}`}><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Carregando modo híbrido…</div>;

  return <section className={`space-y-4 rounded-xl border p-4 ${card}`} data-testid="hybrid-whatsapp-config">
    <div><h4 className="text-sm font-bold">Modo híbrido</h4><p className="mt-1 text-xs text-[#8696a0]">O backend decide automaticamente entre Meta e WAHA. Não há seletor de provedor no composer.</p></div>
    <label className="flex cursor-pointer items-center justify-between gap-3 text-xs font-semibold"><span>Meta + WAHA</span><input aria-label="Meta + WAHA" type="checkbox" checked={configuration.hybridEnabled} disabled={busy} onChange={event => void saveConfiguration({ hybridEnabled: event.target.checked })} /></label>
    {configuration.hybridEnabled && <>
      <div className="rounded-lg border border-white/10 p-3 text-xs"><div className="flex items-center justify-between gap-2"><span className="font-semibold">Sessão WAHA</span><span className="text-[#8696a0]">{binding.wahaSession || 'Não vinculada'} · {wahaLabel(binding.wahaStatus)}</span></div><div className="mt-3 flex gap-2"><input aria-label="Sessão WAHA" value={session} onChange={event => setSession(event.target.value)} placeholder="Nome da sessão autorizada" disabled={busy} className="min-w-0 flex-1 rounded-lg border border-[#2a3942] bg-transparent px-2 py-1.5 text-xs" />{binding.wahaSession ? <button type="button" onClick={() => void unbind()} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 px-2 py-1.5 text-xs font-bold text-red-400"><Unlink className="h-3.5 w-3.5" />Desvincular</button> : <button type="button" onClick={() => void bind()} disabled={busy || !session.trim()} className="inline-flex items-center gap-1 rounded-lg bg-[#00a884] px-2 py-1.5 text-xs font-bold text-white"><Link2 className="h-3.5 w-3.5" />Vincular</button>}</div></div>
      <fieldset className="space-y-2 text-xs"><legend className="font-semibold">Fora da janela de atendimento</legend><label className="flex gap-2"><input type="radio" name="outside-window" checked={configuration.outOfWindowStrategy === 'template'} disabled={busy} onChange={() => void saveConfiguration({ outOfWindowStrategy: 'template' })} />Exigir Template Meta</label><label className="flex gap-2"><input type="radio" name="outside-window" checked={configuration.outOfWindowStrategy === 'waha'} disabled={busy} onChange={() => void saveConfiguration({ outOfWindowStrategy: 'waha' })} />Permitir texto livre pelo WAHA</label></fieldset>
      <fieldset className="space-y-2 text-xs"><legend className="font-semibold">Se Meta falhar</legend><label className="flex gap-2"><input type="radio" name="meta-failure" checked={configuration.metaFailureStrategy === 'block'} disabled={busy} onChange={() => void saveConfiguration({ metaFailureStrategy: 'block' })} />Bloquear envio</label><label className="flex gap-2"><input type="radio" name="meta-failure" checked={configuration.metaFailureStrategy === 'waha'} disabled={busy} onChange={() => void saveConfiguration({ metaFailureStrategy: 'waha' })} />Usar WAHA quando o fallback for seguro</label><p className="text-[#8696a0]">Falhas ambíguas da Meta não usam WAHA automaticamente para evitar mensagens duplicadas.</p></fieldset>
      <p className="rounded-lg bg-[#00a884]/10 p-2 text-xs text-[#8696a0]">Grupos serão enviados e recebidos pelo WAHA.</p>
    </>}
    <div className="flex gap-3 text-xs text-[#8696a0]"><span>Meta: {metaLabel(inbox)}</span><span>WAHA: {wahaLabel(binding.wahaStatus)}</span></div>
    {error && <p className="flex gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-500"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}
  </section>;
};
