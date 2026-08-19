import { authenticatedBridgeHeaders } from '../bridge/auth';

const bridgeUrl = (import.meta.env.VITE_BRIDGE_PUBLIC_URL || '').replace(/\/$/, '');

export interface WhatsAppTemplate {
  id: string | null;
  name: string;
  language: string;
  category: string | null;
  status: string | null;
  quality: string | null;
  components: Array<{ type: string; text?: string; format?: string; buttons?: Array<{ type?: string; text?: string; url?: string }> }>;
  updatedAt: string | null;
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  if (!bridgeUrl) throw new Error('O bridge WhatsApp não está configurado neste ambiente.');
  const response = await fetch(`${bridgeUrl}${path}`, { ...init, headers: { ...authenticatedBridgeHeaders(), ...(init?.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...(init?.headers || {}) } });
  const body: unknown = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string' ? (body as { error: string }).error : 'Não foi possível concluir a operação com a Meta.');
  return body as T;
};

export const metaTemplateService = {
  async list(inboxId: number) {
    return (await request<{ templates: WhatsAppTemplate[] }>(`/providers/meta/inboxes/${inboxId}/templates`)).templates;
  },
  send(inboxId: number, conversationId: number, template: { name: string; language: string; components?: Array<Record<string, unknown>> }, header?: File | null) {
    if (!header) return request<{ sourceId: string }>('/operations/templates', { method: 'POST', body: JSON.stringify({ inboxId, conversationId, template }) });
    const form = new FormData();
    form.append('inboxId', String(inboxId));
    form.append('conversationId', String(conversationId));
    form.append('template', JSON.stringify(template));
    form.append('header', header);
    return request<{ sourceId: string }>('/operations/templates', { method: 'POST', body: form });
  },
};
