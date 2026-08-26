import { Pencil, Plus, StickyNote, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';

type Note = { id: string; shortcut: string; text: string; attachmentName?: string; updatedAt: string };

export const QuickNotesView = ({ isDarkMode }: { isDarkMode: boolean }) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [text, setText] = useState('');
  const [shortcut, setShortcut] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [keepAttachment, setKeepAttachment] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => { setNotes(JSON.parse(localStorage.getItem('quick-notes') || '[]') as Note[]); }, []);

  const persist = (next: Note[]) => {
    setNotes(next);
    localStorage.setItem('quick-notes', JSON.stringify(next));
    window.dispatchEvent(new Event('quick-notes-updated'));
  };
  const resetForm = () => {
    setText(''); setShortcut(''); setAttachment(null); setKeepAttachment(false); setEditingId(null);
  };
  const save = () => {
    if (!shortcut.trim() || (!text.trim() && !attachment && !keepAttachment)) return;
    const note = {
      shortcut: shortcut.trim(),
      text: text.trim(),
      ...(attachment ? { attachmentName: attachment.name } : keepAttachment ? { attachmentName: notes.find((item) => item.id === editingId)?.attachmentName } : {}),
      updatedAt: new Date().toISOString(),
    };
    if (editingId) persist(notes.map((item) => item.id === editingId ? { ...item, ...note } : item));
    else persist([{ id: crypto.randomUUID(), ...note }, ...notes]);
    resetForm();
  };
  const edit = (note: Note) => {
    setEditingId(note.id); setShortcut(note.shortcut || ''); setText(note.text || '');
    setAttachment(null); setKeepAttachment(Boolean(note.attachmentName));
  };
  const existingAttachment = editingId ? notes.find((item) => item.id === editingId)?.attachmentName : undefined;
  const canSave = shortcut.trim() && (text.trim() || attachment || keepAttachment);
  const fieldClass = `w-full rounded-xl border p-3 text-sm outline-none ${isDarkMode ? 'border-[#374248] bg-[#202c33]' : 'border-[#d1d7db] bg-white'}`;

  return <section className={`flex-1 overflow-y-auto p-4 pb-28 md:hidden ${isDarkMode ? 'bg-[#111b21] text-[#e9edef]' : 'bg-[#f8f9fa] text-[#111b21]'}`}>
    <h1 className="mb-1 text-lg font-bold">Notas rápidas</h1>
    <p className="mb-4 text-xs text-[#8696a0]">Anotações pessoais salvas neste dispositivo.</p>
    <div className={`rounded-2xl border p-3 ${isDarkMode ? 'border-[#374248] bg-[#18252b]' : 'border-[#d1d7db] bg-white'}`}>
      <div className="mb-1 flex items-center justify-between"><label className="text-xs font-semibold text-[#8696a0]">Atalho</label>{editingId && <button type="button" onClick={resetForm} className="flex items-center gap-1 text-xs text-[#8696a0]"><X className="h-3.5 w-3.5" />Cancelar</button>}</div>
      <input value={shortcut} onChange={(event) => setShortcut(event.target.value)} placeholder="Ex.: entrega, horário ou pagamento" className={`${fieldClass} mb-2`} />
      <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Mensagem (opcional se houver anexo)…" className={`${fieldClass} min-h-28`} />
      <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-xl border border-[#374248] px-3 py-2.5 text-sm"><Plus className="h-4 w-4 text-[#00a884]" />{attachment ? attachment.name : existingAttachment && keepAttachment ? `Anexo: ${existingAttachment}` : 'Adicionar anexo (opcional)'}<input type="file" className="hidden" onChange={(event) => { setAttachment(event.target.files?.[0] || null); if (event.target.files?.[0]) setKeepAttachment(false); }} /></label>
      {editingId && existingAttachment && <button type="button" onClick={() => { setAttachment(null); setKeepAttachment(false); }} className="mt-2 text-xs text-[#8696a0]">Remover anexo atual</button>}
      <button type="button" onClick={save} disabled={!canSave} className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#00a884] py-2.5 text-sm font-bold text-white disabled:opacity-40"><Plus className="h-4 w-4" />{editingId ? 'Salvar alterações' : 'Adicionar nota'}</button>
    </div>
    <div className="mt-5 space-y-2">{notes.length ? notes.map((note) => <article key={note.id} className={`rounded-xl border p-3 ${isDarkMode ? 'border-[#374248] bg-[#202c33]' : 'border-[#d1d7db] bg-white'}`}><div className="flex gap-2"><StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-[#00a884]" /><div className="min-w-0 flex-1"><p className="text-xs font-bold text-[#00a884]">/{note.shortcut || 'nota'}</p>{note.text && <p className="mt-1 whitespace-pre-wrap text-sm">{note.text}</p>}{note.attachmentName && <p className="mt-1 truncate text-xs text-[#8696a0]">Anexo: {note.attachmentName}</p>}</div><button type="button" onClick={() => edit(note)} className="shrink-0 text-[#8696a0]" aria-label="Editar nota"><Pencil className="h-4 w-4" /></button><button type="button" onClick={() => { persist(notes.filter((item) => item.id !== note.id)); if (editingId === note.id) resetForm(); }} className="shrink-0 text-[#8696a0]" aria-label="Excluir nota"><Trash2 className="h-4 w-4" /></button></div></article>) : <p className="py-10 text-center text-sm text-[#8696a0]">Nenhuma nota rápida.</p>}</div>
  </section>;
};
