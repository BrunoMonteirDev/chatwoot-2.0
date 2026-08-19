import { authenticatedBridgeHeaders } from '../bridge/auth';

const bridgeUrl = (import.meta.env.VITE_BRIDGE_PUBLIC_URL || '').replace(/\/$/, '');

export class EvolutionApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'EvolutionApiError';
  }
}

const requireBridge = () => {
  if (!bridgeUrl) throw new EvolutionApiError('Configure VITE_BRIDGE_PUBLIC_URL para administrar a Evolution pelo bridge seguro.');
};

const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  requireBridge();
  const response = await fetch(`${bridgeUrl}${path}`, { ...init, headers: { ...authenticatedBridgeHeaders(), ...init.headers } });
  const text = await response.text();
  const body: unknown = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : undefined;
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string' ? body.error : response.statusText;
    throw new EvolutionApiError(message || 'A Evolution recusou a requisição.', response.status);
  }
  return body as T;
};

export type EvolutionConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';
export interface EvolutionInstance { instanceName: string; instanceId: string | null; }
export interface EvolutionConnection { status: EvolutionConnectionStatus; number: string | null; raw: unknown; }

const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
const stringValue = (...values: unknown[]) => values.find((value): value is string => typeof value === 'string' && value.length > 0) ?? null;

const normalizeConnection = (payload: unknown): EvolutionConnection => {
  const root = record(payload); const instance = record(root.instance);
  const state = String(stringValue(root.state, root.connectionStatus, instance.state) || 'disconnected').toLowerCase();
  const status: EvolutionConnectionStatus = state === 'open' || state === 'connected' ? 'connected' : state === 'connecting' ? 'connecting' : state === 'close' || state === 'closed' || state === 'disconnected' ? 'disconnected' : 'error';
  const owner = stringValue(root.ownerJid, instance.ownerJid);
  return { status, number: owner?.replace(/@.+$/, '') ?? null, raw: payload };
};

export const evolutionService = {
  async createInstance(instanceName: string): Promise<EvolutionInstance> {
    const payload = await request<unknown>('/providers/evolution/instances', { method: 'POST', body: JSON.stringify({ instanceName }) });
    const root = record(payload); const instance = record(root.instance);
    return { instanceName: stringValue(instance.instanceName, root.instanceName) || instanceName, instanceId: stringValue(instance.instanceId, root.instanceId) };
  },
  getQrCode: (instanceName: string) => request<unknown>(`/providers/evolution/instances/${encodeURIComponent(instanceName)}/qr`),
  getConnection: async (instanceName: string): Promise<EvolutionConnection> => normalizeConnection(await request<unknown>(`/providers/evolution/instances/${encodeURIComponent(instanceName)}/connection`)),
  disconnect: (instanceName: string) => request<unknown>(`/providers/evolution/instances/${encodeURIComponent(instanceName)}`, { method: 'DELETE' }),
  configureWebhook: (instanceName: string) => request<unknown>(`/providers/evolution/instances/${encodeURIComponent(instanceName)}/webhook`, { method: 'POST' }),
};

export const evolutionQrCode = (payload: unknown): string | null => {
  const root = record(payload); const instance = record(root.instance); const qrcode = record(root.qrcode); const instanceQrCode = record(instance.qrcode);
  return stringValue(root.base64, qrcode.base64, root.qrcode, root.code, instance.base64, instanceQrCode.base64, instance.qrcode);
};
