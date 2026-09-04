import React, { useEffect, useState } from 'react';
import { ExternalLink, Folder } from 'lucide-react';
import { DASHBOARD_APP_SANDBOX, isAllowedDashboardAppUrl, nextEmbedStatus } from '../features/apps/embedPolicy';
import type { DashboardApp } from '../features/apps/dashboardApps';

export const DashboardAppEmbed: React.FC<{ app: DashboardApp | null; isDarkMode: boolean }> = ({ app, isDarkMode }) => {
  const [blocked, setBlocked] = useState(false);
  useEffect(() => { setBlocked(false); }, [app?.id]);
  if (!app) return <div className={`flex flex-1 items-center justify-center ${isDarkMode ? 'bg-[#151717] text-[#aebac1]' : 'bg-white text-[#667781]'}`}><div className="text-center"><Folder className="mx-auto mb-3" /><p>Aplicativo indisponível.</p></div></div>;
  const url = app.content[0]?.url || '';
  if (!isAllowedDashboardAppUrl(url, import.meta.env.DEV)) return <div className="flex flex-1 items-center justify-center">Aplicativo indisponível.</div>;
  return <main className={`flex min-w-0 flex-1 flex-col ${isDarkMode ? 'bg-[#151717] text-white' : 'bg-white text-[#111b21]'}`}><header className="flex items-center justify-between border-b border-white/10 p-3"><div><b>{app.title}</b><p className="text-xs text-[#8696a0]">Aplicativo incorporado</p></div><a href={url} target="_blank" rel="noopener noreferrer" aria-label="Abrir em nova aba"><ExternalLink /></a></header>{blocked && <div className="flex items-center justify-between border-b p-3 text-xs"><span>Este aplicativo não permite abertura incorporada.</span><a href={url} target="_blank" rel="noopener noreferrer" className="font-bold text-[#00a884]">Abrir em nova aba</a></div>}<iframe key={app.id} title={app.title} src={url} sandbox={DASHBOARD_APP_SANDBOX} referrerPolicy="strict-origin-when-cross-origin" onLoad={() => setBlocked(nextEmbedStatus('load') === 'blocked')} onError={() => setBlocked(nextEmbedStatus('error') === 'blocked')} className="min-h-0 flex-1 bg-white" /></main>;
};
