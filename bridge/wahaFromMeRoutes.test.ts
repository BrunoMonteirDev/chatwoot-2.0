import { createHmac } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import type { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

let server: Server;
let base: string;
let directory: string;
let chatwoot: typeof import('./chatwoot').chatwootBridge;
let waha: typeof import('./waha').wahaTransport;

const inboxes = {
  'tenant-session-a': { accountId: 47, id: 608, identifier: 'synthetic-inbox-a' },
  'tenant-session-b': { accountId: 73, id: 904, identifier: 'synthetic-inbox-b' },
} as const;

const postWaha = (session: keyof typeof inboxes, payload: Record<string, unknown>) => {
  const raw = JSON.stringify({ event: 'message.any', session, payload });
  return fetch(`${base}/webhooks/waha`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Hmac': createHmac('sha512', 'synthetic-waha-secret').update(raw).digest('hex'),
    },
    body: raw,
  });
};

const postWahaMutation = (session: keyof typeof inboxes, event: 'message.edited' | 'message.revoked', payload: Record<string, unknown>) => {
  const raw = JSON.stringify({ event, session, payload });
  return fetch(`${base}/webhooks/waha`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Hmac': createHmac('sha512', 'synthetic-waha-secret').update(raw).digest('hex'),
    },
    body: raw,
  });
};

beforeAll(async () => {
  directory = await mkdtemp(`${tmpdir()}/waha-from-me-routes-`);
  for (const [key, value] of Object.entries({
    NODE_ENV: 'test',
    BRIDGE_WEBHOOK_SECRET: 'synthetic-bridge-secret',
    CHATWOOT_BASE_URL: 'http://chatwoot.synthetic.test',
    BRIDGE_REDIS_URL: '',
    WAHA_BASE_URL: 'http://waha.synthetic.test',
    WAHA_API_KEY: 'synthetic-key',
    WAHA_WEBHOOK_SECRET: 'synthetic-waha-secret',
    HYBRID_WAHA_BRIDGE_SECRET: '',
    BRIDGE_DEDUP_FILE: `${directory}/dedup.json`,
    BRIDGE_IDENTITY_FILE: `${directory}/identities.json`,
    BRIDGE_GROUP_CREATION_FILE: `${directory}/creations.json`,
    BRIDGE_WAHA_SESSION_OWNERSHIP_FILE: `${directory}/sessions.json`,
  })) vi.stubEnv(key, value);

  const Store = (await import('./wahaSessionStore')).WahaSessionStore;
  const ownership = new Store(`${directory}/sessions.json`);
  await ownership.reserve({ accountId: inboxes['tenant-session-a'].accountId, inboxId: inboxes['tenant-session-a'].id, sessionName: 'tenant-session-a' });
  await ownership.reserve({ accountId: inboxes['tenant-session-b'].accountId, inboxId: inboxes['tenant-session-b'].id, sessionName: 'tenant-session-b' });

  const imported = await import('./index');
  chatwoot = (await import('./chatwoot')).chatwootBridge;
  waha = (await import('./waha')).wahaTransport;
  server = imported.app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});

afterAll(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await rm(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 });
});

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(waha, 'getChatAvatarUrl').mockResolvedValue(undefined);
  vi.spyOn(chatwoot, 'findWahaInbox').mockImplementation(async session => {
    const inbox = inboxes[session as keyof typeof inboxes];
    if (!inbox) throw new Error('Synthetic session not found.');
    return { id: inbox.id, identifier: inbox.identifier };
  });
  vi.spyOn(chatwoot, 'findContactSourceByPhone').mockResolvedValue(undefined);
  vi.spyOn(chatwoot, 'createOrFindContact').mockImplementation(async (identifier, input) => ({ id: identifier === inboxes['tenant-session-a'].identifier ? 1001 : 1002, source_id: input.sourceId, name: input.name }));
  vi.spyOn(chatwoot, 'updatePublicContact').mockResolvedValue({} as never);
  vi.spyOn(chatwoot, 'saveWahaIdentity').mockResolvedValue({} as never);
  vi.spyOn(chatwoot, 'findOrCreateConversation').mockImplementation(async (_identifier, _sourceId, _contactId, inboxId) => ({ id: inboxId === 608 ? 2001 : 2002, status: 'open', inbox_id: inboxId }));
  vi.spyOn(chatwoot, 'createMobileOutgoingTransportMessage').mockResolvedValue({} as never);
  vi.spyOn(chatwoot, 'editWhatsAppMessageBySourceId').mockResolvedValue({} as never);
  vi.spyOn(chatwoot, 'revokeWhatsAppMessageBySourceId').mockResolvedValue({} as never);
});

