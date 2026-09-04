import React, { useEffect, useMemo, useState } from 'react';
import { Edit3, ExternalLink, LayoutGrid, Plus, Power, Trash2 } from 'lucide-react';
import { dashboardApps, type DashboardApp } from '../features/apps/dashboardApps';
import { isAllowedDashboardAppUrl } from '../features/apps/embedPolicy';

export const DashboardAppsSettingsPanel = ({ accountId }: { accountId: number }) => {
  const [apps, setApps] = useState<DashboardApp[]>([]);
  const [editing, setEditing] = useState<DashboardApp | 'new' | null>(null);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const orderedApps = useMemo(() => [...apps].sort((left, right) => left.id - right.id), [apps]);
  const reload = () => dashboardApps.list(accountId).then(setApps).catch(() => setError('Não foi possível carregar os aplicativos.'));
  useEffect(() => { void reload(); }, [accountId]);

  const edit = (app: DashboardApp | 'new') => { setEditing(app); setTitle(app === 'new' ? '' : app.title); setUrl(app === 'new' ? '' : app.content[0]?.url || ''); setEnabled(app === 'new' ? true : app.enabled); setError(''); };
  const save = async () => {
    if (!title.trim() || !isAllowedDashboardAppUrl(url, import.meta.env.DEV)) { setError('Informe nome e URL HTTPS válida.'); return; }
    setBusy(true);
    try { const input = { title: title.trim(), url, enabled }; editing === 'new' ? await dashboardApps.create(accountId, input) : await dashboardApps.update(accountId, (editing as DashboardApp).id, input); setEditing(null); await reload(); }
    catch { setError('Não foi possível salvar o aplicativo.'); }
    finally { setBusy(false); }
  };
  const toggle = async (app: DashboardApp) => { setBusy(true); try { await dashboardApps.update(accountId, app.id, { title: app.title, url: app.content[0]?.url || '', enabled: !app.enabled }); await reload(); } catch { setError('Não foi possível atualizar o status.'); } finally { setBusy(false); } };
  const remove = async (app: DashboardApp) => { if (!window.confirm(`Remover ${app.title}? Esta ação não pode ser desfeita.`)) return; setBusy(true); try { await dashboardApps.remove(accountId, app.id); await reload(); } catch { setError('Não foi possível remover o aplicativo.'); } finally { setBusy(false); } };

  return <section className="space-y-4"><header className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 text-lg font-bold"><LayoutGrid className="h-5 w-5 text-[#00a884]" />Aplicativos do painel</h3><p className="text-xs text-[#8696a0]">Apps incorporados desta conta. A sidebar usa somente os ativos.</p></div><button type="button" onClick={() => edit('new')} className="rounded bg-[#00a884] px-3 py-2 text-xs font-bold text-white"><Plus className="mr-1 inline h-4 w-4" />Novo aplicativo</button></header>
    {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
    {editing && <form onSubmit={event => { event.preventDefault(); void save(); }} className="space-y-3 rounded-xl border border-white/10 p-4"><h4 className="font-bold">{editing === 'new' ? 'Novo aplicativo' : `Editar ${editing.title}`}</h4><label className="block text-xs font-semibold">Nome<input aria-label="Nome do aplicativo" value={title} onChange={event => setTitle(event.target.value)} className="mt-1 w-full rounded border p-2 text-black" required /></label><label className="block text-xs font-semibold">URL incorporada<input aria-label="URL do aplicativo" value={url} onChange={event => setUrl(event.target.value)} className="mt-1 w-full rounded border p-2 text-black" placeholder="https://app.exemplo.com" required /></label><label className="flex gap-2 text-sm"><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} />Ativo para agentes e sidebar</label><div className="flex gap-2"><button disabled={busy} type="submit" className="rounded bg-[#00a884] px-3 py-2 text-xs font-bold text-white">Salvar</button><button type="button" onClick={() => setEditing(null)} className="rounded border px-3 py-2 text-xs">Cancelar</button></div></form>}
    <div className="space-y-2">{orderedApps.length === 0 && <p className="rounded-xl border border-dashed p-5 text-center text-sm text-[#8696a0]">Nenhum aplicativo cadastrado para esta conta.</p>}{orderedApps.map((app, index) => { const appUrl = app.content[0]?.url || ''; return <article key={app.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 p-3"><div className="min-w-0"><div className="flex items-center gap-2"><b className="text-sm">{app.title}</b><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${app.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-500/20 text-gray-400'}`}>{app.enabled ? 'Ativo' : 'Inativo'}</span></div><p className="mt-1 truncate text-xs text-[#8696a0]">{appUrl}</p><p className="mt-1 text-[10px] text-[#8696a0]">ID: {app.id} · Tipo: {app.content[0]?.type || 'frame'} · Ordem atual: {index + 1}</p></div><div className="flex gap-2 text-xs"><a href={appUrl} target="_blank" rel="noopener noreferrer" title="Abrir URL"><ExternalLink className="h-4 w-4" /></a><button type="button" onClick={() => edit(app)} title={`Editar ${app.title}`}><Edit3 className="h-4 w-4" /></button><button disabled={busy} type="button" onClick={() => void toggle(app)} title={app.enabled ? 'Desativar' : 'Ativar'}><Power className={`h-4 w-4 ${app.enabled ? 'text-[#00a884]' : ''}`} /></button><button disabled={busy} type="button" onClick={() => void remove(app)} title={`Remover ${app.title}`}><Trash2 className="h-4 w-4 text-red-400" /></button></div></article>; })}</div>
  </section>;
};
