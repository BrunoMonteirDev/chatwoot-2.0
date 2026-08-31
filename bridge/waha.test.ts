import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./config.js', () => ({
  config: { publicUrl: 'https://bridge.test', chatwootBaseUrl: 'http://chatwoot.test', maxMediaBytes: 1_000_000, wahaBaseUrl: 'http://waha.test', wahaApiKey: 'server-only-key', wahaWebhookSecret: 'webhook-secret', wahaDefaultEngine: 'GOWS', wahaRequestTimeoutMs: 20 },
}));

import { WahaApiError, wahaTransport } from './waha';
import { config } from './config';

describe('WAHA session transport', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses server-side X-Api-Key to list and normalize sessions', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([{ name: 'empresa', status: 'WORKING', engine: 'GOWS' }])));
    vi.stubGlobal('fetch', fetchMock);
    await expect(wahaTransport.listSessions()).resolves.toEqual([{ name: 'empresa', status: 'WORKING', connectionStatus: 'connected', engine: 'GOWS' }]);
    expect(fetchMock.mock.calls[0][0]).toBe('http://waha.test/api/sessions/');
    expect((fetchMock.mock.calls[0][1].headers as Record<string, string>)['X-Api-Key']).toBe('server-only-key');
  });

  it('creates a GOWS session with an authenticated bridge webhook contract', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ name: 'empresa', status: 'STOPPED' }))));
    await wahaTransport.createSession({ name: 'empresa' });
    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1].body as string));
    expect(body.config.engine).toBe('GOWS');
    expect(body.config.webhooks[0]).toMatchObject({ events: expect.arrayContaining(['session.status', 'message']), hmac: { key: 'webhook-secret' } });
  });

  it('rejects invalid WAHA responses and API errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('{}')).mockResolvedValueOnce(new Response(JSON.stringify({ message: 'missing' }), { status: 404 })));
    await expect(wahaTransport.getSession('missing')).rejects.toMatchObject({ kind: 'invalid_response' });
    await expect(wahaTransport.getSession('missing')).rejects.toMatchObject({ kind: 'api', status: 404 });
  });

  it('maps aborted requests to a timeout without leaking credentials', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url, init: RequestInit) => new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))))));
    await expect(wahaTransport.health()).rejects.toBeInstanceOf(WahaApiError);
    await expect(wahaTransport.health()).rejects.toMatchObject({ kind: 'timeout' });
  });

  it('fails closed when the bridge has no WAHA credentials', async () => {
    const original = config.wahaApiKey;
    config.wahaApiKey = '';
    await expect(wahaTransport.health()).rejects.toMatchObject({ kind: 'not_configured' });
    config.wahaApiKey = original;
  });

  it('normalizes the GOWS binary QR response as base64 for the authenticated bridge', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(Buffer.from('png'), { headers: { 'content-type': 'image/png' } })));
    await expect(wahaTransport.getQrCode('empresa')).resolves.toEqual({ mimetype: 'image/png', data: Buffer.from('png').toString('base64') });
  });

  it('resolves a LID to its phone number using the authenticated session API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ lid: '123@lid', pn: '5511999999999@c.us' })));
    vi.stubGlobal('fetch', fetchMock);
    await expect(wahaTransport.resolveLid('empresa', '123')).resolves.toBe('5511999999999');
    expect(fetchMock.mock.calls[0][0]).toBe('http://waha.test/api/empresa/lids/123');
  });

  it('uses the WAHA GOWS reaction endpoint and payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    await wahaTransport.sendReaction('empresa', '5511999999999@c.us', 'message-id', '👍');
    expect(fetchMock.mock.calls[0][0]).toBe('http://waha.test/api/reaction');
    expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe('PUT');
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({ session: 'empresa', chatId: '5511999999999@c.us', messageId: 'message-id', reaction: '👍' });
  });

  it('sends each attachment independently and only marks OGG/Opus as a voice note', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(Buffer.from('first-file')))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'first-id', to: '5511999999999@c.us' })))
      .mockResolvedValueOnce(new Response(Buffer.from('second-file')))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'second-id', to: '5511999999999@c.us' })))
      .mockResolvedValueOnce(new Response(Buffer.from('webm-file')))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'webm-id', to: '5511999999999@c.us' })));
    vi.stubGlobal('fetch', fetchMock);

    await wahaTransport.sendMedia('empresa', '5511999999999', { url: '/rails/a.ogg', fileType: 'audio', contentType: 'audio/ogg; codecs=opus', fileName: 'a.ogg' });
    await wahaTransport.sendMedia('empresa', '5511999999999', { url: '/rails/b.pdf', fileType: 'file', contentType: 'application/pdf', fileName: 'b.pdf' });
    await wahaTransport.sendMedia('empresa', '5511999999999', { url: '/rails/c.webm', fileType: 'audio', contentType: 'audio/webm', fileName: 'c.webm' });

    expect(fetchMock.mock.calls[1][0]).toBe('http://waha.test/api/sendVoice');
    expect(fetchMock.mock.calls[3][0]).toBe('http://waha.test/api/sendFile');
    expect(fetchMock.mock.calls[5][0]).toBe('http://waha.test/api/sendFile');
  });

  it('lists GOWS history with all chats, bounded pagination and media disabled', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([{ id: '3EB0', timestamp: 1727745026 }])));
    vi.stubGlobal('fetch', fetchMock);
    await expect(wahaTransport.listHistoryMessages('empresa', { limit: 100, offset: 200, timestampGte: 1727000000 })).resolves.toHaveLength(1);
    expect(fetchMock.mock.calls[0][0]).toBe('http://waha.test/api/empresa/chats/all/messages?limit=100&offset=200&downloadMedia=false&filter.timestamp.gte=1727000000');
  });

  it('reads chat names and obtains only WAHA-issued WhatsApp profile URLs', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: '5511999999999@c.us', name: 'Ana' }])))
      .mockResolvedValueOnce(new Response(JSON.stringify({ url: 'https://pps.whatsapp.net/avatar.jpg?signature=server-issued' })));
    vi.stubGlobal('fetch', fetchMock);
    await expect(wahaTransport.listChats('empresa')).resolves.toEqual([{ id: '5511999999999@c.us', name: 'Ana' }]);
    await expect(wahaTransport.getChatAvatarUrl('empresa', '5511999999999@c.us')).resolves.toContain('pps.whatsapp.net');
    expect(fetchMock.mock.calls[0][0]).toBe('http://waha.test/api/empresa/chats?limit=500');
    expect(fetchMock.mock.calls[1][0]).toBe('http://waha.test/api/empresa/chats/5511999999999%40c.us/picture');
  });

  it('fetches a single GOWS history record with media only on demand', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: '3EB0', media: { data: 'YQ==' } })));
    vi.stubGlobal('fetch', fetchMock);
    await wahaTransport.getHistoryMessage('empresa', '3EB0');
    expect(fetchMock.mock.calls[0][0]).toBe('http://waha.test/api/empresa/chats/all/messages/3EB0?downloadMedia=true');
  });

  it('translates only the localhost file URL emitted by GOWS to the configured WAHA origin', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(Buffer.from('audio')));
    vi.stubGlobal('fetch', fetchMock);
    await expect(wahaTransport.downloadMedia({ kind: 'audio', url: 'http://localhost:3000/api/files/empresa/audio.oga', mimetype: 'audio/ogg' }))
      .resolves.toMatchObject({ contentType: 'audio/ogg', fileName: 'audio.ogg' });
    expect(String(fetchMock.mock.calls[0][0])).toBe('http://waha.test/api/files/empresa/audio.oga');
  });
});
