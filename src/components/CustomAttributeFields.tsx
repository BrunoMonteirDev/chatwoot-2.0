import type { CustomAttributeDefinition } from '../domain/currentUser';

const safeUrl = (value: unknown) => {
  if (typeof value !== 'string') return null;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; }
};

export const coerceCustomAttributeValue = (definition: CustomAttributeDefinition, raw: unknown): unknown => {
  if (definition.type === 'checkbox') return Boolean(raw);
  if (raw === '' || raw === null || raw === undefined) return '';
  if (definition.type === 'number') { const value = Number(raw); if (!Number.isFinite(value)) throw new Error(`${definition.name} deve ser numérico.`); return value; }
  if (definition.type === 'link' && !safeUrl(raw)) throw new Error(`${definition.name} deve conter uma URL http(s) válida.`);
  if (definition.type === 'list' && !definition.values.includes(String(raw))) throw new Error(`${definition.name} contém uma opção inválida.`);
  if (definition.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(String(raw))) throw new Error(`${definition.name} deve conter uma data válida.`);
  return String(raw);
};

export const CustomAttributeFields = ({ definitions, values, onChange, inputClass, readOnly = false }: { definitions: CustomAttributeDefinition[]; values: Record<string, unknown>; onChange?: (next: Record<string, unknown>) => void; inputClass: string; readOnly?: boolean }) => <div className="space-y-3">
  {definitions.map(definition => {
    const value = values[definition.key] ?? '';
    const set = (next: unknown) => onChange?.({ ...values, [definition.key]: next });
    if (readOnly) {
      const href = definition.type === 'link' ? safeUrl(value) : null;
      const shown = definition.type === 'checkbox' ? (value ? 'Sim' : 'Não') : definition.type === 'date' && value ? new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR') : String(value || '—');
      return <div key={definition.id}><span className="block text-[11px] text-[#8696a0]">{definition.name}</span>{href ? <a href={href} target="_blank" rel="noopener noreferrer" className="text-xs text-[#53bdeb] underline">{shown}</a> : <span className="text-xs">{shown}</span>}</div>;
    }
    return <label key={definition.id} className="block text-[11px] text-[#8696a0]">{definition.name}{definition.description && <small className="ml-1">— {definition.description}</small>}
      {definition.type === 'list' ? <select value={String(value)} onChange={event => set(event.target.value)} className={`${inputClass} mt-1`}><option value="">—</option>{value && !definition.values.includes(String(value)) && <option value={String(value)}>{String(value)} (valor legado)</option>}{definition.values.map(option => <option key={option}>{option}</option>)}</select>
        : definition.type === 'checkbox' ? <span className="mt-1 flex items-center gap-2"><input type="checkbox" checked={Boolean(value)} onChange={event => set(event.target.checked)} />{value ? 'Sim' : 'Não'}</span>
          : <><input type={definition.type === 'number' ? 'number' : definition.type === 'date' ? 'date' : definition.type === 'link' ? 'url' : 'text'} value={String(value)} onChange={event => set(event.target.value)} className={`${inputClass} mt-1`} />{definition.type === 'link' && safeUrl(value) && <a href={safeUrl(value)!} target="_blank" rel="noopener noreferrer" className="mt-1 block text-[11px] text-[#53bdeb] underline">Abrir link</a>}</>}
    </label>;
  })}
  {!definitions.length && <p className="text-xs text-[#8696a0]">Nenhum atributo definido para este escopo.</p>}
</div>;
