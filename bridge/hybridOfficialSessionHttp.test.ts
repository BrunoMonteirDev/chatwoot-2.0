import { createHmac, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const secret = 'hybrid-http-test-secret';
let directory = '';
let createBridgeApp: (dependencies?: { wahaTransport?: unknown }) => import('express').Express;
let WahaApiError: typeof import('./waha.js').WahaApiError;
let fakeWaha: Record<string, ReturnType<typeof vi.fn>>;
const session = (status = 'WORKING') => ({ name: 'hybrid-a1-i10', status, connectionStatus: status === 'WORKING' ? 'connected' : status === 'SCAN_QR_CODE' ? 'connecting' : 'disconnected', engine: 'GOWS', me: { id: '554488567632@c.us' } });

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'hybrid-waha-http-'));
  Object.assign(process.env, {
    BRIDGE_TEST_APP: '1', BRIDGE_WEBHOOK_SECRET: 'bridge-test-secret', WAHA_WEBHOOK_SECRET: 'bridge-test-secret', CHATWOOT_BASE_URL: 'http://chatwoot.test',
    BRIDGE_ENCRYPTION_KEY: 'bridge-test-encryption-key', HYBRID_WAHA_BRIDGE_SECRET: secret,
    BRIDGE_DEDUP_FILE: join(directory, 'dedup.json'), BRIDGE_IDENTITY_FILE: join(directory, 'identity.json'),
    BRIDGE_META_CONFIG_FILE: join(directory, 'meta.json'), BRIDGE_META_HISTORY_FILE: join(directory, 'history.json'),
    BRIDGE_WAHA_HISTORY_FILE: join(directory, 'waha-history.json'), BRIDGE_WAHA_SESSION_OWNERSHIP_FILE: join(directory, 'ownership.json'),
  });
  ({ createBridgeApp } = await import('./index.js'));
  ({ WahaApiError } = await import('./waha.js'));
});
afterAll(async () => {
  // Webhook processing is intentionally asynchronous after its 202 response.
  // Let pending persistent-store writes settle before removing the test data.
  await new Promise(resolve => setTimeout(resolve, 50));
  await rm(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
});

const buildWaha = () => {
  let exists = false;
  fakeWaha = {
    health: vi.fn().mockResolvedValue(true), createSession: vi.fn().mockImplementation(async () => { exists = true; return session('STARTING'); }),
    startSession: vi.fn().mockResolvedValue(session('SCAN_QR_CODE')), restartSession: vi.fn().mockResolvedValue(session('SCAN_QR_CODE')),
    logoutSession: vi.fn().mockResolvedValue(null), deleteSession: vi.fn().mockImplementation(async () => { exists = false; return null; }),
    getSession: vi.fn().mockImplementation(async () => {
      if (!exists) throw new WahaApiError('api', 404, 'Not Found');
      return session();
    }), getQrCode: vi.fn().mockResolvedValue({ mimetype: 'image/png', data: 'qr-data' }),
    listChats: vi.fn().mockResolvedValue([]), getChatAvatarUrl: vi.fn().mockResolvedValue(undefined),
    downloadMedia: vi.fn().mockResolvedValue({ buffer: Buffer.from('media'), contentType: 'image/jpeg', fileName: 'image.jpg' }),
  };
  return fakeWaha;
};
const withApp = async (callback: (base: string) => Promise<void>) => {
  const app = createBridgeApp({ wahaTransport: buildWaha() });
  const server = await new Promise<Server>(resolve => { const value = app.listen(0, () => resolve(value)); });
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No test port');
  try { await callback(`http://127.0.0.1:${address.port}`); } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
};
const signed = async (base: string, action: string, body: Record<string, unknown>, options: { requestId?: string; signature?: string; timestamp?: number } = {}) => {
  const path = `/internal/official-whatsapp/waha/session/${action}`; const raw = JSON.stringify(body);
  const requestId = options.requestId || randomUUID(); const timestamp = String(options.timestamp || Math.floor(Date.now() / 1000));
  const signature = options.signature || createHmac('sha256', secret).update(`POST\n${path}\n${timestamp}\n${requestId}\n${raw}`).digest('hex');
  return fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-hybrid-waha-signature': signature, 'x-hybrid-waha-timestamp': timestamp, 'x-hybrid-waha-request-id': requestId }, body: raw });
};
const context = (extra: Record<string, unknown> = {}) => ({ account_id: 1, inbox_id: 10, channel_id: 100, ...extra });

describe('testable bridge factory', () => {
  it('keeps health and legacy routes registered without opening a port itself', async () => {
    await withApp(async base => {
      expect((await fetch(`${base}/health`)).status).toBe(200);
      // The legacy WAHA health route remains protected; 401 proves it is
      // still registered without requiring a browser session in this test.
      expect((await fetch(`${base}/providers/waha/health`)).status).toBe(401);
      expect((await fetch(`${base}/ready`)).status).toBe(503);
    });
  });
});

describe('official hybrid WAHA session HTTP contract', () => {
  it('creates a server-named owned session and rejects invalid HMAC before mutation', async () => {
    await withApp(async base => {
      const invalid = await signed(base, 'create', context(), { signature: '0'.repeat(64) });
      expect(invalid.status).toBe(401); expect(fakeWaha.createSession).not.toHaveBeenCalled();
      const response = await signed(base, 'create', context({ waha_session: 'attacker-session' }));
      expect(response.status).toBe(200); expect(fakeWaha.createSession).toHaveBeenCalledWith({ name: 'hybrid-a1-i10' });
      expect((await response.json()).session.name).toBe('hybrid-a1-i10');
      expect(fakeWaha.startSession).toHaveBeenCalledWith('hybrid-a1-i10');
    });
  });

  it('makes a repeated create idempotent without releasing ownership', async () => {
    await withApp(async base => {
      expect((await signed(base, 'create', context())).status).toBe(200);
      expect((await signed(base, 'create', context())).status).toBe(200);

      expect(fakeWaha.createSession).toHaveBeenCalledTimes(1);
      expect(fakeWaha.startSession).toHaveBeenCalledTimes(1);
      expect((await signed(base, 'status', context({ waha_session: 'hybrid-a1-i10' }))).status).toBe(200);
    });
  });

  it('replaces only a missing same-inbox ownership record before creating', async () => {
    await withApp(async base => {
      expect((await signed(base, 'create', context())).status).toBe(200);
      fakeWaha.getSession.mockRejectedValueOnce(new WahaApiError('api', 404, 'Not Found'));

      expect((await signed(base, 'create', context())).status).toBe(200);
      expect(fakeWaha.createSession).toHaveBeenCalledTimes(2);
      expect((await signed(base, 'status', context({ waha_session: 'hybrid-a1-i10' }))).status).toBe(200);
    });
  });

  it('rejects expired, tampered and replayed requests without a second mutation', async () => {
    await withApp(async base => {
      expect((await signed(base, 'create', context(), { timestamp: Math.floor(Date.now() / 1000) - 301 })).status).toBe(401);
      const replay = randomUUID(); const first = await signed(base, 'create', context(), { requestId: replay });
      expect(first.status).toBe(200); expect((await signed(base, 'create', context(), { requestId: replay })).status).toBe(401);
      const raw = context(); const path = '/internal/official-whatsapp/waha/session/create'; const now = Math.floor(Date.now() / 1000); const requestId = randomUUID();
      const signature = createHmac('sha256', secret).update(`POST\n${path}\n${now}\n${requestId}\n${JSON.stringify(raw)}`).digest('hex');
      const tampered = await fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-hybrid-waha-signature': signature, 'x-hybrid-waha-timestamp': String(now), 'x-hybrid-waha-request-id': requestId }, body: JSON.stringify(context({ inbox_id: 11 })) });
      expect(tampered.status).toBe(401); expect(fakeWaha.createSession).toHaveBeenCalledTimes(1);
    });
  });

  it('enforces ownership for start, QR, status and delete and keeps status read-only', async () => {
    await withApp(async base => {
      await signed(base, 'create', context());
      for (const action of ['status', 'start', 'qr'] as const) expect((await signed(base, action, context({ waha_session: 'hybrid-a1-i10' }))).status).toBe(200);
      expect(fakeWaha.getSession).toHaveBeenCalled(); expect(fakeWaha.startSession).toHaveBeenCalled(); expect(fakeWaha.getQrCode).toHaveBeenCalledWith('hybrid-a1-i10');
      expect((await signed(base, 'status', context({ account_id: 2, waha_session: 'hybrid-a1-i10' }))).status).toBe(403);
      expect((await signed(base, 'delete', context({ inbox_id: 11, waha_session: 'hybrid-a1-i10' }))).status).toBe(403);
      expect((await signed(base, 'delete', context({ waha_session: 'hybrid-a1-i10' }))).status).toBe(204);
      expect(fakeWaha.deleteSession).toHaveBeenCalledWith('hybrid-a1-i10');
    });
  });

  it('lists only owned safe metadata and returns a safe failure without corrupting ownership', async () => {
    await withApp(async base => {
      await signed(base, 'create', context());
      const list = await signed(base, 'list', context()); expect(list.status).toBe(200);
      const payload = await list.json(); expect(payload.sessions).toHaveLength(1); expect(JSON.stringify(payload)).not.toContain('secret');
      fakeWaha.getSession.mockRejectedValueOnce(new Error('WAHA offline'));
      expect((await signed(base, 'status', context({ waha_session: 'hybrid-a1-i10' }))).status).toBe(502);
      expect((await signed(base, 'list', context())).status).toBe(200);
    });
  });

  it('reports a removed WAHA session as missing without changing ownership', async () => {
    await withApp(async base => {
      await signed(base, 'create', context());
      fakeWaha.getSession.mockRejectedValueOnce(new WahaApiError('api', 404, 'Not Found'));

      const response = await signed(base, 'status', context({ waha_session: 'hybrid-a1-i10' }));

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ session: { name: 'hybrid-a1-i10', connectionStatus: 'missing' } });
      expect((await signed(base, 'status', context({ waha_session: 'hybrid-a1-i10' }))).status).toBe(200);
    });
  });
});

