import type { CustomAttributeDefinition, CustomAttributeModel, CustomAttributeType } from '../../domain/currentUser';
import { chatwootApiClient } from '../../integrations/chatwoot/client';

interface DefinitionDto { id: number; attribute_display_name: string; attribute_key: string; attribute_description?: string | null; attribute_display_type: CustomAttributeType; attribute_model: CustomAttributeModel; attribute_values?: string[] | null; }
export interface DefinitionInput { name: string; key: string; description?: string; type: CustomAttributeType; model: CustomAttributeModel; values?: string[]; }
type Listener = (items: CustomAttributeDefinition[]) => void;

export const customAttributeKeyFromName = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
const normalize = (dto: DefinitionDto): CustomAttributeDefinition => ({ id: dto.id, name: dto.attribute_display_name, key: dto.attribute_key, description: dto.attribute_description || null, type: dto.attribute_display_type, model: dto.attribute_model, values: dto.attribute_values || [] });
const validate = (input: DefinitionInput) => {
  const name = input.name.trim(); const key = input.key.trim();
  if (!name) throw new Error('O nome é obrigatório.');
  if (!/^[a-z0-9_]+$/.test(key)) throw new Error('A chave deve conter apenas letras minúsculas, números e underscore.');
  const values = input.type === 'list' ? [...new Set((input.values || []).map(v => v.trim()).filter(Boolean))] : [];
  if (input.type === 'list' && !values.length) throw new Error('Adicione pelo menos uma opção à lista.');
  return { attribute_display_name: name, attribute_key: key, attribute_description: input.description?.trim() || '', attribute_display_type: input.type, attribute_model: input.model, attribute_values: values };
};

export class CustomAttributeCatalog {
  private cache = new Map<number, CustomAttributeDefinition[]>(); private pending = new Map<number, Promise<CustomAttributeDefinition[]>>(); private listeners = new Map<number, Set<Listener>>();
  peek(accountId: number) { return this.cache.get(accountId) || null; }
  async list(accountId: number) { const hit = this.cache.get(accountId); if (hit) return hit; let request = this.pending.get(accountId); if (!request) { request = chatwootApiClient.get<DefinitionDto[]>(`/api/v1/accounts/${accountId}/custom_attribute_definitions`).then(items => this.store(accountId, items.map(normalize))).finally(() => this.pending.delete(accountId)); this.pending.set(accountId, request); } return request; }
  async create(accountId: number, input: DefinitionInput) { if ((this.cache.get(accountId) || []).some(item => item.model === input.model && item.key === input.key.trim())) throw new Error('Já existe um atributo com esta chave.'); const item = normalize(await chatwootApiClient.post<DefinitionDto>(`/api/v1/accounts/${accountId}/custom_attribute_definitions`, { custom_attribute_definition: validate(input) })); this.store(accountId, [...(this.cache.get(accountId) || []), item]); return item; }
  async update(accountId: number, id: number, input: DefinitionInput) { const existing = (this.cache.get(accountId) || []).find(item => item.id === id); if (!existing) throw new Error('Atributo não encontrado.'); const payload = validate({ ...input, key: existing.key, model: existing.model }); delete (payload as Partial<typeof payload>).attribute_key; delete (payload as Partial<typeof payload>).attribute_model; const item = normalize(await chatwootApiClient.patch<DefinitionDto>(`/api/v1/accounts/${accountId}/custom_attribute_definitions/${id}`, { custom_attribute_definition: payload })); this.store(accountId, (this.cache.get(accountId) || []).map(value => value.id === id ? item : value)); return item; }
  async delete(accountId: number, id: number) { await chatwootApiClient.delete(`/api/v1/accounts/${accountId}/custom_attribute_definitions/${id}`); this.store(accountId, (this.cache.get(accountId) || []).filter(item => item.id !== id)); }
  subscribe(accountId: number, listener: Listener) { const set = this.listeners.get(accountId) || new Set(); set.add(listener); this.listeners.set(accountId, set); return () => { set.delete(listener); }; }
  clear() { this.cache.clear(); this.pending.clear(); this.listeners.clear(); }
  private store(accountId: number, items: CustomAttributeDefinition[]) { const sorted = [...items].sort((a,b) => a.name.localeCompare(b.name)); this.cache.set(accountId, sorted); this.listeners.get(accountId)?.forEach(fn => fn(sorted)); return sorted; }
}
export const customAttributeCatalog = new CustomAttributeCatalog();
