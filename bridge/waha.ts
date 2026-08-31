import { config } from './config.js';
import type { OutgoingAttachment } from './chatwootEvent.js';
import { chatwootAssetUrl } from './evolution.js';

export type WahaRawSessionStatus = 'STOPPED' | 'STARTING' | 'SCAN_QR_CODE' | 'WORKING' | 'FAILED' | 'PASSKEY_REQUIRED' | 'PASSKEY_CONFIRMATION_REQUIRED' | string;
export type WahaConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';
export interface WahaSession {
  name: string;
  status: WahaRawSessionStatus;
  connectionStatus: WahaConnectionStatus;
  engine?: string;
  me?: { id?: string; pushName?: string };
}
export interface WahaQrCode { mimetype: string; data: string; }
export interface SentWahaMessage { messageId: string; chatId: string; fromMe: boolean; }
export interface DownloadedWahaMedia { buffer: Buffer; contentType: string; fileName: string; }
export interface WahaHistoryQuery { limit: number; offset: number; timestampGte?: number; timestampLte?: number; }
export interface WahaChatProfile { id: string; name?: string; }

export class WahaApiError extends Error {
  constructor(readonly kind: 'not_configured' | 'timeout' | 'network' | 'invalid_response' | 'api', readonly status?: number, details?: string) {
    super(kind === 'not_configured' ? 'WAHA is not configured on this bridge.' : `WAHA ${status || ''} ${details || kind}`.trim());
  }
}

const requireWaha = () => {
  if (!config.wahaBaseUrl || !config.wahaApiKey) throw new WahaApiError('not_configured');
  return { baseUrl: config.wahaBaseUrl, apiKey: config.wahaApiKey };
};

const record = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' ? value as Record<string, unknown> : null;
const statusFor = (value: string): WahaConnectionStatus => {
  if (value === 'WORKING') return 'connected';
  if (value === 'FAILED') return 'error';
  if (value === 'STOPPED') return 'disconnected';
  return 'connecting';
};

const normalizeSession = (payload: unknown): WahaSession => {
  const root = record(payload);
  const name = typeof root?.name === 'string' ? root.name : typeof root?.session === 'string' ? root.session : '';
  const status = typeof root?.status === 'string' ? root.status : '';
  if (!name || !status) throw new WahaApiError('invalid_response');
  const me = record(root.me);
  return {
    name,
    status,
    connectionStatus: statusFor(status),
    ...(typeof root.engine === 'string' ? { engine: root.engine } : {}),
    ...(me ? { me: { ...(typeof me.id === 'string' ? { id: me.id } : {}), ...(typeof me.pushName === 'string' ? { pushName: me.pushName } : {}) } } : {}),
  };
};

const request = async (path: string, init: RequestInit = {}): Promise<unknown> => {
  const { baseUrl, apiKey } = requireWaha();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.wahaRequestTimeoutMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { Accept: 'application/json', 'X-Api-Key': apiKey, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
    });
    const text = await response.text();
    let body: unknown = null;
    try { body = text ? JSON.parse(text) : null; } catch { if (response.ok) throw new WahaApiError('invalid_response'); }
    if (!response.ok) {
      const root = record(body);
      const detail = typeof root?.message === 'string' ? root.message.slice(0, 240) : response.statusText;
      throw new WahaApiError('api', response.status, detail);
    }
    return body;
  } catch (error) {
    if (error instanceof WahaApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') throw new WahaApiError('timeout');
    throw new WahaApiError('network');
  } finally { clearTimeout(timeout); }
};

const binaryRequest = async (path: string): Promise<{ contentType: string; buffer: Buffer }> => {
  const { baseUrl, apiKey } = requireWaha();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.wahaRequestTimeoutMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, { signal: controller.signal, headers: { Accept: 'image/png, application/json', 'X-Api-Key': apiKey } });
    if (!response.ok) throw new WahaApiError('api', response.status, response.statusText);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) throw new WahaApiError('invalid_response');
    return { contentType: response.headers.get('content-type')?.split(';')[0] || 'image/png', buffer };
  } catch (error) {
    if (error instanceof WahaApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') throw new WahaApiError('timeout');
    throw new WahaApiError('network');
  } finally { clearTimeout(timeout); }
};

