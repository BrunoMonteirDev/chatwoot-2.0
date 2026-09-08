import type { WahaSession } from './waha.js';
import type { WahaSessionOwnership } from './wahaSessionStore.js';

// Ownership proves the durable binding, not provider health. When WAHA cannot
// answer, expose only persisted non-secret identity and an explicit error.
export const unavailableOwnedWahaSession = (ownership: WahaSessionOwnership): WahaSession => ({
  name: ownership.sessionName,
  linked: true,
  status: ownership.status === 'cleanup_pending' ? ownership.status : 'FAILED',
  connectionStatus: 'error',
  ...(ownership.engine ? { engine: ownership.engine } : {}),
  ...(ownership.phone ? { me: { id: ownership.phone } } : {}),
});
