import { mkdtemp, rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

let bridgeServer: Server;
let railsServer: Server;
let base: string;
let directory: string;
let chatwoot: typeof import('./chatwoot').chatwootBridge;
let waha: typeof import('./waha').wahaTransport;

const headers = {
  'Content-Type': 'application/json', 'Access-Token': 'synthetic-token', 'Token-Type': 'Bearer',
  Client: 'synthetic-client', Expiry: '9999999999', Uid: 'agent@synthetic.example', 'X-Chatwoot-Account-Id': '47',
};

beforeAll(async () => {
  directory = await mkdtemp(`${tmpdir()}/message-mutations-`);
  railsServer = createServer((_request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify({ account_id: 47, role: 'administrator', accounts: [{ id: 47, role: 'administrator' }] }));
  });
  railsServer.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => railsServer.once('listening', resolve));

  for (const [key, value] of Object.entries({
    NODE_ENV: 'test', BRIDGE_WEBHOOK_SECRET: 'synthetic-secret', CHATWOOT_BASE_URL: `http://127.0.0.1:${(railsServer.address() as { port: number }).port}`,
    BRIDGE_REDIS_URL: '', WAHA_BASE_URL: 'http://waha.synthetic.test', WAHA_API_KEY: 'synthetic-key',
    BRIDGE_DEDUP_FILE: `${directory}/dedup.json`, BRIDGE_IDENTITY_FILE: `${directory}/identities.json`,
    BRIDGE_GROUP_CREATION_FILE: `${directory}/creations.json`, BRIDGE_WAHA_SESSION_OWNERSHIP_FILE: `${directory}/sessions.json`,
  })) vi.stubEnv(key, value);

  const Store = (await import('./wahaSessionStore')).WahaSessionStore;
  const ownership = new Store(`${directory}/sessions.json`);
  await ownership.reserve({ accountId: 47, inboxId: 608, sessionName: 'synthetic-session' });
  const imported = await import('./index');
  chatwoot = (await import('./chatwoot')).chatwootBridge;
  waha = (await import('./waha')).wahaTransport;
  bridgeServer = imported.app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => bridgeServer.once('listening', resolve));
  base = `http://127.0.0.1:${(bridgeServer.address() as { port: number }).port}`;
});

afterAll(async () => {
  vi.restoreAllMocks(); vi.unstubAllEnvs();
  if (bridgeServer) await new Promise<void>((resolve, reject) => bridgeServer.close(error => error ? reject(error) : resolve()));
  if (railsServer) await new Promise<void>((resolve, reject) => railsServer.close(error => error ? reject(error) : resolve()));
  await rm(directory, { recursive: true, force: true });
});

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(chatwoot, 'findWhatsAppInboxById').mockResolvedValue({ id: 608, configuration: { mode: 'web', transports: ['waha'], evolutionInstanceName: null, wahaSessionName: 'synthetic-session' } });
  vi.spyOn(waha, 'editMessage').mockResolvedValue(undefined);
  vi.spyOn(waha, 'revokeMessage').mockResolvedValue(undefined);
  vi.spyOn(chatwoot, 'editWhatsAppMessageBySourceId').mockResolvedValue({ id: 42, conversation_id: 31, content: 'Edited', content_attributes: { whatsapp_edited: true } });
  vi.spyOn(chatwoot, 'revokeWhatsAppMessageBySourceId').mockResolvedValue({ id: 42, conversation_id: 31, content: 'Original', content_attributes: { whatsapp_revoked: true } });
});

const operation = (name: 'edit' | 'revoke', extra: Record<string, unknown> = {}) => fetch(`${base}/operations/messages/${name}`, {
  method: 'POST', headers, body: JSON.stringify({ accountId: 47, inboxId: 608, sourceId: 'waha:SYNTHETIC', remoteJid: '5500000000001@c.us', targetFromMe: true, transport: 'waha', ...extra }),
});

const capabilities = (extra: Record<string, unknown> = {}) => fetch(`${base}/operations/messages/capabilities`, {
  method: 'POST', headers, body: JSON.stringify({ accountId: 47, inboxId: 608, sourceId: 'waha:SYNTHETIC', targetFromMe: true, ...extra }),
});

describe('platform WhatsApp message mutations', () => {
  it('reports only explicit provider support without calculating a message-age window', async () => {
    const response = await capabilities({ createdAt: 1 });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ edit: 'supported', revoke: 'supported' });
  });

  it('reports an explicitly unsupported provider capability', async () => {
    vi.mocked(chatwoot.findWhatsAppInboxById).mockResolvedValue({ id: 608, configuration: { mode: 'official', transports: ['meta_cloud'], evolutionInstanceName: null, wahaSessionName: null } });

    const response = await capabilities({ sourceId: 'meta:wamid.SYNTHETIC' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ edit: 'unsupported', revoke: 'unsupported' });
  });

  it('persists revoke only after the provider accepts it', async () => {
    const response = await operation('revoke');

    expect(response.status).toBe(200);
    expect(waha.revokeMessage).toHaveBeenCalledWith('synthetic-session', '5500000000001@c.us', 'true_5500000000001@c.us_SYNTHETIC');
    expect(chatwoot.revokeWhatsAppMessageBySourceId).toHaveBeenCalledWith(608, 'waha:SYNTHETIC');
    expect(vi.mocked(waha.revokeMessage).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(chatwoot.revokeWhatsAppMessageBySourceId).mock.invocationCallOrder[0]);
  });

  it('reconstructs the serialized WAHA key when the remote JID is a bare phone number', async () => {
    const response = await operation('revoke', { remoteJid: '5500000000001' });

    expect(response.status).toBe(200);
    expect(waha.revokeMessage).toHaveBeenCalledWith('synthetic-session', '5500000000001', 'true_5500000000001@c.us_SYNTHETIC');
  });

  it('keeps persistence untouched and returns clear feedback when revoke is refused', async () => {
    vi.mocked(waha.revokeMessage).mockRejectedValue(new Error('provider window expired'));

    const response = await operation('revoke');

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: 'Esta mensagem não pode mais ser excluída para todos.', category: 'provider_rejected' });
    expect(chatwoot.revokeWhatsAppMessageBySourceId).not.toHaveBeenCalled();
  });

  it('keeps persistence untouched and returns clear feedback when edit is refused', async () => {
    vi.mocked(waha.editMessage).mockRejectedValue(new Error('provider window expired'));

    const response = await operation('edit', { content: 'Edited' });

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({ error: 'Esta mensagem não pode mais ser editada.', category: 'provider_rejected' });
    expect(chatwoot.editWhatsAppMessageBySourceId).not.toHaveBeenCalled();
  });
});
