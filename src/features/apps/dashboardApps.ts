import { chatwootApiClient } from '../../integrations/chatwoot/client';

export type DashboardApp = { id: number; title: string; content: Array<{ type: 'frame'; url: string }>; enabled: boolean; created_at?: string };
export type DashboardAppInput = { title: string; url: string; enabled?: boolean };
const path = (accountId: number) => `/api/v1/accounts/${accountId}/dashboard_apps`;

export const dashboardApps = {
  list: (accountId: number) => chatwootApiClient.get<DashboardApp[]>(path(accountId)),
  create: (accountId: number, input: DashboardAppInput) => chatwootApiClient.post<DashboardApp>(path(accountId), { dashboard_app: { title: input.title, enabled: input.enabled, content: [{ type: 'frame', url: input.url }] } }),
  update: (accountId: number, id: number, input: DashboardAppInput) => chatwootApiClient.patch<DashboardApp>(`${path(accountId)}/${id}`, { dashboard_app: { title: input.title, enabled: input.enabled, content: [{ type: 'frame', url: input.url }] } }),
  remove: (accountId: number, id: number) => chatwootApiClient.delete<void>(`${path(accountId)}/${id}`),
};
