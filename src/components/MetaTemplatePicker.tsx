import { useEffect, useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { metaTemplateService, type WhatsAppTemplate } from '../integrations/whatsapp/templates';

const fields = (text?: string) => [...(text || '').matchAll(/\{\{(\d+)\}\}/g)].map(match => Number(match[1])).filter((value, index, all) => all.indexOf(value) === index).sort((a, b) => a - b);
const component = (template: WhatsAppTemplate, type: string) => template.components.find(item => item.type.toUpperCase() === type);
const keyFor = (scope: string, index: number) => `${scope}:${index}`;
const buttonType = (button: { type?: string }) => (button.type || '').toUpperCase();

export const MetaTemplatePicker = ({ inboxId, conversationId, onClose }: { inboxId: number; conversationId: number; onClose: () => void }) => {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [selected, setSelected] = useState<WhatsAppTemplate | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [headerFile, setHeaderFile] = useState<File | null>(null);
  const [search, setSearch] = useState('');
  const [state, setState] = useState<'loading' | 'ready' | 'sending' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { let active = true; void metaTemplateService.list(inboxId).then(items => { if (active) { setTemplates(items.filter(item => item.status === 'APPROVED')); setState('ready'); } }).catch(cause => { if (active) { setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os templates.'); setState('error'); } }); return () => { active = false; }; }, [inboxId]);

  const listed = useMemo(() => templates.filter(template => `${template.name} ${template.language} ${template.category || ''}`.toLowerCase().includes(search.toLowerCase())), [search, templates]);
  const header = selected && component(selected, 'HEADER');
  const body = selected && component(selected, 'BODY');
  const footer = selected && component(selected, 'FOOTER');
  const headerVars = fields(header?.text);
  const bodyVars = fields(body?.text);
  const headerKind = header?.format?.toUpperCase() === 'IMAGE' ? 'image' : header?.format?.toUpperCase() === 'VIDEO' ? 'video' : header?.format?.toUpperCase() === 'DOCUMENT' ? 'document' : null;
  const buttons = selected?.components.flatMap(item => item.type.toUpperCase() === 'BUTTONS' ? item.buttons || [] : []) || [];
  const value = (key: string) => values[key] || '';
  const previewText = (text: string | undefined, scope: 'header' | 'body') => (text || '').replace(/\{\{(\d+)\}\}/g, (_match, index: string) => value(keyFor(scope, Number(index))) || `{{${index}}}}`);
  const dynamicButtons = buttons.flatMap((button, index) => {
    const type = buttonType(button);
    return (type === 'URL' && /\{\{\d+\}\}/.test(button.url || '')) || type === 'COPY_CODE' || type === 'OTP' ? [index] : [];
  });
  const valid = Boolean(selected) && headerVars.every(index => value(keyFor('header', index)).trim()) && bodyVars.every(index => value(keyFor('body', index)).trim()) && dynamicButtons.every(index => value(keyFor('button', index)).trim()) && (!headerKind || headerFile) && state !== 'sending';
  const update = (key: string, text: string) => setValues(current => ({ ...current, [key]: text }));
  const buildComponents = () => {
    const result: Array<Record<string, unknown>> = [];
    if (headerKind) result.push({ type: 'header', parameters: [{ type: headerKind }] });
    else if (headerVars.length) result.push({ type: 'header', parameters: headerVars.map(index => ({ type: 'text', text: value(keyFor('header', index)) })) });
    if (bodyVars.length) result.push({ type: 'body', parameters: bodyVars.map(index => ({ type: 'text', text: value(keyFor('body', index)) })) });
    buttons.forEach((button, index) => {
      const type = buttonType(button);
      if (type === 'URL' && /\{\{\d+\}\}/.test(button.url || '')) result.push({ type: 'button', sub_type: 'url', index: String(index), parameters: [{ type: 'text', text: value(keyFor('button', index)) }] });
      if ((type === 'COPY_CODE' || type === 'OTP') && value(keyFor('button', index))) result.push({ type: 'button', sub_type: 'copy_code', index: String(index), parameters: [{ type: 'coupon_code', coupon_code: value(keyFor('button', index)) }] });
    });
    return result;
  };
  const send = async () => {
    if (!selected || !valid) return;
    setState('sending'); setError(null);
    try { await metaTemplateService.send(inboxId, conversationId, { name: selected.name, language: selected.language, components: buildComponents() }, headerFile); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível enviar o template.'); setState('ready'); }
  };
  const input = (label: string, key: string) => <label key={key} className="block text-xs text-[#aebac1]">{label}<input value={value(key)} onChange={event => update(key, event.target.value)} className="mt-1 w-full rounded-md border border-[#374248] bg-[#111b21] px-2.5 py-2 text-sm text-[#e9edef] outline-none focus:border-[#00a884]" /></label>;

  return <div className="absolute bottom-full right-0 z-50 mb-2 w-[min(30rem,calc(100vw-2rem))] rounded-xl border border-[#374248] bg-[#202c33] p-3 text-[#e9edef] shadow-2xl">
    <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-bold">Escolher template Meta</h3><button type="button" onClick={onClose} className="rounded p-1 text-[#aebac1] hover:bg-white/10"><X className="h-4 w-4" /></button></div>
    {state === 'loading' && <div className="flex items-center gap-2 p-4 text-sm text-[#aebac1]"><Loader2 className="h-4 w-4 animate-spin" />Carregando templates…</div>}
    {state !== 'loading' && <><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por nome ou idioma" className="mb-2 w-full rounded-md border border-[#374248] bg-[#111b21] px-2.5 py-2 text-sm outline-none focus:border-[#00a884]" />
      {!selected ? <div className="max-h-64 space-y-1 overflow-y-auto">{listed.map(template => <button type="button" key={`${template.name}:${template.language}`} onClick={() => { setSelected(template); setValues({}); setHeaderFile(null); }} className="w-full rounded-lg px-3 py-2 text-left hover:bg-white/10"><span className="block text-sm font-semibold">{template.name}</span><span className="text-xs text-[#aebac1]">{template.language} · {template.category || 'Meta'}</span></button>)}{!listed.length && <p className="p-3 text-sm text-[#aebac1]">Nenhum template aprovado encontrado.</p>}</div>
        : <div className="max-h-[65vh] space-y-2 overflow-y-auto"><button type="button" onClick={() => setSelected(null)} className="text-xs font-semibold text-[#00a884]">← Voltar</button><p className="text-sm font-bold">{selected.name} <span className="font-normal text-[#aebac1]">({selected.language})</span></p>
          <div className="rounded bg-black/20 p-2 text-xs text-[#d1d7db] whitespace-pre-wrap"><p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[#8696a0]">Prévia</p>{header?.text && <p className="mb-1 font-semibold">{previewText(header.text, 'header')}</p>}{body?.text && <p>{previewText(body.text, 'body')}</p>}{footer?.text && <p className="mt-2 text-[#aebac1]">{footer.text}</p>}{buttons.map((button, index) => <p key={`${button.type}:${index}`} className="mt-1">[{buttonType(button) || 'UNSUPPORTED'}] {button.text || button.url || 'Sem rótulo'}</p>)}</div>
          {headerKind && <label className="block text-xs text-[#aebac1]">Cabeçalho {headerKind}<input type="file" accept={headerKind === 'image' ? 'image/*' : headerKind === 'video' ? 'video/*' : '.pdf,.doc,.docx,application/pdf'} onChange={event => setHeaderFile(event.target.files?.[0] || null)} className="mt-1 block w-full text-sm" /></label>}
          {headerVars.map(index => input(`Cabeçalho {{${index}}}`, keyFor('header', index)))}{bodyVars.map(index => input(`Corpo {{${index}}}`, keyFor('body', index)))}
          {dynamicButtons.map(index => input(buttonType(buttons[index]) === 'URL' ? `Parâmetro da URL: ${buttons[index].url}` : `Código do botão ${buttons[index].text || buttonType(buttons[index])}`, keyFor('button', index)))}
          <button type="button" disabled={!valid} onClick={() => void send()} className="flex w-full items-center justify-center gap-2 rounded-md bg-[#00a884] px-3 py-2 text-sm font-bold text-[#0b141a] disabled:opacity-50">{state === 'sending' && <Loader2 className="h-4 w-4 animate-spin" />}Enviar template</button></div>}
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}</>}
  </div>;
};
