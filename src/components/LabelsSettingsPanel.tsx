import { Edit3, Loader2, Plus, Search, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { AccountLabel } from '../domain/currentUser';
import { useAccountLabels } from '../features/labels/useAccountLabels';
import { ConfirmDialog } from './ConfirmDialog';

interface Props {
  accountId: number | null;
  isDarkMode: boolean;
  canManage: boolean;
  onRenamed?: (previousTitle: string, nextTitle: string) => void;
  onDeleted?: (title: string) => void;
}

const emptyForm = { title: '', color: '#00a884', description: '' };

export const LabelsSettingsPanel = ({ accountId, isDarkMode, canManage, onRenamed, onDeleted }: Props) => {
  const catalog = useAccountLabels(accountId);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<AccountLabel | null | 'new'>(null);
  const [deleting, setDeleting] = useState<AccountLabel | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const filtered = useMemo(() => catalog.labels.filter(label => `${label.title} ${label.description || ''}`.toLowerCase().includes(query.trim().toLowerCase())), [catalog.labels, query]);
  const inputClass = `mt-1 w-full rounded-xl border px-3 py-2.5 text-sm outline-none ${isDarkMode ? 'border-[#2a3942] bg-[#111b21]' : 'border-[#d1d7db] bg-gray-50'}`;

  const openCreate = () => { setForm(emptyForm); setError(null); setEditing('new'); };
  const openEdit = (label: AccountLabel) => { setForm({ title: label.title, color: label.color || '#00a884', description: label.description || '' }); setError(null); setEditing(label); };
  const save = async () => {
    if (!form.title.trim()) { setError('O nome da etiqueta é obrigatório.'); return; }
    if (!/^#[0-9a-f]{6}$/i.test(form.color)) { setError('A cor da etiqueta é inválida.'); return; }
    setBusy(true); setError(null);
    try {
      if (editing === 'new') await catalog.create(form);
      else if (editing) { const updated = await catalog.update(editing.id, form); if (editing.title !== updated.title) onRenamed?.(editing.title, updated.title); }
      setEditing(null);
    } catch { setError(editing === 'new' ? 'Não foi possível criar a etiqueta.' : 'Não foi possível atualizar a etiqueta.'); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try { await catalog.remove(deleting.id); onDeleted?.(deleting.title); setDeleting(null); }
    catch { setError('Não foi possível excluir a etiqueta.'); setDeleting(null); }
    finally { setBusy(false); }
  };

  return <div className={`rounded-2xl border p-6 shadow-xl ${isDarkMode ? 'border-[#222d34] bg-[#111b21]' : 'border-[#d1d7db] bg-white'}`}>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
      <div><h3 className="text-lg font-bold">Etiquetas</h3><p className="text-xs text-[#8696a0]">Organize conversas com as etiquetas reais desta conta.</p></div>
      {canManage && <button type="button" onClick={openCreate} className="flex items-center gap-1.5 rounded-xl bg-[#00a884] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#008069]"><Plus className="h-4 w-4" />Nova etiqueta</button>}
    </div>
    <label className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2"><Search className="h-4 w-4 text-[#8696a0]" /><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Pesquisar etiquetas" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
    {catalog.status === 'loading' && <p className="py-8 text-center text-xs text-[#8696a0]"><Loader2 className="mr-1 inline h-4 w-4 animate-spin" />Carregando etiquetas…</p>}
    {catalog.status === 'error' && <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-xs text-red-400">{catalog.error}<button type="button" onClick={() => void catalog.retry()} className="ml-2 underline">Tentar novamente</button></p>}
    {error && <p className="mt-4 rounded-lg bg-red-500/10 p-3 text-xs text-red-400">{error}</p>}
    <div className="mt-4 space-y-2">{filtered.map(label => <article key={label.id} className="flex items-center gap-3 rounded-xl border border-white/10 p-3">
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: label.color || '#8696a0' }} />
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{label.title}</p>{label.description && <p className="truncate text-xs text-[#8696a0]">{label.description}</p>}</div>
      {canManage && <><button type="button" onClick={() => openEdit(label)} title={`Editar ${label.title}`} className="rounded-lg p-2 text-[#8696a0] hover:text-[#00a884]"><Edit3 className="h-4 w-4" /></button><button type="button" onClick={() => { setError(null); setDeleting(label); }} title={`Excluir ${label.title}`} className="rounded-lg p-2 text-[#8696a0] hover:text-red-400"><Trash2 className="h-4 w-4" /></button></>}
    </article>)}{catalog.status === 'ready' && !filtered.length && <p className="py-8 text-center text-xs text-[#8696a0]">Nenhuma etiqueta encontrada.</p>}</div>
    {editing && <div className="fixed inset-0 z-[101] grid place-items-center bg-black/65 p-4" role="dialog" aria-modal="true" aria-label={editing === 'new' ? 'Nova etiqueta' : 'Editar etiqueta'}><div className={`w-full max-w-md rounded-2xl border p-5 shadow-2xl ${isDarkMode ? 'border-[#2a3942] bg-[#182228]' : 'border-[#d1d7db] bg-white'}`}>
      <div className="flex items-center justify-between"><h3 className="font-bold">{editing === 'new' ? 'Nova etiqueta' : 'Editar etiqueta'}</h3><button type="button" onClick={() => setEditing(null)} aria-label="Fechar"><X className="h-4 w-4" /></button></div>
      <div className="mt-4 space-y-3"><label className="block text-xs font-semibold">Nome<input value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} className={inputClass} /></label><label className="block text-xs font-semibold">Descrição opcional<textarea value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} className={`${inputClass} min-h-20 resize-y`} /></label><label className="block text-xs font-semibold">Cor<input type="color" value={form.color} onChange={event => setForm(current => ({ ...current, color: event.target.value }))} className="mt-1 h-10 w-full cursor-pointer rounded-lg bg-transparent" /></label></div>
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}<div className="mt-5 flex justify-end gap-2"><button type="button" disabled={busy} onClick={() => setEditing(null)} className="px-3 py-2 text-xs font-bold text-[#8696a0]">Cancelar</button><button type="button" disabled={busy || !form.title.trim()} onClick={() => void save()} className="rounded-xl bg-[#00a884] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{busy ? 'Salvando…' : 'Salvar'}</button></div>
    </div></div>}
    {deleting && <ConfirmDialog title="Excluir etiqueta?" description={`A etiqueta “${deleting.title}” será removida das conversas onde estiver aplicada. As conversas não serão excluídas.`} confirmLabel="Excluir etiqueta" busyLabel="Excluindo…" variant="danger" isBusy={busy} onCancel={() => setDeleting(null)} onConfirm={() => void remove()} />}
  </div>;
};
