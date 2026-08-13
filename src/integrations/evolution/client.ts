const baseUrl = (import.meta.env.VITE_EVOLUTION_BASE_URL || '').replace(/\/$/, '');
const apiKey = import.meta.env.VITE_EVOLUTION_API_KEY || '';
const bridgeUrl = (import.meta.env.VITE_BRIDGE_PUBLIC_URL || '').replace(/\/$/, '');
const bridgeSecret = import.meta.env.VITE_BRIDGE_WEBHOOK_SECRET || '';

export class EvolutionApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'EvolutionApiError';
  }
}

const requireConfiguration = () => {
  if (!baseUrl || !apiKey) throw new EvolutionApiError('Configure VITE_EVOLUTION_BASE_URL e VITE_EVOLUTION_API_KEY para usar a Evolution API.');
};

const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  requireConfiguration();
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { apikey: apiKey, Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
  });
  const text = await response.text();
  const body: unknown = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : undefined;
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'message' in body && typeof body.message === 'string' ? body.message : response.statusText;
    throw new EvolutionApiError(message || 'A Evolution API recusou a requisição.', response.status);
  }
  return body as T;
};

export type EvolutionConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

export interface EvolutionInstance {
  instanceName: string;
  instanceId: string | null;
}

export interface EvolutionConnection {
  status: EvolutionConnectionStatus;
  number: string | null;
  raw: unknown;
}

const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
const stringValue = (...values: unknown[]) => values.find((value): value is string => typeof value === 'string' && value.length > 0) ?? null;

const normalizeConnection = (payload: unknown): EvolutionConnection => {
  const root = record(payload);
  const instance = record(root.instance);
  const state = String(stringValue(root.state, root.connectionStatus, instance.state) || 'disconnected').toLowerCase();
  const status: EvolutionConnectionStatus = state === 'open' || state === 'connected' ? 'connected' : state === 'connecting' ? 'connecting' : state === 'close' || state === 'closed' || state === 'disconnected' ? 'disconnected' : 'error';
  const owner = stringValue(root.ownerJid, instance.ownerJid);
  return { status, number: owner?.replace(/@.+$/, '') ?? null, raw: payload };
};

export const evolutionService = {
  createInstance: async (instanceName: string): Promise<EvolutionInstance> => {
    const payload = await request<unknown>('/instance/create', { method: 'POST', body: JSON.stringify({ instanceName, integration: 'WHATSAPP-BAILEYS', qrcode: true }) });
    const root = record(payload);
    const instance = record(root.instance);
    return { instanceName: stringValue(instance.instanceName, root.instanceName) || instanceName, instanceId: stringValue(instance.instanceId, root.instanceId) };
  },
  getQrCode: (instanceName: string) => request<unknown>(`/instance/connect/${encodeURIComponent(instanceName)}`),
  getConnection: async (instanceName: string): Promise<EvolutionConnection> => normalizeConnection(await request<unknown>(`/instance/connectionState/${encodeURIComponent(instanceName)}`)),
  disconnect: (instanceName: string) => request<unknown>(`/instance/logout/${encodeURIComponent(instanceName)}`, { method: 'DELETE' }),
  configureWebhook: async (instanceName: string) => {
    if (!bridgeUrl || !bridgeSecret) throw new EvolutionApiError('Configure VITE_BRIDGE_PUBLIC_URL e VITE_BRIDGE_WEBHOOK_SECRET para receber mensagens do WhatsApp.');
    return request<unknown>(`/webhook/set/${encodeURIComponent(instanceName)}`, {
      method: 'POST',
      body: JSON.stringify({ webhook: { enabled: true, url: `${bridgeUrl}/webhooks/evolution`, byEvents: false, base64: true, events: ['MESSAGES_UPSERT'], headers: { 'x-bridge-secret': bridgeSecret } } }),
    });
  },
};

export const evolutionQrCode = (payload: unknown): string | null => {
  const root = record(payload);
  const instance = record(root.instance);
  const qrcode = record(root.qrcode);
  const instanceQrCode = record(instance.qrcode);
  return stringValue(root.base64, qrcode.base64, root.qrcode, root.code, instance.base64, instanceQrCode.base64, instance.qrcode);
};
