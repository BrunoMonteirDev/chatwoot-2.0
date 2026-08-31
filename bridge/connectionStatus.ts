export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error' | 'pending';

export const connectionStatusPatch = (transport: 'evolution' | 'waha' | 'meta_cloud', status: ConnectionStatus) => ({
  [`${transport}_connection_status`]: status,
  [`${transport}_connection_updated_at`]: new Date().toISOString(),
});

export const evolutionConnectionStatus = (payload: unknown): ConnectionStatus => {
  const root = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const instance = root.instance && typeof root.instance === 'object' ? root.instance as Record<string, unknown> : {};
  const state = String(root.state || root.connectionStatus || instance.state || 'disconnected').toLowerCase();
  return state === 'open' || state === 'connected' ? 'connected' : state === 'connecting' ? 'connecting' : state === 'close' || state === 'closed' || state === 'disconnected' ? 'disconnected' : 'error';
};

export const metaConnectionStatus = (value: unknown, hasCredentials: boolean): ConnectionStatus => {
  if (!hasCredentials) return 'disconnected';
  return value === 'connected' || value === 'connecting' || value === 'disconnected' || value === 'error' || value === 'pending' ? value : 'pending';
};
