import React, { useEffect, useState } from 'react';
import { ExternalLink, Folder, X } from 'lucide-react';
import { dashboardApps, type DashboardApp } from '../features/apps/dashboardApps';
import { DASHBOARD_APP_SANDBOX, isAllowedDashboardAppUrl, nextEmbedStatus, type EmbedStatus } from '../features/apps/embedPolicy';

interface Props { onClose: () => void; accountId: number | null; isDarkMode?: boolean; }

export const AppsView: React.FC<Props> = ({ onClose, accountId, isDarkMode = true }) => {
  const [apps, setApps] = useState<DashboardApp[]>([]);
  const [selected, setSelected] = useState<DashboardApp | null>(null);
  const [error, setError] = useState('');
  const [embedStatus, setEmbedStatus] = useState<EmbedStatus>('loading');

  useEffect(() => {
    setSelected(null);
    if (!accountId) return;
    dashboardApps.list(accountId).then(setApps).catch(() => setError('Não foi possível carregar os aplicativos desta conta.'));
  }, [accountId]);
  useEffect(() => setEmbedStatus('loading'), [selected?.id]);

  const selectedUrl = selected?.content[0]?.url ?? '';
  const isSafeEmbedUrl = isAllowedDashboardAppUrl(selectedUrl, import.meta.env.DEV);
  return <div className={`flex flex-1 min-w-0 flex-col md:flex-row ${isDarkMode ? 'bg-[#151717] text-white' : 'bg-white text-[#111b21]'}`}>
    <aside className="w-full shrink-0 border-b border-[#242525] p-3 md:w-80 md:border-b-0 md:border-r"><header className="flex items-center justify-between"><span className="flex items-center gap-2 font-bold"><Folder className="text-[#00a884]" />Apps</span><button type="button" aria-label="Voltar para conversas" onClick={onClose}><X /></button></header>{error && <p role="alert" className="mt-3 text-xs text-red-400">{error}</p>}<div className="mt-3 space-y-1">{apps.map(app => <button key={app.id} type="button" onClick={() => setSelected(app)} className={`w-full rounded-lg p-2 text-left ${selected?.id === app.id ? 'bg-[#00a884]/15' : ''}`}><b className="block truncate text-sm">{app.title}</b></button>)}{!apps.length && !error && <p className="p-4 text-center text-xs text-[#8696a0]">Nenhum app disponível nesta conta.</p>}</div></aside>
    <main className="min-h-0 min-w-0 flex flex-1 flex-col">{selected && selectedUrl ? <><header className="flex items-center justify-between border-b p-3"><div><b>{selected.title}</b><p className="text-xs text-[#8696a0]">Aplicativo incorporado</p></div>{isSafeEmbedUrl && <a href={selectedUrl} target="_blank" rel="noopener noreferrer" aria-label="Abrir em nova aba"><ExternalLink /></a>}</header>{!isSafeEmbedUrl ? <div className="p-3 text-xs">A URL deste aplicativo não é permitida.</div> : embedStatus === 'blocked' ? <div className="flex items-center justify-between border-b p-3 text-xs"><span>Este aplicativo não permite abertura incorporada.</span><a href={selectedUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-[#00a884]">Abrir em nova aba</a></div> : <div className="relative min-h-0 flex-1">{embedStatus === 'loading' && <div role="status" className="absolute inset-0 z-10 flex items-center justify-center bg-white text-xs text-[#667781]">Carregando aplicativo…</div>}<iframe title={selected.title} src={selectedUrl} sandbox={DASHBOARD_APP_SANDBOX} referrerPolicy="strict-origin-when-cross-origin" onLoad={() => setEmbedStatus(nextEmbedStatus('load'))} onError={() => setEmbedStatus(nextEmbedStatus('error'))} className="h-full w-full border-0 bg-white" /></div>}</> : <div className="m-auto text-center text-[#8696a0]"><Folder className="mx-auto mb-3" />Selecione um aplicativo para abrir.</div>}</main>
  </div>;
};