const namePath = (name: string) => encodeURIComponent(name);
const phoneFromJid = (value: unknown) => typeof value === 'string' ? value.match(/^(\d{8,15})@(c\.us|s\.whatsapp\.net)$/)?.[1] : undefined;
export const normalizeWahaChatId = (value: string) => {
  if (value.endsWith('@g.us') || value.endsWith('@lid') || value.endsWith('@newsletter') || value === 'status@broadcast') return value;
  const digits = value.replace(/@s\.whatsapp\.net$|@c\.us$/i, '').replace(/\D/g, '');
  if (!/^\d{8,15}$/.test(digits)) throw new Error('Destino WAHA inválido.');
  return `${digits}@c.us`;
};
const sent = (payload: unknown): SentWahaMessage => {
  const root = record(payload); const data = record(root?.id ? root : root?.message || root?.payload);
  const messageId = typeof data?.id === 'string' ? data.id : '';
  const chatId = typeof data?.from === 'string' ? data.from : typeof data?.to === 'string' ? data.to : '';
  if (!messageId) throw new WahaApiError('invalid_response');
  return { messageId, chatId, fromMe: data?.fromMe !== false };
};
const fileData = async (attachment: OutgoingAttachment) => {
  const assetUrl = chatwootAssetUrl(attachment.url);
  const base = new URL(config.chatwootBaseUrl);
  if (assetUrl.protocol !== 'https:' && assetUrl.origin !== base.origin) throw new Error('URL de anexo não permitida.');
  const response = await fetch(assetUrl, { signal: AbortSignal.timeout(config.wahaRequestTimeoutMs) });
  if (!response.ok) throw new Error(`Não foi possível baixar o anexo do Chatwoot (${response.status}).`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > config.maxMediaBytes) throw new Error('O anexo do Chatwoot excede o tamanho permitido.');
  return { data: buffer.toString('base64'), mimetype: attachment.contentType || 'application/octet-stream', ...(attachment.fileName ? { filename: attachment.fileName } : {}) };
};

