import { createHmac, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import type { Server } from 'node:http';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

let server: Server;
let railsServer: Server;
let base: string;
let railsBase: string;
let dir: string;
const railsRequests: string[] = [];
let waha: typeof import('./waha').wahaTransport;
let sessions: import('./wahaSessionStore').WahaSessionStore;
const secret = 'hybrid-route-test-secret';
const session = { name: 'hybrid-a1-i5', status: 'WORKING', connectionStatus: 'connected' as const, me: { id: '5511999999999@c.us' } };
const post = async (path: string, body: Record<string, unknown>, signed = true) => {
  const raw = JSON.stringify({ account_id: 1, inbox_id: 5, channel_id: 7, waha_session: session.name, ...body });
  const timestamp = String(Math.floor(Date.now() / 1000)); const requestId = randomUUID();
  return fetch(`${base}${path}`, { method: 'POST', body: raw, headers: { 'Content-Type': 'application/json', ...(signed ? {
    'X-Hybrid-Waha-Timestamp': timestamp, 'X-Hybrid-Waha-Request-Id': requestId,
    'X-Hybrid-Waha-Signature': createHmac('sha256', secret).update(`POST\n${path}\n${timestamp}\n${requestId}\n${raw}`).digest('hex'),
  } : {}) } });
};
const path = (operation: string) => `/internal/official-whatsapp/waha/${operation}`;

beforeAll(async () => {
  dir = await mkdtemp(`${tmpdir()}/hybrid-routes-`);
  railsServer = createServer((request, response) => {
    railsRequests.push(request.url || '');
    response.setHeader('Content-Type', 'application/json');
    if (request.url === '/internal/official_whatsapp/waha/inbound') response.end(JSON.stringify({ handled: true, ignored: true }));
    else { response.statusCode = 500; response.end(JSON.stringify({ error: 'unexpected legacy Chatwoot request' })); }
  });
  railsServer.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => railsServer.once('listening', resolve));
  railsBase = `http://127.0.0.1:${(railsServer.address() as { port: number }).port}`;
  for (const [key, value] of Object.entries({ BRIDGE_WEBHOOK_SECRET: 'test', WAHA_WEBHOOK_SECRET: 'test', CHATWOOT_BASE_URL: railsBase, HYBRID_WAHA_BRIDGE_SECRET: secret,
    BRIDGE_REDIS_URL: '', BRIDGE_DEDUP_FILE: `${dir}/dedup.json`, BRIDGE_WAHA_SESSION_OWNERSHIP_FILE: `${dir}/sessions.json` })) vi.stubEnv(key, value);
  const { app } = await import('./index');
  waha = (await import('./waha')).wahaTransport;
  const Store = (await import('./wahaSessionStore')).WahaSessionStore;
  sessions = new Store(`${dir}/sessions.json`);
  vi.spyOn(waha, 'getSession').mockResolvedValue(session);
  vi.spyOn(waha, 'sendText').mockResolvedValue({ messageId: 'true_chat_test' } as never);
  vi.spyOn(waha, 'getChatAvatarUrl').mockResolvedValue(undefined);
  server = app.listen(0, process.env.HYBRID_RAILS_CONTAINER ? '0.0.0.0' : '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  if (railsServer) await new Promise<void>((resolve, reject) => railsServer.close(error => error ? reject(error) : resolve()));
  vi.restoreAllMocks(); vi.unstubAllEnvs();
  await rm(dir, { recursive: true, force: true });
});

describe('signed historical hybrid routes', () => {
  it('rejects unsigned browser calls', async () => {
    expect((await post(path('session/list'), {}, false)).status).toBe(401);
  });
  it('creates idempotently, binds, reports status, unbinds and keeps session manageable', async () => {
    expect((await post(path('session/create'), {})).status).toBe(200);
    expect((await post(path('binding/bind'), {})).status).toBe(200);
    const status = await post(path('binding/status'), {});
    expect(await status.json()).toMatchObject({ status: 'connected' });
    expect((await post(path('binding/unbind'), {})).status).toBe(200);
    const list = await post(path('session/list'), {});
    expect(await list.json()).toMatchObject({ sessions: [{ name: session.name }] });
    expect((await post(path('binding/bind'), {})).status).toBe(200);
  });
  it('rejects cross-account ownership without invoking WAHA', async () => {
    vi.mocked(waha.getSession).mockClear();
    expect((await post(path('binding/status'), { account_id: 2 })).status).toBe(403);
    expect(waha.getSession).not.toHaveBeenCalled();
  });
  it('dispatches only an owned session', async () => {
    expect((await post(path('operations'), { operation: 'text', payload: { remote_jid: '5511999999999@c.us', content: 'test' } })).status).toBe(200);
    expect(waha.sendText).toHaveBeenCalledTimes(1);
  });
  it('routes a private hybrid WAHA echo to Rails reconciliation without using the legacy message API', async () => {
    railsRequests.length = 0;
    const body = JSON.stringify({ event: 'message.any', session: session.name, payload: {
      id: 'true_5511999999999@c.us_3EB0ECHO', chatId: '5511999999999@c.us', to: '5511999999999@c.us', fromMe: true, notifyName: 'Contato', body: 'fallback'
    } });
    const response = await fetch(`${base}/webhooks/waha`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Webhook-Hmac': createHmac('sha512', 'test').update(body).digest('hex') }, body,
    });
    expect(response.status).toBe(202);
    await vi.waitFor(() => expect(railsRequests).toContain('/internal/official_whatsapp/waha/inbound'));
    expect(railsRequests).toEqual(['/internal/official_whatsapp/waha/inbound']);
  });
  it('never reclaims a cleanup_pending session', async () => {
    // Read persisted ownership afresh, as a worker would after process restart.
    await sessions.update(session.name, { status: 'cleanup_pending' });
    // The local store in the running app is process-local; exercise pending
    // guards using its update operation via the shared prototype below.
    const Store = (await import('./wahaSessionStore')).WahaSessionStore;
    const original = Store.prototype.get;
    const spy = vi.spyOn(Store.prototype, 'get').mockImplementation(async function(name) {
      const value = await original.call(this, name);
      return value && { ...value, status: 'cleanup_pending' };
    });
    expect((await post(path('session/create'), {})).status).toBe(403);
    expect((await post(path('binding/bind'), {})).status).toBe(403);
    spy.mockRestore();
  });

  it.skipIf(!process.env.HYBRID_RAILS_CONTAINER)('integrates real Rails requests, persistence and signed HTTP dispatch', async () => {
    vi.mocked(waha.getSession).mockImplementation(async name => ({ ...session, name }));
    const gateway = process.env.HYBRID_TEST_GATEWAY;
    if (!gateway) throw new Error('HYBRID_TEST_GATEWAY is required for the local container');
    const port = (server.address() as { port: number }).port;
    const { stdout } = await promisify(execFile)('docker', ['exec', '-e', 'RAILS_ENV=test', '-e', 'POSTGRES_DATABASE=chatwoot_hybrid_completion_test',
      '-e', 'HYBRID_INTEGRATION=1', '-e', `HYBRID_WAHA_BRIDGE_URL=http://${gateway}:${port}`, '-e', `HYBRID_WAHA_BRIDGE_SECRET=${secret}`,
      process.env.HYBRID_RAILS_CONTAINER!, 'bundle', 'exec', 'ruby', '-r', './config/environment', '-e',
      'ActiveRecord.maintain_test_schema = false; load Gem.bin_path("rspec-core", "rspec")', '--', 'spec/requests/whatsapp_hybrid_bridge_integration_spec.rb'], { timeout: 60000 })
      .catch(error => { throw new Error(error.stdout || 'Local Rails integration process failed'); });
    expect(stdout).toContain('1 example, 0 failures');
  }, 65000);
});
