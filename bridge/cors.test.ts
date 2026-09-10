import { mkdtemp, rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const allowedOrigin = 'https://app.synthetic.example';
const sessionHeaders = {
  'Content-Type': 'application/json',
  'Access-Token': 'synthetic-token',
  'Token-Type': 'Bearer',
  Client: 'synthetic-client',
  Expiry: '9999999999',
  Uid: 'administrator@synthetic.example',
  'X-Chatwoot-Account-Id': '47',
  Origin: allowedOrigin,
};

let bridgeServer: Server;
let railsServer: Server;
let base: string;
let directory: string;
let chatwoot: typeof import('./chatwoot').chatwootBridge;
let waha: typeof import('./waha').wahaTransport;

beforeAll(async () => {
  directory = await mkdtemp(`${tmpdir()}/bridge-cors-`);
  railsServer = createServer((_request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({
      account_id: 47,
      role: 'administrator',
      accounts: [{ id: 47, role: 'administrator' }],
    }));
  });
  railsServer.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => railsServer.once('listening', resolve));
  const railsBase = `http://127.0.0.1:${(railsServer.address() as { port: number }).port}`;

  for (const [key, value] of Object.entries({
    NODE_ENV: 'test',
    BRIDGE_WEBHOOK_SECRET: 'synthetic-webhook-secret',
    BRIDGE_PUBLIC_URL: 'https://bridge.synthetic.example',
    BRIDGE_ALLOWED_ORIGINS: allowedOrigin,
    CHATWOOT_BASE_URL: railsBase,
    BRIDGE_REDIS_URL: '',
    WAHA_BASE_URL: 'http://waha.synthetic.test',
    WAHA_API_KEY: 'synthetic-key',
    BRIDGE_DEDUP_FILE: `${directory}/dedup.json`,
    BRIDGE_IDENTITY_FILE: `${directory}/identities.json`,
    BRIDGE_GROUP_CREATION_FILE: `${directory}/creations.json`,
    BRIDGE_WAHA_SESSION_OWNERSHIP_FILE: `${directory}/sessions.json`,
  })) vi.stubEnv(key, value);

  const imported = await import('./index');
  chatwoot = (await import('./chatwoot')).chatwootBridge;
  waha = (await import('./waha')).wahaTransport;
  bridgeServer = imported.app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => bridgeServer.once('listening', resolve));
  base = `http://127.0.0.1:${(bridgeServer.address() as { port: number }).port}`;
});

afterAll(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  if (bridgeServer) await new Promise<void>((resolve, reject) => bridgeServer.close(error => error ? reject(error) : resolve()));
  if (railsServer) await new Promise<void>((resolve, reject) => railsServer.close(error => error ? reject(error) : resolve()));
  await rm(directory, { recursive: true, force: true });
});

describe('bridge CORS for WAHA inbox deletion', () => {
  it('allows DELETE in a preflight from a configured origin', async () => {
    const response = await fetch(`${base}/providers/waha/inboxes/608`, {
      method: 'OPTIONS',
      headers: {
        Origin: allowedOrigin,
        'Access-Control-Request-Method': 'DELETE',
        'Access-Control-Request-Headers': 'content-type,access-token,token-type,client,expiry,uid,x-chatwoot-account-id',
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe(allowedOrigin);
    expect(response.headers.get('access-control-allow-methods')?.split(/,\s*/)).toContain('DELETE');
  });

  it('keeps preflight blocked for an origin outside BRIDGE_ALLOWED_ORIGINS', async () => {
    const response = await fetch(`${base}/providers/waha/inboxes/608`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://untrusted.synthetic.example', 'Access-Control-Request-Method': 'DELETE' },
    });

    expect(response.status).toBe(403);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('lets DELETE reach the authenticated inbox route after preflight', async () => {
    const inbox = {
      id: 608,
      identifier: 'synthetic-inbox-608',
      additionalAttributes: { whatsapp_transports: ['waha'], waha_session_name: 'synthetic-session-608' },
    };
    const findInbox = vi.spyOn(chatwoot, 'findApiInboxByIdForSession').mockResolvedValue(inbox);
    const deleteInbox = vi.spyOn(chatwoot, 'deleteInboxForSession').mockResolvedValue(undefined);
    const deleteSession = vi.spyOn(waha, 'deleteSession').mockResolvedValue(undefined);

    const response = await fetch(`${base}/providers/waha/inboxes/608`, {
      method: 'DELETE',
      headers: sessionHeaders,
      body: JSON.stringify({ accountId: 47, inboxId: 608 }),
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe(allowedOrigin);
    expect(findInbox).toHaveBeenCalledWith(47, 608, expect.any(Headers));
    expect(deleteSession).toHaveBeenCalledWith('synthetic-session-608');
    expect(deleteInbox).toHaveBeenCalledWith(47, 608, expect.any(Headers));
  });
});
