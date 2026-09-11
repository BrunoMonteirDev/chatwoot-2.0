import { mkdtemp, rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

let bridgeServer: Server; let railsServer: Server; let base: string; let directory: string;
let waha: typeof import('./waha').wahaTransport; let chatwoot: typeof import('./chatwoot').chatwootBridge;
const requestHeaders = { 'Content-Type': 'application/json', 'access-token': 'token', 'token-type': 'Bearer', client: 'client', expiry: '9999999999', uid: 'admin@example.test' };
const post = (inboxId: number, suffix = '') => fetch(`${base}/providers/waha/inboxes/${inboxId}/connection${suffix}`, { method: 'POST', headers: requestHeaders, body: JSON.stringify({ accountId: 7, inboxId }) });
const providerSessions = new Map<string, { name: string; status: string; connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error'; me?: { id?: string; pushName?: string } }>();
const attributes = new Map<number, Record<string, unknown>>();

beforeAll(async () => {
  directory = await mkdtemp(`${tmpdir()}/waha-inbox-connections-`);
  railsServer = createServer((_request, response) => { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ account_id: 7, role: 'administrator', accounts: [{ id: 7, role: 'administrator' }] })); });
  railsServer.listen(0, '127.0.0.1'); await new Promise<void>(resolve => railsServer.once('listening', resolve));
  const railsBase = `http://127.0.0.1:${(railsServer.address() as { port: number }).port}`;
  for (const [key, value] of Object.entries({ NODE_ENV: 'test', BRIDGE_WEBHOOK_SECRET: 'test', BRIDGE_PUBLIC_URL: 'https://bridge.test', CHATWOOT_BASE_URL: railsBase, BRIDGE_REDIS_URL: '', WAHA_BASE_URL: 'http://waha.test', WAHA_API_KEY: 'key', BRIDGE_DEDUP_FILE: `${directory}/dedup.json`, BRIDGE_IDENTITY_FILE: `${directory}/identities.json`, BRIDGE_GROUP_CREATION_FILE: `${directory}/groups.json`, BRIDGE_WAHA_SESSION_OWNERSHIP_FILE: `${directory}/sessions.json`, BRIDGE_WAHA_HISTORY_FILE: `${directory}/history.json` })) vi.stubEnv(key, value);
  const imported = await import('./index'); waha = (await import('./waha')).wahaTransport; chatwoot = (await import('./chatwoot')).chatwootBridge;
  bridgeServer = imported.app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => bridgeServer.once('listening', resolve));
  base = `http://127.0.0.1:${(bridgeServer.address() as { port: number }).port}`;
});

afterAll(async () => {
  vi.restoreAllMocks(); vi.unstubAllEnvs();
  if (bridgeServer) await new Promise<void>((resolve, reject) => bridgeServer.close(error => error ? reject(error) : resolve()));
  if (railsServer) await new Promise<void>((resolve, reject) => railsServer.close(error => error ? reject(error) : resolve()));
  await rm(directory, { recursive: true, force: true });
});

beforeEach(() => {
  vi.restoreAllMocks(); providerSessions.clear(); attributes.clear();
  vi.spyOn(chatwoot, 'findApiInboxByIdForSession').mockImplementation(async (_accountId, inboxId) => ({ id: inboxId, identifier: `api-${inboxId}`, additionalAttributes: attributes.get(inboxId) || {} }));
  vi.spyOn(chatwoot, 'findApiInboxById').mockImplementation(async inboxId => ({ id: inboxId, identifier: `api-${inboxId}`, additionalAttributes: attributes.get(inboxId) || {} }));
  vi.spyOn(chatwoot, 'updateInboxAdditionalAttributes').mockImplementation(async (inboxId, patch) => { attributes.set(inboxId, { ...(attributes.get(inboxId) || {}), ...patch }); return {} as never; });
  vi.spyOn(waha, 'getSession').mockImplementation(async name => {
    const session = providerSessions.get(name);
    if (!session) { const { WahaApiError } = await import('./waha'); throw new WahaApiError('api', 404); }
    return session;
  });
  vi.spyOn(waha, 'createSession').mockImplementation(async input => {
    const session = { name: input.name, status: 'STOPPED', connectionStatus: 'disconnected' as const }; providerSessions.set(input.name, session); return session;
  });
  vi.spyOn(waha, 'startSession').mockImplementation(async name => {
    const session = { name, status: 'SCAN', connectionStatus: 'connecting' as const }; providerSessions.set(name, session); return session;
  });
  vi.spyOn(waha, 'restartSession').mockImplementation(async name => {
    const session = { name, status: 'SCAN', connectionStatus: 'connecting' as const }; providerSessions.set(name, session); return session;
  });
  vi.spyOn(waha, 'getQrCode').mockResolvedValue({ mimetype: 'image/png', data: 'synthetic-qr' });
  vi.spyOn(waha, 'logoutSession').mockImplementation(async name => { providerSessions.set(name, { name, status: 'STOPPED', connectionStatus: 'disconnected' }); return null; });
  vi.spyOn(waha, 'deleteSession').mockImplementation(async name => { providerSessions.delete(name); });
});

