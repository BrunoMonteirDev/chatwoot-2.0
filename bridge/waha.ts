import { config } from './config.js';
import type { OutgoingAttachment } from './chatwootEvent.js';
import { chatwootAssetUrl } from './evolution.js';

export type WahaRawSessionStatus = 'STOPPED' | 'STARTING' | 'SCAN_QR_CODE' | 'WORKING' | 'FAILED' | 'PASSKEY_REQUIRED' | 'PASSKEY_CONFIRMATION_REQUIRED' | string;
export type WahaConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';
export interface WahaSession {
  name: string;
  linked?: boolean;
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
export interface WhatsAppGroupMetadata { id: string; subject?: string; avatarUrl?: string; description?: string; participants: Array<{ jid: string; lid?: string; phoneJid?: string; name?: string; phoneNumber?: string; avatarUrl?: string; admin?: string | null }>; }
export interface CreatedWahaGroup { id: string; inviteLink?: string; }

export class WahaApiError extends Error {
  constructor(readonly kind: 'not_configured' | 'timeout' | 'network' | 'invalid_response' | 'api', readonly status?: number, details?: string) {
    super(kind === 'not_configured' ? 'WAHA is not configured on this bridge.' : `WAHA ${status || ''} ${details || kind}`.trim());
  }
}

export class WahaGroupInviteError extends Error {
  constructor(readonly code: 'invite_code_fetch_failed' | 'invite_code_invalid', readonly cause?: unknown) {
    super(code);
  }
}

const requireWaha = () => {
  if (!config.wahaBaseUrl || !config.wahaApiKey) throw new WahaApiError('not_configured');
  return { baseUrl: config.wahaBaseUrl, apiKey: config.wahaApiKey };
};

const record = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' ? value as Record<string, unknown> : null;
const jidFrom = (value: unknown): string => {
  if (typeof value === 'string' && /^\d+@g\.us$/i.test(value)) return value;
  const item = record(value);
  if (!item) return '';
  const user = typeof item.user === 'string' ? item.user : typeof item.User === 'string' ? item.User : '';
  const server = typeof item.server === 'string' ? item.server : typeof item.Server === 'string' ? item.Server : '';
  if (/^\d+$/.test(user) && server.toLowerCase() === 'g.us') return `${user}@g.us`;
  return '';
};
export const wahaCreatedGroupId = (raw: unknown): string => {
  const payload = record(raw);
  const group = record(payload?.group || payload?.Group || payload?.data || payload?.payload);
  const candidates = [raw, payload?.id, payload?.ID, payload?.jid, payload?.JID, payload?.gid, payload?.GID,
    group, group?.id, group?.ID, group?.jid, group?.JID, group?.gid, group?.GID];
  return candidates.map(jidFrom).find(Boolean) || '';
};
const safeResponseShape = (body: unknown) => {
  if (Array.isArray(body)) return { type: 'array', length: body.length };
  const value = record(body);
  return value ? { type: 'object', keys: Object.keys(value).slice(0, 20) } : { type: typeof body };
};
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

type WahaRequestContext = { sessionName: string; groupJid: string; operation: 'invite_code' };
const request = async (path: string, init: RequestInit = {}, context?: WahaRequestContext): Promise<unknown> => {
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
    let validJson = true;
    try { body = text ? JSON.parse(text) : null; } catch { validJson = false; }
    if (path.includes('/groups')) console.info('[waha] group provider response', { path: path.replace(/\/api\/[^/]+\//, '/api/:session/'), ...(context || {}), status: response.status, body: validJson ? safeResponseShape(body) : { type: 'invalid_json' } });
    if (!validJson && response.ok) throw new WahaApiError('invalid_response');
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
const groupMetadata = (payload: unknown, fallbackId: string): WhatsAppGroupMetadata => {
  const root = record(payload); const group = record(root?.group) || root || {};
  const rawParticipants = Array.isArray(group.participants) ? group.participants : Array.isArray(group.Participants) ? group.Participants : [];
  const participants = rawParticipants.flatMap((item): WhatsAppGroupMetadata['participants'] => {
    const member = record(item); const ids = [member?.id, member?.jid, member?.JID, member?.lid, member?.LID, member?.pn, member?.PN, member?.phoneNumber, member?.PhoneNumber].filter((value): value is string => typeof value === 'string' && value.length > 0);
    const lidJid = ids.find(value => value.endsWith('@lid'));
    const phoneJid = ids.find(value => /@(c\.us|s\.whatsapp\.net)$/.test(value));
    const jid = ids[0] || '';
    if (!jid) return [];
    const phoneNumber = phoneFromJid(phoneJid) || [member.phoneNumber, member.PhoneNumber, member.pn, member.PN].find((value): value is string => typeof value === 'string')?.replace(/\D/g, '');
    return [{ jid, ...(lidJid ? { lid: lidJid } : {}), ...(phoneJid ? { phoneJid } : {}), ...(typeof member.name === 'string' ? { name: member.name } : typeof member.pushName === 'string' ? { name: member.pushName } : typeof member.DisplayName === 'string' ? { name: member.DisplayName } : {}), ...(phoneNumber ? { phoneNumber } : {}), ...(typeof member.admin === 'string' ? { admin: member.admin } : member.admin === null ? { admin: null } : member.IsSuperAdmin === true ? { admin: 'superadmin' } : member.isAdmin === true || member.IsAdmin === true ? { admin: 'admin' } : {}) }];
  });
  return { id: typeof group.id === 'string' ? group.id : typeof group.JID === 'string' ? group.JID : fallbackId, ...(typeof group.subject === 'string' ? { subject: group.subject } : typeof group.name === 'string' ? { subject: group.name } : typeof group.Name === 'string' ? { subject: group.Name } : {}), ...(typeof group.description === 'string' ? { description: group.description } : typeof group.Topic === 'string' ? { description: group.Topic } : {}), participants };
};
export const normalizeWahaChatId = (value: string) => {
  if (value.endsWith('@g.us') || value.endsWith('@lid') || value.endsWith('@newsletter') || value === 'status@broadcast') return value;
  const digits = value.replace(/@s\.whatsapp\.net$|@c\.us$/i, '').replace(/\D/g, '');
  if (!/^\d{8,15}$/.test(digits)) throw new Error('Destino WAHA inválido.');
  return `${digits}@c.us`;
};
export const canonicalWhatsAppGroupInviteLink = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  const candidate = value.trim();
  if (!candidate) return '';
  if (/^https?:\/\//i.test(candidate)) {
    try {
      const url = new URL(candidate);
      if (url.hostname.toLowerCase() !== 'chat.whatsapp.com') return '';
      const code = url.pathname.split('/').filter(Boolean)[0] || '';
      return /^[a-z0-9_-]+$/i.test(code) ? `https://chat.whatsapp.com/${code}` : '';
    } catch { return ''; }
  }
  return /^[a-z0-9_-]+$/i.test(candidate) ? `https://chat.whatsapp.com/${candidate}` : '';
};
export const wahaGroupInviteLinkFromResponse = (raw: unknown): string => {
  const payload = record(raw);
  return canonicalWhatsAppGroupInviteLink(typeof raw === 'string' ? raw : payload?.code);
};
const sent = (payload: unknown): SentWahaMessage => {
  const root = record(payload); const data = record(root?.id ? root : root?.message || root?.payload);
  const messageId = typeof data?.id === 'string' ? data.id : '';
  const chatId = typeof data?.from === 'string' ? data.from : typeof data?.to === 'string' ? data.to : '';
  if (!messageId) throw new WahaApiError('invalid_response');
  return { messageId, chatId, fromMe: data?.fromMe !== false };
};
const filenameFromDisposition = (value: string | null) => {
  const match = value?.match(/filename\*?=(?:UTF-8''|"?)([^";]+)/i);
  if (!match?.[1]) return undefined;
  try { return decodeURIComponent(match[1].trim()); } catch { return match[1].trim(); }
};
const filenameFor = (attachment: OutgoingAttachment, contentType: string, disposition: string | null) => {
  if (attachment.fileName?.trim()) return attachment.fileName.trim();
  const fromHeader = filenameFromDisposition(disposition);
  if (fromHeader) return fromHeader;
  const extension = contentType.includes('ogg') ? 'ogg' : contentType.includes('mp4') ? 'm4a' : contentType.includes('webm') ? 'webm' : 'bin';
  return `audio.${extension}`;
};
const fileData = async (attachment: OutgoingAttachment) => {
  const assetUrl = chatwootAssetUrl(attachment.url);
  const base = new URL(config.chatwootBaseUrl);
  if (assetUrl.protocol !== 'https:' && assetUrl.origin !== base.origin) throw new Error('URL de anexo não permitida.');
  const response = await fetch(assetUrl, { signal: AbortSignal.timeout(config.wahaRequestTimeoutMs) });
  if (!response.ok) throw new Error(`Não foi possível baixar o anexo do Chatwoot (${response.status}).`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > config.maxMediaBytes) throw new Error('O anexo do Chatwoot excede o tamanho permitido.');
  const mimetype = attachment.contentType || response.headers.get('content-type')?.split(';')[0] || 'application/octet-stream';
  return { data: buffer.toString('base64'), mimetype, filename: filenameFor(attachment, mimetype, response.headers.get('content-disposition')) };
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
  async getGroupMetadata(session: string, groupId: string) {
    const path = `/api/${namePath(session)}/groups/${encodeURIComponent(groupId)}`;
    const raw = await request(path);
    const metadata = groupMetadata(raw, groupId);
    if (metadata.participants.length) return metadata;
    // GOWS exposes group info and participants through separate endpoints.
    // Older engines include participants in the group payload, so keep that
    // fast path and use the dedicated endpoint only when they are absent.
    const participants = await request(`${path}/participants`);
    return groupMetadata({ ...record(raw), Participants: Array.isArray(participants) ? participants : [] }, groupId);
  },
  async createGroup(session: string, name: string, participants: string[] = []): Promise<CreatedWahaGroup> {
    const raw = await request(`/api/${namePath(session)}/groups`, { method: 'POST', body: JSON.stringify({ name, participants: participants.map(id => ({ id: normalizeWahaChatId(id) })) }) });
    const id = wahaCreatedGroupId(raw);
    if (!id) throw new WahaApiError('invalid_response');
    return { id };
  },
  async getGroupInviteLink(session: string, groupId: string): Promise<string> {
    let raw: unknown;
    try {
      raw = await request(`/api/${namePath(session)}/groups/${encodeURIComponent(groupId)}/invite-code`, {}, { sessionName: session, groupJid: groupId, operation: 'invite_code' });
    } catch (error) {
      throw new WahaGroupInviteError(error instanceof WahaApiError && error.kind === 'invalid_response' ? 'invite_code_invalid' : 'invite_code_fetch_failed', error);
    }
    const link = wahaGroupInviteLinkFromResponse(raw);
    if (!link) throw new WahaGroupInviteError('invite_code_invalid');
    return link;
  },
  async updateGroupDescription(session: string, groupId: string, description: string) {
    return groupMetadata(await request(`/api/${namePath(session)}/groups/${encodeURIComponent(groupId)}/description`, { method: 'PUT', body: JSON.stringify({ description }) }), groupId);
  },
  async addGroupParticipant(session: string, groupId: string, participant: string) {
    await request(`/api/${namePath(session)}/groups/${encodeURIComponent(groupId)}/participants/add`, { method: 'POST', body: JSON.stringify({ participants: [{ id: normalizeWahaChatId(participant) }] }) });
    return this.getGroupMetadata(session, groupId);
  },
  async leaveGroup(session: string, groupId: string) {
    await request(`/api/${namePath(session)}/groups/${encodeURIComponent(groupId)}/leave`, { method: 'POST' });
  },
  async sendText(session: string, chatId: string, text: string, replyTo?: string, mentions?: string[]) {
    return sent(await request('/api/sendText', { method: 'POST', body: JSON.stringify({ session, chatId: normalizeWahaChatId(chatId), text, ...(replyTo ? { reply_to: replyTo } : {}), ...(mentions?.length ? { mentions } : {}) }) }));
  },
  async sendMedia(session: string, chatId: string, attachment: OutgoingAttachment, caption = '', replyTo?: string) {
    const file = await fileData(attachment);
    // WhatsApp voice notes are OGG/Opus. WAHA/GOWS can accept browser-recorded
    // WebM and MP4 on sendVoice, but those payloads are not reliably delivered
    // as playable voice notes by WhatsApp clients. Convert only non-Opus input;
    // OGG/Opus is already in the target format and keeps its original bytes.
    const voiceNote = attachment.fileType === 'audio';
    const kind = attachment.fileType === 'image' ? 'sendImage' : voiceNote ? 'sendVoice' : attachment.fileType === 'video' ? 'sendVideo' : 'sendFile';
    const opus = /^audio\/ogg(?:\s*;\s*codecs?=opus)?$/i.test(file.mimetype);
    return sent(await request(`/api/${kind}`, { method: 'POST', body: JSON.stringify({ session, chatId: normalizeWahaChatId(chatId), file, ...(voiceNote && !opus ? { convert: true } : {}), ...(caption ? { caption } : {}), ...(replyTo ? { reply_to: replyTo } : {}) }) }));
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