describe('WAHA fromMe inbound routing', () => {
  it('persists a message created by the connected device as outgoing', async () => {
    const response = await postWaha('tenant-session-a', {
      id: 'true_5500000000001@c.us_MOBILEA',
      from: '5500000000001@c.us',
      fromMe: true,
      source: 'app',
      notifyName: 'Synthetic contact A',
      body: 'Sent from the connected device',
    });

    expect(response.status).toBe(202);
    await vi.waitFor(() => expect(chatwoot.createMobileOutgoingTransportMessage).toHaveBeenCalledWith(
      2001, 'waha', 'Sent from the connected device', 'MOBILEA', undefined, '5500000000001@c.us', undefined,
      expect.objectContaining({ providerMessageKey: 'true_5500000000001@c.us_MOBILEA' }),
    ));
  });

  it('does not duplicate the Chatwoot message when its WAHA API echo returns', async () => {
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const response = await postWaha('tenant-session-a', {
      id: 'true_5500000000001@c.us_PLATFORMECHO',
      from: '5500000000001@c.us',
      fromMe: true,
      source: 'api',
      notifyName: 'Synthetic contact A',
      body: 'Sent from Chatwoot',
    });

    expect(response.status).toBe(202);
    await vi.waitFor(() => expect(log).toHaveBeenCalledWith('[waha] platform echo ignored', {
      session: 'tenant-session-a', messageId: 'PLATFORMECHO',
    }));
    expect(chatwoot.createOrFindContact).not.toHaveBeenCalled();
    expect(chatwoot.createMobileOutgoingTransportMessage).not.toHaveBeenCalled();
  });

  it('routes a device message only through its owned account, inbox and session', async () => {
    const accountScope = vi.spyOn(chatwoot, 'withAccount');
    const response = await postWaha('tenant-session-b', {
      id: 'true_5500000000002@c.us_MOBILEB',
      from: '5500000000002@c.us',
      fromMe: true,
      source: 'app',
      notifyName: 'Synthetic contact B',
      body: 'Tenant B device message',
    });

    expect(response.status).toBe(202);
    await vi.waitFor(() => expect(chatwoot.createMobileOutgoingTransportMessage).toHaveBeenCalledWith(
      2002, 'waha', 'Tenant B device message', 'MOBILEB', undefined, '5500000000002@c.us', undefined, expect.anything(),
    ));
    expect(chatwoot.findWahaInbox).toHaveBeenCalledWith('tenant-session-b');
    expect(chatwoot.findOrCreateConversation).toHaveBeenCalledWith(inboxes['tenant-session-b'].identifier, expect.any(String), 1002, 904);
    expect(accountScope).toHaveBeenCalledWith(73, expect.any(Function));
    expect(accountScope).not.toHaveBeenCalledWith(47, expect.any(Function));
  });

  it('updates the existing message for device edit and revoke without creating a duplicate', async () => {
    await postWahaMutation('tenant-session-a', 'message.edited', {
      chatId: '5500000000001@c.us', editedMessageId: 'SYNTHETIC-MUTATION', body: 'Edited on device',
    });
    await vi.waitFor(() => expect(chatwoot.editWhatsAppMessageBySourceId).toHaveBeenCalledWith(608, 'waha:SYNTHETIC-MUTATION', 'Edited on device'));
    await postWahaMutation('tenant-session-a', 'message.edited', {
      chatId: '5500000000001@c.us', editedMessageId: 'SYNTHETIC-MUTATION', body: 'Edited again on device',
    });
    await vi.waitFor(() => expect(chatwoot.editWhatsAppMessageBySourceId).toHaveBeenCalledWith(608, 'waha:SYNTHETIC-MUTATION', 'Edited again on device'));
    expect(chatwoot.editWhatsAppMessageBySourceId).toHaveBeenCalledTimes(2);

    await postWahaMutation('tenant-session-a', 'message.revoked', {
      after: {
        id: 'true_5500000000001@c.us_SYNTHETIC-REVOKE-ACTION',
        from: '5500000000001@c.us', fromMe: true, source: 'app', body: '',
      },
      revokedMessageId: 'SYNTHETIC-MUTATION', before: null,
    });
    await vi.waitFor(() => expect(chatwoot.revokeWhatsAppMessageBySourceId).toHaveBeenCalledWith(608, 'waha:SYNTHETIC-MUTATION'));

    expect(chatwoot.createMobileOutgoingTransportMessage).not.toHaveBeenCalled();
  });

  it('isolates equal provider message ids by account, inbox and WAHA session', async () => {
    await postWahaMutation('tenant-session-a', 'message.revoked', { chatId: '5500000000001@c.us', revokedMessageId: 'SAME-ID' });
    await postWahaMutation('tenant-session-b', 'message.revoked', { chatId: '5500000000002@c.us', revokedMessageId: 'SAME-ID' });

    await vi.waitFor(() => expect(chatwoot.revokeWhatsAppMessageBySourceId).toHaveBeenCalledTimes(2));
    expect(chatwoot.revokeWhatsAppMessageBySourceId).toHaveBeenCalledWith(608, 'waha:SAME-ID');
    expect(chatwoot.revokeWhatsAppMessageBySourceId).toHaveBeenCalledWith(904, 'waha:SAME-ID');
  });
});