describe('inbox-scoped WhatsApp connection routes', () => {
  it('creates one server-named connection, returns QR immediately and reuses it', async () => {
    const first = await post(101); const firstBody = await first.json();
    expect(first.status).toBe(201);
    expect(firstBody).toEqual({ connection: { status: 'SCAN', connectionStatus: 'connecting' }, qr: { mimetype: 'image/png', data: 'synthetic-qr' } });
    const generatedName = vi.mocked(waha.createSession).mock.calls[0][0].name;
    expect(generatedName).toMatch(/^waha_[a-f0-9]{24}$/);
    expect(JSON.stringify(firstBody)).not.toContain(generatedName);

    const second = await post(101);
    expect(second.status).toBe(200);
    expect(waha.createSession).toHaveBeenCalledTimes(1);
  });

  it('keeps separate inboxes isolated', async () => {
    expect((await post(201)).status).toBe(201);
    expect((await post(202)).status).toBe(201);
    const names = vi.mocked(waha.createSession).mock.calls.map(call => call[0].name);
    expect(new Set(names).size).toBe(2);
  });

  it('adopts an existing persisted connection after refresh without creating another', async () => {
    attributes.set(301, { whatsapp_transports: ['waha'], waha_session_name: 'legacy-private-name' });
    providerSessions.set('legacy-private-name', { name: 'legacy-private-name', status: 'WORKING', connectionStatus: 'connected', me: { id: '5511888888888@c.us', pushName: 'Legado' } });
    const response = await fetch(`${base}/providers/waha/inboxes/301/connection?accountId=7&inboxId=301`, { headers: requestHeaders });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ connection: { status: 'WORKING', connectionStatus: 'connected', me: { id: '5511888888888@c.us', pushName: 'Legado' } } });
    expect(JSON.stringify(body)).not.toContain('legacy-private-name');
    expect(waha.createSession).not.toHaveBeenCalled();
  });

  it('reconnects the same provider connection without duplication', async () => {
    await post(401); const name = vi.mocked(waha.createSession).mock.calls[0][0].name;
    vi.clearAllMocks();
    const response = await post(401, '/reconnect');
    expect(response.status).toBe(200);
    expect(waha.restartSession).toHaveBeenCalledWith(name);
    expect(waha.createSession).not.toHaveBeenCalled();
  });

  it('does not request a QR when a transient reconnect restores the persisted login', async () => {
    await post(402); const name = vi.mocked(waha.createSession).mock.calls[0][0].name;
    vi.clearAllMocks();
    vi.mocked(waha.restartSession).mockImplementationOnce(async () => {
      providerSessions.set(name, { name, status: 'WORKING', connectionStatus: 'connected', me: { id: '5511666666666@c.us' } });
      return { name, status: 'STARTING', connectionStatus: 'connecting' };
    });
    const response = await post(402, '/reconnect');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ connection: { status: 'WORKING', connectionStatus: 'connected' } });
    expect(waha.getQrCode).not.toHaveBeenCalled();
  });

  it('logs out the device but keeps its session ownership and inbox binding', async () => {
    await post(450); const name = vi.mocked(waha.createSession).mock.calls[0][0].name;
    const response = await post(450, '/disconnect');
    expect(response.status).toBe(200);
    expect(waha.logoutSession).toHaveBeenCalledWith(name);
    expect(waha.deleteSession).not.toHaveBeenCalledWith(name);
    expect(attributes.get(450)).toMatchObject({ waha_session_name: name, whatsapp_transports: ['waha'], waha_connection_status: 'disconnected' });
    const reconnect = await post(450, '/reconnect');
    expect(reconnect.status).toBe(200);
    expect(waha.createSession).toHaveBeenCalledTimes(1);
  });

  it('deletes only the connection and clears its inbox binding', async () => {
    await post(501); const name = vi.mocked(waha.createSession).mock.calls[0][0].name;
    const response = await fetch(`${base}/providers/waha/inboxes/501/connection`, { method: 'DELETE', headers: requestHeaders, body: JSON.stringify({ accountId: 7, inboxId: 501 }) });
    expect(response.status).toBe(204);
    expect(waha.deleteSession).toHaveBeenCalledWith(name);
    expect(attributes.get(501)).toMatchObject({ waha_session_name: '', whatsapp_transports: [] });
    expect(chatwoot.updateInboxAdditionalAttributes).toHaveBeenCalled();
  });
});