export const wahaTransport = {
  health: () => request('/health'),
  async listSessions() {
    const payload = await request('/api/sessions/');
    if (!Array.isArray(payload)) throw new WahaApiError('invalid_response');
    return payload.map(normalizeSession);
  },
  async getSession(name) { return normalizeSession(await request(`/api/sessions/${namePath(name)}`)); },
  async createSession({ name, engine }: { name: string; engine?: string }) {
    const webhookBaseUrl = config.internalUrl || config.publicUrl;
    const webhook = webhookBaseUrl && config.wahaWebhookSecret ? {
      webhooks: [{
        url: `${webhookBaseUrl}/webhooks/waha`,
        events: ['session.status', 'message', 'message.any', 'message.reaction', 'message.ack', 'message.ack.group', 'message.edited', 'message.revoked', 'group.v2.join', 'group.v2.leave', 'group.v2.participants', 'group.v2.update'],
        hmac: { key: config.wahaWebhookSecret },
        retries: { policy: 'exponential', delaySeconds: 2, attempts: 4 },
      }],
    } : {};
    return normalizeSession(await request('/api/sessions', { method: 'POST', body: JSON.stringify({ name, config: { engine: engine || config.wahaDefaultEngine, ...webhook } }) }));
  },
  async startSession(name) { return normalizeSession(await request(`/api/sessions/${namePath(name)}/start`, { method: 'POST' })); },
  async restartSession(name) { return normalizeSession(await request(`/api/sessions/${namePath(name)}/restart`, { method: 'POST' })); },
  async logoutSession(name) {
    await request(`/api/sessions/logout`, { method: 'POST', body: JSON.stringify({ name }) });
    return null;
  },
  async deleteSession(name) {
    await request(`/api/sessions/${namePath(name)}`, { method: 'DELETE' });
    return null;
  },
  async getQrCode(name) {
    const response = await binaryRequest(`/api/${namePath(name)}/auth/qr`);
    // WAHA GOWS returns PNG bytes while older engines return JSON/base64.
    // The binary endpoint is authoritative for the current pinned release.
    return { mimetype: response.contentType, data: response.buffer.toString('base64') };
  },
  async resolveLid(session: string, lid: string) {
    const payload = record(await request(`/api/${namePath(session)}/lids/${encodeURIComponent(lid.replace(/@lid$/i, ''))}`));
    return phoneFromJid(payload?.pn);
  },
  async sendText(session: string, chatId: string, text: string, replyTo?: string) {
    return sent(await request('/api/sendText', { method: 'POST', body: JSON.stringify({ session, chatId: normalizeWahaChatId(chatId), text, ...(replyTo ? { reply_to: replyTo } : {}) }) }));
  },
  async sendMedia(session: string, chatId: string, attachment: OutgoingAttachment, caption = '', replyTo?: string) {
    const file = await fileData(attachment);
    // WAHA's voice endpoint expects an OGG/Opus WhatsApp voice note. Browser
    // recordings can be WebM, which must be sent as a regular file instead of
    // being mislabeled as a voice note and rejected by WhatsApp clients.
    const voiceNote = attachment.fileType === 'audio' && /^audio\/ogg(?:\s*;\s*codecs?=opus)?$/i.test(file.mimetype);
    const kind = attachment.fileType === 'image' ? 'sendImage' : voiceNote ? 'sendVoice' : attachment.fileType === 'video' ? 'sendVideo' : 'sendFile';
    return sent(await request(`/api/${kind}`, { method: 'POST', body: JSON.stringify({ session, chatId: normalizeWahaChatId(chatId), file, ...(caption ? { caption } : {}), ...(replyTo ? { reply_to: replyTo } : {}) }) }));
  },
  async sendReaction(session: string, chatId: string, messageId: string, emoji: string) {
    await request('/api/reaction', { method: 'PUT', body: JSON.stringify({ session, chatId: normalizeWahaChatId(chatId), messageId, reaction: emoji }) });
  },
  async editMessage(session: string, chatId: string, messageId: string, text: string) {
    await request(`/api/${namePath(session)}/chats/${encodeURIComponent(normalizeWahaChatId(chatId))}/messages/${encodeURIComponent(messageId)}`, { method: 'PUT', body: JSON.stringify({ text }) });
  },
  async revokeMessage(session: string, chatId: string, messageId: string) {
    await request(`/api/${namePath(session)}/chats/${encodeURIComponent(normalizeWahaChatId(chatId))}/messages/${encodeURIComponent(messageId)}`, { method: 'DELETE' });
  },
  async listHistoryMessages(session: string, query: WahaHistoryQuery): Promise<unknown[]> {
    const parameters = new URLSearchParams({
      limit: String(query.limit), offset: String(query.offset), downloadMedia: 'false',
      ...(query.timestampGte ? { 'filter.timestamp.gte': String(query.timestampGte) } : {}),
      ...(query.timestampLte ? { 'filter.timestamp.lte': String(query.timestampLte) } : {}),
    });
    const payload = await request(`/api/${namePath(session)}/chats/all/messages?${parameters}`);
    if (!Array.isArray(payload)) throw new WahaApiError('invalid_response');
    return payload;
  },
  async listChats(session: string, query: { limit: number; offset?: number } = { limit: 500 }): Promise<WahaChatProfile[]> {
    const parameters = new URLSearchParams({ limit: String(query.limit), ...(query.offset ? { offset: String(query.offset) } : {}) });
    const payload = await request(`/api/${namePath(session)}/chats?${parameters}`);
    if (!Array.isArray(payload)) throw new WahaApiError('invalid_response');
    return payload.flatMap((item): WahaChatProfile[] => {
      const chat = record(item);
      const id = typeof chat?.id === 'string' ? chat.id : undefined;
      if (!id) return [];
      const name = typeof chat.name === 'string' && chat.name.trim() ? chat.name.trim() : undefined;
      return [{ id, ...(name ? { name } : {}) }];
    });
  },
  async getChatAvatarUrl(session: string, chatId: string): Promise<string | undefined> {
    const payload = record(await request(`/api/${namePath(session)}/chats/${encodeURIComponent(chatId)}/picture`));
    const url = typeof payload?.url === 'string' ? payload.url : undefined;
    if (!url) return undefined;
    try {
      const parsed = new URL(url);
      // WAHA returns the signed WhatsApp profile picture URL. Never turn this
      // method into an arbitrary remote URL relay.
      return parsed.protocol === 'https:' && (parsed.hostname === 'pps.whatsapp.net' || parsed.hostname.endsWith('.whatsapp.net')) ? parsed.toString() : undefined;
    } catch { return undefined; }
  },
  async getHistoryMessage(session: string, messageId: string): Promise<unknown> {
    // GOWS explicitly supports an unqualified message id together with
    // `chats/all`; media is intentionally fetched one item at a time.
    return request(`/api/${namePath(session)}/chats/all/messages/${encodeURIComponent(messageId)}?downloadMedia=true`);
  },
  async downloadMedia(media: { url?: string; data?: string; mimetype?: string; filename?: string; kind: string }): Promise<DownloadedWahaMedia> {
    let buffer: Buffer;
    if (media.data) buffer = Buffer.from(media.data.replace(/^data:[^;]+;base64,/i, ''), 'base64');
    else if (media.url) {
      const { baseUrl, apiKey } = requireWaha(); let url = new URL(media.url, baseUrl); const allowed = new URL(baseUrl);
      // GOWS reports its own cached files as localhost even when WAHA is
      // reached through Docker/host networking. Translate only that documented
      // internal `/api/files` URL to the configured WAHA origin; all other
      // foreign URLs remain blocked by the SSRF guard.
      const isWahaLoopbackFile = ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
        && url.pathname.startsWith('/api/files/');
      if (isWahaLoopbackFile) url = new URL(`${url.pathname}${url.search}`, allowed);
      if (url.origin !== allowed.origin) throw new Error('URL de mídia WAHA não permitida.');
      const response = await fetch(url, { headers: { 'X-Api-Key': apiKey }, signal: AbortSignal.timeout(config.wahaRequestTimeoutMs) });
      if (!response.ok) throw new Error(`WAHA não disponibilizou a mídia (${response.status}).`); buffer = Buffer.from(await response.arrayBuffer());
    } else throw new Error('Evento WAHA sem mídia recuperável.');
    if (!buffer.length || buffer.length > config.maxMediaBytes) throw new Error('A mídia WAHA excede o tamanho permitido.');
    const contentType = media.mimetype || 'application/octet-stream'; const extension = contentType.includes('image') ? 'jpg' : contentType.includes('audio') ? 'ogg' : contentType.includes('video') ? 'mp4' : 'bin';
    return { buffer, contentType, fileName: media.filename || `${media.kind}.${extension}` };
  },
};
