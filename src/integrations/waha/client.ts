import { authenticatedBridgeHeaders } from '../bridge/auth';
import { BridgeApiError } from '../chatwoot/errors';

export type WahaConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';
export interface WahaSession { name: string; status: string; connectionStatus: WahaConnectionStatus; engine?: string; me?: { id?: string; pushName?: string }; }
export interface WahaQrCode { mimetype: string; data: string; }
export type WahaHistoryRange = '7d' | '30d' | '90d' | 'all';
export type WahaHistoryJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export interface WahaHistoryJob {
  id: string; requestedRange: WahaHistoryRange; status: WahaHistoryJobStatus; startedAt?: string; finishedAt?: string;
  processed: number; imported: number; duplicates: number; skipped: number; failed: number; mediaImported: number; mediaFailed: number; conversations: number; lastError?: string;
}
type Context = { accountId: number; inboxId: number };
const query = ({ accountId, inboxId }: Context) => `?${new URLSearchParams({ accountId: String(accountId), inboxId: String(inboxId) })}`;

// The browser talks only to the authenticated bridge. WAHA's API key and its
// private address intentionally never appear in Vite configuration.
const bridgeUrl = (import.meta.env.VITE_BRIDGE_PUBLIC_URL || '').replace(/\/$/, '');
const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  if (!bridgeUrl) throw new BridgeApiError(503, null, 'O endereço seguro do bridge não está configurado.');
  try {
    const response = await fetch(`${bridgeUrl}${path}`, { ...init, headers: { ...authenticatedBridgeHeaders(), ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers } });
    const text = await response.text();
    const body: unknown = text ? (() => { try { return JSON.parse(text); } catch { return null; } })() : undefined;
    if (!response.ok) throw new BridgeApiError(response.status, body, body && typeof body === 'object' && 'error' in body && typeof body.error === 'string' ? body.error : 'WAHA recusou a requisição.');
    return body as T;
  } catch (error) {
    if (error instanceof BridgeApiError) throw error;
    throw new BridgeApiError(503, null, 'Não foi possível conectar ao bridge do WhatsApp.');
  }
};

export const wahaClient = {
  health: () => request<{ ok: true; result: unknown }>('/providers/waha/health'),
  listSessions: (context: Context) => request<{ sessions: WahaSession[] }>(`/providers/waha/sessions${query(context)}`),
  getSession: (context: Context, name: string) => request<{ session: WahaSession }>(`/providers/waha/sessions/${encodeURIComponent(name)}${query(context)}`),
  createSession: (context: Context, sessionName: string, options: { engine?: string; start?: boolean } = {}) => request<{ session: WahaSession }>('/providers/waha/sessions', { method: 'POST', body: JSON.stringify({ ...context, sessionName, ...options }) }),
  startSession: (context: Context, name: string) => request<{ session: WahaSession }>(`/providers/waha/sessions/${encodeURIComponent(name)}/start`, { method: 'POST', body: JSON.stringify(context) }),
  restartSession: (context: Context, name: string) => request<{ session: WahaSession }>(`/providers/waha/sessions/${encodeURIComponent(name)}/restart`, { method: 'POST', body: JSON.stringify(context) }),
  logoutSession: (context: Context, name: string) => request<void>(`/providers/waha/sessions/${encodeURIComponent(name)}/logout`, { method: 'POST', body: JSON.stringify(context) }),
  getQrCode: (context: Context, name: string) => request<WahaQrCode>(`/providers/waha/sessions/${encodeURIComponent(name)}/qr${query(context)}`),
  associateSession: (context: Context, name: string) => request<{ ok: true }>(`/providers/waha/sessions/${encodeURIComponent(name)}/associate`, { method: 'POST', body: JSON.stringify(context) }),
  startHistoryImport: (context: Context, range: WahaHistoryRange) => request<{ job: WahaHistoryJob }>(`/providers/waha/inboxes/${context.inboxId}/history/import`, { method: 'POST', body: JSON.stringify({ ...context, range }) }),
  getCurrentHistoryImport: (context: Context) => request<{ job: WahaHistoryJob; running: boolean }>(`/providers/waha/inboxes/${context.inboxId}/history/import${query(context)}`),
  getHistoryImport: (context: Context, jobId: string) => request<{ job: WahaHistoryJob; running: boolean }>(`/providers/waha/inboxes/${context.inboxId}/history/import/${encodeURIComponent(jobId)}${query(context)}`),
  cancelHistoryImport: (context: Context, jobId: string) => request<{ job: WahaHistoryJob }>(`/providers/waha/inboxes/${context.inboxId}/history/import/${encodeURIComponent(jobId)}/cancel`, { method: 'POST', body: JSON.stringify(context) }),
};
