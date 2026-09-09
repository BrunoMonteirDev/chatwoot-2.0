import type { AccountLabel } from '../../domain/currentUser';
import { chatwootApiClient } from '../../integrations/chatwoot/client';
import { normalizeLabel } from '../../integrations/chatwoot/normalizers';
import type { ChatwootLabelDto, ChatwootLabelsResponse } from '../../integrations/chatwoot/types';

export interface LabelInput { title: string; color: string; description?: string; showOnSidebar?: boolean; }
type Listener = (labels: AccountLabel[]) => void;

const validInput = (input: LabelInput) => {
  const title = input.title.trim();
  if (!title) throw new Error('O nome da etiqueta é obrigatório.');
  if (!/^#[0-9a-f]{6}$/i.test(input.color)) throw new Error('A cor da etiqueta é inválida.');
  return { title, color: input.color, description: input.description?.trim() || '', show_on_sidebar: Boolean(input.showOnSidebar) };
};

export class LabelCatalog {
  private cache = new Map<number, AccountLabel[]>();
  private inFlight = new Map<number, Promise<AccountLabel[]>>();
  private listeners = new Map<number, Set<Listener>>();

  peek(accountId: number) { return this.cache.get(accountId) || null; }

  async list(accountId: number) {
    const cached = this.cache.get(accountId);
    if (cached) return cached;
    let pending = this.inFlight.get(accountId);
    if (!pending) {
      pending = chatwootApiClient.get<ChatwootLabelsResponse>(`/api/v1/accounts/${accountId}/labels`)
        .then(response => this.store(accountId, response.payload.map(normalizeLabel)))
        .finally(() => this.inFlight.delete(accountId));
      this.inFlight.set(accountId, pending);
    }
    return pending;
  }

  async create(accountId: number, input: LabelInput) {
    const dto = await chatwootApiClient.post<ChatwootLabelDto>(`/api/v1/accounts/${accountId}/labels`, { label: validInput(input) });
    const label = normalizeLabel(dto);
    this.store(accountId, [...(this.cache.get(accountId) || []), label]);
    return label;
  }

  async update(accountId: number, labelId: number, input: LabelInput) {
    const dto = await chatwootApiClient.patch<ChatwootLabelDto>(`/api/v1/accounts/${accountId}/labels/${labelId}`, { label: validInput(input) });
    const label = normalizeLabel(dto);
    this.store(accountId, (this.cache.get(accountId) || []).map(item => item.id === labelId ? label : item));
    return label;
  }

  async delete(accountId: number, labelId: number) {
    await chatwootApiClient.delete<void>(`/api/v1/accounts/${accountId}/labels/${labelId}`);
    this.store(accountId, (this.cache.get(accountId) || []).filter(item => item.id !== labelId));
  }

  subscribe(accountId: number, listener: Listener) {
    const listeners = this.listeners.get(accountId) || new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(accountId, listeners);
    return () => { listeners.delete(listener); if (!listeners.size) this.listeners.delete(accountId); };
  }

  clear() { this.cache.clear(); this.inFlight.clear(); this.listeners.clear(); }

  private store(accountId: number, labels: AccountLabel[]) {
    const sorted = [...labels].sort((a, b) => a.title.localeCompare(b.title));
    this.cache.set(accountId, sorted);
    this.listeners.get(accountId)?.forEach(listener => listener(sorted));
    return sorted;
  }
}

export const labelCatalog = new LabelCatalog();
