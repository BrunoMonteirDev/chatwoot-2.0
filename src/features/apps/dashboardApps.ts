import { chatwootApiClient } from '../../integrations/chatwoot/client';

export type DashboardApp = { id: number; title: string; content: Array<{ type: 'frame'; url: string }>; enabled: boolean; created_at?: string };
export type DashboardAppInput = { title: string; url: string; enabled?: boolean };
const path = (accountId: number) => `/api/v1/accounts/${accountId}/dashboard_apps`;
const listeners = new Set<(accountId: number) => void>();
const notify = (accountId: number) => listeners.forEach(listener => listener(accountId));

export const dashboardApps = {
  list: (accountId: number, signal?: AbortSignal) => chatwootApiClient.get<DashboardApp[]>(path(accountId), { signal }),
  async create(accountId: number, input: DashboardAppInput) { const app = await chatwootApiClient.post<DashboardApp>(path(accountId), { dashboard_app: { title: input.title, enabled: input.enabled, content: [{ type: 'frame', url: input.url }] } }); notify(accountId); return app; },
  async update(accountId: number, id: number, input: DashboardAppInput) { const app = await chatwootApiClient.patch<DashboardApp>(`${path(accountId)}/${id}`, { dashboard_app: { title: input.title, enabled: input.enabled, content: [{ type: 'frame', url: input.url }] } }); notify(accountId); return app; },
  async remove(accountId: number, id: number) { await chatwootApiClient.delete<void>(`${path(accountId)}/${id}`); notify(accountId); },
  subscribe(listener: (accountId: number) => void) { listeners.add(listener); return () => listeners.delete(listener); },
};
