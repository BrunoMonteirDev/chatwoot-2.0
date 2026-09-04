import React, { useEffect, useState } from 'react';
import { dashboardApps, type DashboardApp } from '../features/apps/dashboardApps';
import { isAllowedDashboardAppUrl } from '../features/apps/embedPolicy';

export const DashboardAppsSettingsPanel = ({ accountId }: { accountId: number }) => {
  const [apps, setApps] = useState<DashboardApp[]>([]);
  const [editing, setEditing] = useState<DashboardApp | 'new' | null>(null);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState('');
  const reload = () => dashboardApps.list(accountId).then(setApps).catch(() => setError('Não foi possível carregar os aplicativos.'));
  useEffect(() => { void reload(); }, [accountId]);
  const edit = (app: DashboardApp | 'new') => { setEditing(app); setTitle(app === 'new' ? '' : app.title); setUrl(app === 'new' ? '' : app.content[0]?.url || ''); setEnabled(app === 'new' ? true : app.enabled); setError(''); };
  const save = async () => { if (!title.trim() || !isAllowedDashboardAppUrl(url, import.meta.env.DEV)) { setError('Informe nome e URL HTTPS válida.'); return; } const input = { title: title.trim(), url, enabled }; const app = editing === 'new' ? await dashboardApps.create(accountId, input) : await dashboardApps.update(accountId, (editing as DashboardApp).id, input); setApps(old => editing === 'new' ? [...old, app] : old.map(item => item.id === app.id ? app : item)); setEditing(null); };
  const toggle = async (app: DashboardApp) => { const updated = await dashboardApps.update(accountId, app.id, { title: app.title, url: app.content[0]?.url || '', enabled: !app.enabled }); setApps(old => old.map(item => item.id === updated.id ? updated : item)); };
  const remove = async (app: DashboardApp) => { if (!window.confirm(`Excluir ${app.title}?`)) return; await dashboardApps.remove(accountId, app.id); setApps(old => old.filter(item => item.id !== app.id)); };
  return <section className="space-y-4"><div className="flex items-center justify-between"><div><h3 className="text-lg font-bold">Apps</h3><p className="text-xs text-[#8696a0]">Gerenciamento administrativo de aplicativos incorporados.</p></div><button type="button" onClick={() => edit('new')} className="rounded bg-[#00a884] px-3 py-2 text-xs font-bold text-white">Adicionar app</button></div>{error && <p role="alert" className="text-xs text-red-400">{error}</p>}{editing && <div className="space-y-3 rounded-xl border p-4"><input aria-label="Nome do aplicativo" value={title} onChange={event => setTitle(event.target.value)} className="w-full rounded border p-2 text-black" placeholder="Nome" /><input aria-label="URL do aplicativo" value={url} onChange={event => setUrl(event.target.value)} className="w-full rounded border p-2 text-black" placeholder="https://app.exemplo.com" /><label className="flex gap-2 text-sm"><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} />Ativo para agentes</label><button type="button" onClick={() => void save()} className="rounded bg-[#00a884] px-3 py-2 text-xs font-bold text-white">Salvar</button></div>}<div className="space-y-2">{apps.map(app => <div key={app.id} className="flex items-center justify-between rounded-xl border p-3"><div><b className="text-sm">{app.title}</b><p className="text-xs text-[#8696a0]">{app.enabled ? 'Ativo' : 'Desativado'}</p></div><div className="flex gap-2 text-xs"><button type="button" onClick={() => void toggle(app)}>{app.enabled ? 'Desativar' : 'Ativar'}</button><button type="button" onClick={() => edit(app)}>Editar</button><button type="button" onClick={() => void remove(app)}>Excluir</button></div></div>)}</div></section>;
};
