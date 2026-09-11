import { AlertCircle, Loader2, LogOut, QrCode, RotateCcw, Save, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import type { Inbox } from '../domain/currentUser';
import { errorMessageForUser } from '../integrations/chatwoot/errors';
import { inboxService } from '../integrations/chatwoot/inboxes';
import { wahaClient, type WahaInboxConnection, type WahaQrCode } from '../integrations/waha/client';
import { InboxCollaboratorsPanel } from './InboxCollaboratorsPanel';

interface Props {
  accountId: number;
  inbox: Inbox;
  isDarkMode: boolean;
  onSaved?: () => Promise<void> | void;
}

const qrSource = (qr: WahaQrCode) => qr.data.startsWith('data:') ? qr.data : `data:${qr.mimetype};base64,${qr.data}`;
const connectedNumber = (connection: WahaInboxConnection) => connection.me?.id?.replace(/@.+$/, '') || '';

export const WahaSetup = ({ accountId, inbox, isDarkMode, onSaved }: Props) => {
  const context = { accountId, inboxId: inbox.id };
  const [tab, setTab] = useState<'connection' | 'general' | 'collaborators'>('connection');
  const [connection, setConnection] = useState<WahaInboxConnection | null>(null);
  const [qr, setQr] = useState<WahaQrCode | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(inbox.name);

  const refreshConnection = useCallback(async () => {
    const result = await wahaClient.getInboxConnection({ accountId, inboxId: inbox.id });
    setConnection(result.connection);
    if (result.connection?.connectionStatus === 'connected') {
      setQr(null);
      setPairing(false);
    }
    return result.connection;
  }, [accountId, inbox.id]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    wahaClient.getInboxConnection(context)
      .then(result => { if (active) setConnection(result.connection); })
      .catch(cause => { if (active) setError(errorMessageForUser(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [accountId, inbox.id]);

  useEffect(() => {
    if (!pairing) return;
    const timer = window.setInterval(() => {
      void refreshConnection().then(current => {
        if (current?.connectionStatus === 'connected') void onSaved?.();
      }).catch(cause => setError(errorMessageForUser(cause)));
    }, 1500);
    return () => window.clearInterval(timer);
  }, [onSaved, pairing, refreshConnection]);

  const perform = async (operation: () => Promise<{ connection: WahaInboxConnection; qr?: WahaQrCode }>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await operation();
      setConnection(result.connection);
      setQr(result.qr || null);
      setPairing(result.connection.connectionStatus === 'connecting');
      await onSaved?.();
    } catch (cause) {
      setError(errorMessageForUser(cause));
    } finally {
      setBusy(false);
    }
  };

  const showQr = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      setQr(await wahaClient.getInboxQrCode(context));
      setPairing(true);
    } catch (cause) {
      setError(errorMessageForUser(cause));
    } finally {
      setBusy(false);
    }
  };

  const deleteConnection = async () => {
    if (!window.confirm('Excluir a conexão deste WhatsApp? A caixa de entrada e suas conversas serão preservadas.')) return;
    setBusy(true);
    setError(null);
    try {
      await wahaClient.deleteInboxConnection(context);
      setConnection(null);
      setQr(null);
      setPairing(false);
      await onSaved?.();
    } catch (cause) {
      setError(errorMessageForUser(cause));
    } finally {
      setBusy(false);
    }
  };

  const disconnectConnection = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await wahaClient.disconnectInbox(context);
      setConnection(result.connection);
      setQr(null);
      setPairing(false);
      await onSaved?.();
    } catch (cause) {
      setConnection(null);
      setQr(null);
      setPairing(false);
      setError(errorMessageForUser(cause));
    } finally {
      setBusy(false);
    }
  };

  const saveName = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await inboxService.updateName(accountId, inbox.id, name.trim());
      await onSaved?.();
    } catch (cause) {
      setError(errorMessageForUser(cause));
    } finally {
      setBusy(false);
    }
  };

  const connected = connection?.connectionStatus === 'connected';
  const panel = isDarkMode ? 'border-[#2a3942] bg-[#111b21]' : 'border-gray-200 bg-white';
  const button = 'inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40';

  return <div className={`rounded-2xl border p-4 sm:p-6 ${panel}`}>
    <div className="flex flex-wrap gap-2 border-b border-white/10 pb-4">
      {([['connection', 'WhatsApp'], ['general', 'Geral'], ['collaborators', 'Colaboradores']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setTab(value)} className={`rounded-lg px-3 py-2 text-xs font-bold ${tab === value ? 'bg-[#00a884] text-white' : 'text-[#8696a0] hover:bg-white/5'}`}>{label}</button>)}
    </div>

    {error && <p role="alert" className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}

    {tab === 'connection' && <section className="mt-5">
      {loading ? <p className="flex items-center gap-2 text-sm text-[#8696a0]"><Loader2 className="h-4 w-4 animate-spin" />Consultando conexão…</p> : <>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-sm font-bold">{connected ? 'WhatsApp conectado' : 'WhatsApp não conectado'}</p>{connected && (connection?.me?.pushName || connectedNumber(connection)) && <p className="mt-1 text-xs text-[#8696a0]">{[connection?.me?.pushName, connectedNumber(connection)].filter(Boolean).join(' · ')}</p>}</div>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${connected ? 'bg-[#00a884]/15 text-[#00a884]' : 'bg-amber-500/15 text-amber-500'}`}>{connected ? 'Conectado' : connection ? 'Aguardando conexão' : 'Desconectado'}</span>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {!connection && <button type="button" onClick={() => void perform(() => wahaClient.connectInbox(context))} disabled={busy} className={`${button} border-[#00a884] bg-[#00a884] text-white`}><QrCode className="h-4 w-4" />Conectar por QR Code</button>}
          {connection && !connected && <button type="button" onClick={() => void showQr()} disabled={busy} className={`${button} border-[#00a884]/50 text-[#00a884]`}><QrCode className="h-4 w-4" />Conectar por QR Code</button>}
          {connection && <button type="button" onClick={() => void perform(() => wahaClient.reconnectInbox(context))} disabled={busy} className={`${button} border-white/20`}><RotateCcw className="h-4 w-4" />Reconectar</button>}
          {connected && <button type="button" onClick={() => void disconnectConnection()} disabled={busy} className={`${button} border-amber-500/40 text-amber-500`}><LogOut className="h-4 w-4" />Desconectar</button>}
          {connection && <button type="button" onClick={() => void deleteConnection()} disabled={busy} className={`${button} border-red-500/40 text-red-400`}><Trash2 className="h-4 w-4" />Excluir conexão</button>}
        </div>

        {busy && <p className="mt-3 flex items-center gap-2 text-xs text-[#8696a0]"><Loader2 className="h-3.5 w-3.5 animate-spin" />Preparando conexão…</p>}
        {qr && !connected && <div className="mt-5 rounded-xl border border-[#00a884]/30 bg-[#00a884]/5 p-4"><p className="text-xs font-semibold">No celular, abra WhatsApp → Aparelhos conectados → Conectar aparelho.</p><img className="mt-3 h-56 w-56 max-w-full rounded-lg bg-white p-2" alt="QR Code do WhatsApp" src={qrSource(qr)} /><p className="mt-2 text-[11px] text-[#8696a0]">Esta tela será atualizada automaticamente depois da leitura.</p></div>}
      </>}
    </section>}

    {tab === 'general' && <section className="mt-5"><h4 className="text-sm font-bold">Dados da caixa de entrada</h4><label className="mt-4 block text-xs font-semibold">Nome<input value={name} onChange={event => setName(event.target.value)} className={`mt-2 block w-full rounded-lg border px-3 py-2 text-sm outline-none ${isDarkMode ? 'border-[#2a3942] bg-[#202c33]' : 'border-gray-200 bg-white'}`} /></label><button type="button" onClick={() => void saveName()} disabled={busy || !name.trim()} className={`${button} mt-3 border-[#00a884] bg-[#00a884] text-white`}><Save className="h-4 w-4" />Salvar</button></section>}
    {tab === 'collaborators' && <div className="mt-5"><InboxCollaboratorsPanel accountId={accountId} inboxId={inbox.id} isDarkMode={isDarkMode} onSaved={onSaved} /></div>}
  </div>;
};