describe('WAHA inbound routing', () => {
  const webhook = async (base: string, body: Record<string, unknown>) => {
    const raw = JSON.stringify(body);
    const signature = createHmac('sha512', 'bridge-test-secret').update(raw).digest('hex');
    return fetch(`${base}/webhooks/waha`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-webhook-hmac': signature }, body: raw });
  };

  it('delivers legacy Channel::Api inbound without calling the official hybrid endpoint', async () => {
    const nativeFetch = globalThis.fetch;
    const requests: Array<{ url: string; method: string; body?: string }> = [];
    let conversationReads = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input); const method = init?.method || 'GET';
      if (url.startsWith('http://127.0.0.1:')) return nativeFetch(input, init);
      requests.push({ url, method, body: typeof init?.body === 'string' ? init.body : undefined });
      if (url.endsWith('/api/v1/bridge/access_token')) return new Response(JSON.stringify({ api_access_token: 'test-token' }));
      if (url.endsWith('/api/v1/accounts/1/inboxes')) return new Response(JSON.stringify({ payload: [{ id: 10, channel_type: 'Channel::Api', inbox_identifier: 'legacy-waha', additional_attributes: { waha_session_name: 'hybrid-a1-i10', whatsapp_transports: ['waha'] } }] }));
      if (url.includes('/contacts/search?')) return new Response(JSON.stringify({ payload: [] }));
      if (url.includes('/public/api/v1/inboxes/legacy-waha/contacts') && method === 'POST') return new Response(JSON.stringify({ id: 20, source_id: 'whatsapp:5511999999999' }));
      if (url.endsWith('/api/v1/accounts/1/contacts/20') && method === 'PATCH') return new Response(JSON.stringify({}));
      if (url.endsWith('/api/v1/accounts/1/contacts/20/conversations')) {
        conversationReads += 1;
        return new Response(JSON.stringify({ payload: conversationReads === 1 ? [] : [{ id: 30, inbox_id: 10 }] }));
      }
      if (url.includes('/conversations') && url.includes('/public/api/v1/') && method === 'POST') return new Response(JSON.stringify({}));
      if (url.endsWith('/api/v1/accounts/1/conversations/30/messages') && method === 'POST') return new Response(JSON.stringify({ id: 40 }));
      throw new Error(`Unexpected fetch ${method} ${url}`);
    }));

    try {
      await withApp(async base => {
        await signed(base, 'create', context());
        const response = await webhook(base, { event: 'message', session: 'hybrid-a1-i10', payload: { id: 'legacy-inbound-1', from: '5511999999999@c.us', chatId: '5511999999999@c.us', body: 'TESTE INBOUND WAHA DEBUG 01', fromMe: false } });
        expect(response.status).toBe(202);
        for (let attempt = 0; attempt < 30 && !requests.some(request => request.url.endsWith('/messages')); attempt += 1) await new Promise(resolve => setTimeout(resolve, 10));
      });
      expect(requests.some(request => request.url.endsWith('/internal/official_whatsapp/waha/inbound'))).toBe(false);
      expect(requests.find(request => request.url.endsWith('/messages'))?.body).toContain('TESTE INBOUND WAHA DEBUG 01');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('keeps official hybrid private inbound on the official handler and out of legacy delivery', async () => {
    const nativeFetch = globalThis.fetch;
    const requests: Array<{ url: string; headers?: HeadersInit }> = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith('http://127.0.0.1:')) return nativeFetch(input, init);
      requests.push({ url, headers: init?.headers });
      if (url.endsWith('/api/v1/bridge/access_token')) return new Response(JSON.stringify({ api_access_token: 'test-token' }));
      if (url.endsWith('/api/v1/accounts/1/inboxes')) return new Response(JSON.stringify({ payload: [] }));
      if (url.endsWith('/internal/official_whatsapp/waha/inbound')) return new Response(JSON.stringify({ handled: true, ignored: true }));
      throw new Error(`Unexpected fetch ${url}`);
    }));

    try {
      await withApp(async base => {
        await signed(base, 'create', context());
        expect((await webhook(base, { event: 'message', session: 'hybrid-a1-i10', payload: { id: 'official-private-1', from: '5511999999999@c.us', chatId: '5511999999999@c.us', body: 'private', fromMe: false, pushName: 'Cliente', profilePicUrl: 'https://avatar.test/client.jpg' } })).status).toBe(202);
        for (let attempt = 0; attempt < 30 && !requests.some(request => request.url.endsWith('/internal/official_whatsapp/waha/inbound')); attempt += 1) await new Promise(resolve => setTimeout(resolve, 10));
      });
      const official = requests.find(request => request.url.endsWith('/internal/official_whatsapp/waha/inbound'));
      expect(official).toBeDefined();
      expect(new Headers(official?.headers).get('x-forwarded-proto')).toBe('https');
      expect(new Headers(official?.headers).get('x-forwarded-ssl')).toBe('on');
      expect(requests.some(request => request.url.endsWith('/messages'))).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('keeps legacy WAHA media on the legacy delivery path', async () => {
    const nativeFetch = globalThis.fetch;
    const requests: string[] = [];
    let conversationReads = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input); const method = init?.method || 'GET';
      if (url.startsWith('http://127.0.0.1:')) return nativeFetch(input, init);
      requests.push(url);
      if (url.endsWith('/api/v1/bridge/access_token')) return new Response(JSON.stringify({ api_access_token: 'test-token' }));
      if (url.endsWith('/api/v1/accounts/1/inboxes')) return new Response(JSON.stringify({ payload: [{ id: 10, channel_type: 'Channel::Api', inbox_identifier: 'legacy-waha', additional_attributes: { waha_session_name: 'hybrid-a1-i10', whatsapp_transports: ['waha'] } }] }));
      if (url.includes('/contacts/search?')) return new Response(JSON.stringify({ payload: [] }));
      if (url.includes('/public/api/v1/inboxes/legacy-waha/contacts') && method === 'POST') return new Response(JSON.stringify({ id: 20, source_id: 'whatsapp:5511999999999' }));
      if (url.endsWith('/api/v1/accounts/1/contacts/20') && method === 'PATCH') return new Response(JSON.stringify({}));
      if (url.endsWith('/api/v1/accounts/1/contacts/20/conversations')) return new Response(JSON.stringify({ payload: ++conversationReads === 1 ? [] : [{ id: 30, inbox_id: 10 }] }));
      if (url.includes('/conversations') && url.includes('/public/api/v1/') && method === 'POST') return new Response(JSON.stringify({}));
      if (url.endsWith('/api/v1/accounts/1/conversations/30/messages') && method === 'POST') return new Response(JSON.stringify({ id: 40 }));
      throw new Error(`Unexpected fetch ${method} ${url}`);
    }));
    try {
      await withApp(async base => {
        expect((await webhook(base, { event: 'message', session: 'hybrid-a1-i10', payload: { id: 'legacy-media-1', from: '5511999999999@c.us', chatId: '5511999999999@c.us', body: 'imagem', fromMe: false, hasMedia: true, media: { data: 'bWVkaWE=', mimetype: 'image/jpeg', filename: 'image.jpg' } } })).status).toBe(202);
        for (let attempt = 0; attempt < 30 && !requests.some(url => url.endsWith('/messages')); attempt += 1) await new Promise(resolve => setTimeout(resolve, 10));
      });
      expect(fakeWaha.downloadMedia).toHaveBeenCalled();
      expect(requests.some(url => url.endsWith('/internal/official_whatsapp/waha/inbound'))).toBe(false);
      expect(requests.some(url => url.endsWith('/messages'))).toBe(true);
    } finally { vi.unstubAllGlobals(); }
  });

  it('forwards official hybrid group inbound only to the official handler', async () => {
    const nativeFetch = globalThis.fetch;
    const requests: Array<{ url: string; body?: string }> = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith('http://127.0.0.1:')) return nativeFetch(input, init);
      requests.push({ url, body: typeof init?.body === 'string' ? init.body : undefined });
      if (url.endsWith('/api/v1/bridge/access_token')) return new Response(JSON.stringify({ api_access_token: 'test-token' }));
      if (url.endsWith('/api/v1/accounts/1/inboxes')) return new Response(JSON.stringify({ payload: [] }));
      if (url.endsWith('/internal/official_whatsapp/waha/inbound')) return new Response(JSON.stringify({ handled: true, message_id: 41 }));
      throw new Error(`Unexpected fetch ${url}`);
    }));
    try {
      await withApp(async base => {
        expect((await webhook(base, { event: 'message', session: 'hybrid-a1-i10', payload: { id: 'official-group-1', from: '120@g.us', chatId: '120@g.us', participant: '5511999999999@c.us', body: 'grupo', fromMe: false, subject: 'Equipe' } })).status).toBe(202);
        for (let attempt = 0; attempt < 30 && !requests.some(request => request.url.endsWith('/internal/official_whatsapp/waha/inbound')); attempt += 1) await new Promise(resolve => setTimeout(resolve, 10));
      });
      const official = requests.find(request => request.url.endsWith('/internal/official_whatsapp/waha/inbound'));
      expect(official?.body).toContain('120@g.us');
      expect(requests.some(request => request.url.endsWith('/messages'))).toBe(false);
    } finally { vi.unstubAllGlobals(); }
  });

  it('keeps a legacy WAHA reaction on the legacy handler', async () => {
    const nativeFetch = globalThis.fetch;
    const requests: Array<{ url: string; body?: string }> = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith('http://127.0.0.1:')) return nativeFetch(input, init);
      requests.push({ url, body: typeof init?.body === 'string' ? init.body : undefined });
      if (url.endsWith('/api/v1/bridge/access_token')) return new Response(JSON.stringify({ api_access_token: 'test-token' }));
      if (url.endsWith('/api/v1/accounts/1/inboxes')) return new Response(JSON.stringify({ payload: [{ id: 10, channel_type: 'Channel::Api', inbox_identifier: 'legacy-waha', additional_attributes: { waha_session_name: 'hybrid-a1-i10', whatsapp_transports: ['waha'] } }] }));
      if (url.endsWith('/api/v1/accounts/1/whatsapp/messages/reaction')) return new Response(JSON.stringify({ ok: true }));
      throw new Error(`Unexpected fetch ${url}`);
    }));
    try {
      await withApp(async base => {
        await signed(base, 'create', context());
        expect((await webhook(base, { event: 'message.reaction', session: 'hybrid-a1-i10', payload: { chatId: '120@g.us', msgId: 'legacy-target', participant: '5511@c.us', reaction: { text: '👍' } } })).status).toBe(202);
        for (let attempt = 0; attempt < 30 && !requests.some(request => request.url.endsWith('/whatsapp/messages/reaction')); attempt += 1) await new Promise(resolve => setTimeout(resolve, 10));
      });
      expect(requests.some(request => request.url.endsWith('/internal/official_whatsapp/waha/reaction'))).toBe(false);
      expect(requests.find(request => request.url.endsWith('/whatsapp/messages/reaction'))?.body).toContain('legacy-target');
    } finally { vi.unstubAllGlobals(); }
  });

  it('forwards an official Hybrid reaction through the signed internal Rails route', async () => {
    const nativeFetch = globalThis.fetch;
    const requests: Array<{ url: string; headers?: HeadersInit; body?: string }> = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith('http://127.0.0.1:')) return nativeFetch(input, init);
      requests.push({ url, headers: init?.headers, body: typeof init?.body === 'string' ? init.body : undefined });
      if (url.endsWith('/api/v1/bridge/access_token')) return new Response(JSON.stringify({ api_access_token: 'test-token' }));
      if (url.endsWith('/api/v1/accounts/1/inboxes')) return new Response(JSON.stringify({ payload: [] }));
      if (url.endsWith('/internal/official_whatsapp/waha/reaction')) return new Response(JSON.stringify({ handled: true, message_id: 77 }));
      throw new Error(`Unexpected fetch ${url}`);
    }));
    try {
      await withApp(async base => {
        await signed(base, 'create', context());
        expect((await webhook(base, { event: 'message.reaction', session: 'hybrid-a1-i10', payload: { chatId: '120@g.us', msgId: 'official-target', participant: '5511@c.us', reaction: { text: '❤️' } } })).status).toBe(202);
        for (let attempt = 0; attempt < 30 && !requests.some(request => request.url.endsWith('/internal/official_whatsapp/waha/reaction')); attempt += 1) await new Promise(resolve => setTimeout(resolve, 10));
      });
      const official = requests.find(request => request.url.endsWith('/internal/official_whatsapp/waha/reaction'));
      expect(official).toBeDefined();
      expect(new Headers(official?.headers).get('x-forwarded-proto')).toBe('https');
      expect(new Headers(official?.headers).get('x-forwarded-ssl')).toBe('on');
      expect(official?.body).toContain('official-target');
      expect(official?.body).toContain('120@g.us');
      expect(new Headers(official?.headers).get('x-hybrid-waha-signature')).toMatch(/^[-a-f0-9]{64}$/);
      expect(requests.some(request => request.url.endsWith('/whatsapp/messages/reaction'))).toBe(false);
    } finally { vi.unstubAllGlobals(); }
  });

  it('does not let a matching provider message ID in another session suppress Hybrid routing', async () => {
    const nativeFetch = globalThis.fetch;
    const officialRequests: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith('http://127.0.0.1:')) return nativeFetch(input, init);
      if (url.endsWith('/api/v1/bridge/access_token')) return new Response(JSON.stringify({ api_access_token: 'test-token' }));
      if (url.endsWith('/api/v1/accounts/1/inboxes')) return new Response(JSON.stringify({ payload: [] }));
      if (url.endsWith('/internal/official_whatsapp/waha/inbound')) { officialRequests.push(url); return new Response(JSON.stringify({ handled: true })); }
      throw new Error(`Unexpected fetch ${url}`);
    }));
    try {
      await withApp(async base => {
        await signed(base, 'create', context());
        await signed(base, 'create', context({ inbox_id: 11, channel_id: 101 }));
        const payload = { event: 'message', payload: { id: 'shared-provider-id', from: '5511999999999@c.us', chatId: '5511999999999@c.us', body: 'same provider id', fromMe: false, pushName: 'Cliente', profilePicUrl: 'https://avatar.test/client.jpg' } };
        expect((await webhook(base, { ...payload, session: 'hybrid-a1-i10' })).status).toBe(202);
        expect((await webhook(base, { ...payload, session: 'hybrid-a1-i11' })).status).toBe(202);
        for (let attempt = 0; attempt < 30 && officialRequests.length < 2; attempt += 1) await new Promise(resolve => setTimeout(resolve, 10));
      });
      expect(officialRequests).toHaveLength(2);
    } finally { vi.unstubAllGlobals(); }
  });
});
