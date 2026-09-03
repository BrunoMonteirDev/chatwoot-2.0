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
    BRIDGE_TEST_APP: '1', BRIDGE_WEBHOOK_SECRET: 'bridge-test-secret', CHATWOOT_BASE_URL: 'http://chatwoot.test',
    BRIDGE_ENCRYPTION_KEY: 'bridge-test-encryption-key', HYBRID_WAHA_BRIDGE_SECRET: secret,
    BRIDGE_DEDUP_FILE: join(directory, 'dedup.json'), BRIDGE_IDENTITY_FILE: join(directory, 'identity.json'),
    BRIDGE_META_CONFIG_FILE: join(directory, 'meta.json'), BRIDGE_META_HISTORY_FILE: join(directory, 'history.json'),
    BRIDGE_WAHA_HISTORY_FILE: join(directory, 'waha-history.json'), BRIDGE_WAHA_SESSION_OWNERSHIP_FILE: join(directory, 'ownership.json'),
  });
  ({ createBridgeApp } = await import('./index.js'));
  ({ WahaApiError } = await import('./waha.js'));
});
afterAll(async () => { await rm(directory, { recursive: true, force: true }); });

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
