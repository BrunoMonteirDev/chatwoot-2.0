import { config } from './config.js';
import type { OutgoingAttachment } from './chatwootEvent.js';
import type { IncomingEvolutionMedia } from './evolutionEvent.js';

export const normalizeEvolutionDestination = (number: string) => {
  if (number.endsWith('@g.us')) return number;
  const digits = number.replace(/\D/g, '');
  // Brazilian mobile numbers gained a ninth digit. Contacts imported or typed
  // with the old 8-digit local format otherwise remain accepted by the API,
  // but are never delivered by WhatsApp.
  if (/^55\d{2}[6-9]\d{7}$/.test(digits)) return `${digits.slice(0, 4)}9${digits.slice(4)}`;
  return digits;
};

export const chatwootAssetUrl = (url: string) => {
  const apiUrl = new URL(config.chatwootBaseUrl);
  const assetUrl = new URL(url, apiUrl);
  // Chatwoot generates ActiveStorage links using FRONTEND_URL. In local
  // development that is Vite (:3000), but files are served by Rails (:3003).
  if (assetUrl.hostname === apiUrl.hostname && assetUrl.pathname.startsWith('/rails/active_storage/')) {
    assetUrl.protocol = apiUrl.protocol;
    assetUrl.host = apiUrl.host;
  }
  return assetUrl;
};

export interface DownloadedEvolutionMedia {
  buffer: Buffer;
  contentType: string;
  fileName: string;
}

export interface EvolutionReactionTarget {
  remoteJid: string;
  messageId: string;
  fromMe: boolean;
  participant?: string;
  emoji: string;
}

export interface EvolutionMutationTarget {
  remoteJid: string;
  messageId: string;
  fromMe: boolean;
  participant?: string;
}
export interface EvolutionQuotedMessage { messageId: string; remoteJid?: string; fromMe?: boolean; participant?: string; }

export interface SentEvolutionMessage {
  messageId: string;
  remoteJid: string;
  fromMe: boolean;
}
export interface EvolutionGroupMetadata { id: string; subject?: string; description?: string; participants: Array<{ jid: string; name?: string; phoneNumber?: string; admin?: string | null }>; }

// Evolution v2.3 validates one Unicode code point, whereas WhatsApp's red
// heart from the browser is normally `U+2764 U+FE0F`. Strip presentation and
// skin-tone modifiers only for this transport so the same visual reaction is
// accepted by the provider. An empty string remains the WhatsApp operation
// for removing a reaction.
export const normalizeEvolutionReactionEmoji = (emoji: string) => emoji
  .normalize('NFC')
  .replace(/[\uFE0E\uFE0F\u{1F3FB}-\u{1F3FF}]/gu, '');

const sentMessageFromResponse = async (response: Response): Promise<SentEvolutionMessage | null> => {
  const payload: unknown = await response.json().catch(() => null);
  if (!payload || typeof payload !== 'object') return null;
  const key = (payload as Record<string, unknown>).key;
  if (!key || typeof key !== 'object') return null;
  const messageKey = key as Record<string, unknown>;
  return typeof messageKey.id === 'string' && typeof messageKey.remoteJid === 'string'
    ? { messageId: messageKey.id, remoteJid: messageKey.remoteJid, fromMe: messageKey.fromMe === true }
    : null;
};

const extensionFor = (contentType: string, kind: IncomingEvolutionMedia['kind']) => {
  const known: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
    'audio/ogg': 'ogg', 'audio/ogg; codecs=opus': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/webm': 'webm',
    'video/mp4': 'mp4', 'video/webm': 'webm', 'application/pdf': 'pdf',
  };
  return known[contentType.toLowerCase()] || (kind === 'image' ? 'jpg' : kind === 'audio' ? 'ogg' : kind === 'video' ? 'mp4' : 'bin');
};

const contentTypeFor = (media: IncomingEvolutionMedia) => media.mimetype || (
  media.kind === 'image' ? 'image/jpeg' : media.kind === 'audio' ? 'audio/ogg' : media.kind === 'video' ? 'video/mp4' : 'application/octet-stream'
);

const base64Buffer = (value: string) => {
  const raw = value.replace(/^data:[^;]+;base64,/i, '').replace(/\s/g, '');
  if (!raw || !/^[a-z0-9+/]+={0,2}$/i.test(raw) || raw.length % 4 === 1) throw new Error('A Evolution retornou mídia Base64 inválida.');
  const buffer = Buffer.from(raw, 'base64');
  if (buffer.length > config.maxMediaBytes) throw new Error('A mídia retornada pela Evolution excede o tamanho permitido.');
  return buffer;
};

const base64FromResponse = (payload: unknown): string | null => {
  if (typeof payload === 'string') return payload;
  if (!payload || typeof payload !== 'object') return null;
  const root = payload as Record<string, unknown>;
  const nested = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : {};
  return typeof root.base64 === 'string' ? root.base64 : typeof root.data === 'string' ? root.data : typeof nested.base64 === 'string' ? nested.base64 : null;
};

const evolutionRequest = (path: string, init: RequestInit = {}) => fetch(`${config.evolutionBaseUrl}${path}`, {
  ...init,
  headers: { apikey: config.evolutionApiKey, Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
});

class EvolutionManagementError extends Error {
  constructor(readonly status: number, readonly details: string) {
    super(`Evolution ${status}: ${details || 'operação de instância recusada.'}`);
  }
}

const managementResponse = async (path: string, init: RequestInit = {}) => {
  const response = await evolutionRequest(path, init);
  if (!response.ok) {
    // The Evolution API returns a useful, non-sensitive validation message for
    // instance management. Keep it short so neither headers nor large payloads
    // can accidentally reach logs or the browser.
    const payload: unknown = await response.json().catch(() => null);
    const root = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
    const nested = root.response && typeof root.response === 'object' ? root.response as Record<string, unknown> : {};
    const message = Array.isArray(nested.message) ? nested.message.find((entry): entry is string => typeof entry === 'string')
      : typeof root.message === 'string' ? root.message : '';
    throw new EvolutionManagementError(response.status, message.slice(0, 240));
  }
  return response.json().catch(() => ({}));
};

const evolutionGroupMetadata = (payload: unknown, groupJid: string): EvolutionGroupMetadata => {
  const root = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const group = root.group && typeof root.group === 'object' ? root.group as Record<string, unknown> : root;
  const participants = Array.isArray(group.participants) ? group.participants.flatMap((value): EvolutionGroupMetadata['participants'] => {
    const item = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    const jid = typeof item.id === 'string' ? item.id : typeof item.jid === 'string' ? item.jid : '';
    if (!jid) return [];
    const phoneNumber = jid.match(/^(\d{8,15})@/)?.[1];
    return [{ jid, ...(typeof item.name === 'string' ? { name: item.name } : typeof item.pushName === 'string' ? { name: item.pushName } : {}), ...(phoneNumber ? { phoneNumber } : {}), ...(typeof item.admin === 'string' ? { admin: item.admin } : item.admin === null ? { admin: null } : item.admin === true ? { admin: 'admin' } : {}) }];
  }) : [];
  return { id: typeof group.id === 'string' ? group.id : groupJid, ...(typeof group.subject === 'string' ? { subject: group.subject } : {}), ...(typeof group.desc === 'string' ? { description: group.desc } : typeof group.description === 'string' ? { description: group.description } : {}), participants };
};

export const evolutionBridge = {
  async getGroupMetadata(instance: string, groupJid: string) {
    return evolutionGroupMetadata(await managementResponse(`/group/findGroupInfos/${encodeURIComponent(instance)}`, { method: 'POST', body: JSON.stringify({ groupJid }) }), groupJid);
  },
  async updateGroupDescription(instance: string, groupJid: string, description: string) {
    return evolutionGroupMetadata(await managementResponse(`/group/updateGroupDescription/${encodeURIComponent(instance)}`, { method: 'POST', body: JSON.stringify({ groupJid, description }) }), groupJid);
  },
  async createInstance(instanceName: string) {
    try {
      return await managementResponse('/instance/create', { method: 'POST', body: JSON.stringify({ instanceName, integration: 'WHATSAPP-BAILEYS', qrcode: true }) });
    } catch (error) {
      // A previous attempt may have created the instance and then failed while
      // configuring its webhook. Retrying must adopt that instance instead of
      // forcing the operator to change its name.
      if (!(error instanceof EvolutionManagementError) || !/already in use/i.test(error.details)) throw error;
      await managementResponse(`/instance/connectionState/${encodeURIComponent(instanceName)}`);
      return { instanceName, reused: true };
    }
  },
  getQrCode: (instanceName: string) => managementResponse(`/instance/connect/${encodeURIComponent(instanceName)}`),
  getConnection: (instanceName: string) => managementResponse(`/instance/connectionState/${encodeURIComponent(instanceName)}`),
  disconnect: (instanceName: string) => managementResponse(`/instance/logout/${encodeURIComponent(instanceName)}`, { method: 'DELETE' }),
  async configureWebhook(instanceName: string) {
    if (!config.publicUrl) throw new Error('BRIDGE_PUBLIC_URL é obrigatório para configurar o webhook Evolution.');
    return managementResponse(`/webhook/set/${encodeURIComponent(instanceName)}`, {
      // Evolution API v2.3 uses the singular GROUP_UPDATE event name. Using
      // GROUPS_UPDATE makes the API reject the whole webhook configuration.
      method: 'POST', body: JSON.stringify({ webhook: { enabled: true, url: `${config.publicUrl}/webhooks/evolution`, byEvents: false, base64: true, events: ['MESSAGES_UPSERT', 'MESSAGES_EDITED', 'MESSAGES_UPDATE', 'MESSAGES_DELETE', 'GROUPS_UPSERT', 'GROUP_UPDATE', 'GROUP_PARTICIPANTS_UPDATE'], headers: { 'x-bridge-secret': config.webhookSecret } } }),
    });
  },
  async downloadMedia(instance: string, media: IncomingEvolutionMedia): Promise<DownloadedEvolutionMedia> {
    const response = await evolutionRequest(`/chat/getBase64FromMediaMessage/${encodeURIComponent(instance)}`, {
      method: 'POST',
      body: JSON.stringify({ message: media.message, convertToMp4: false }),
    });
    if (!response.ok) throw new Error(`Evolution ${response.status}: não foi possível baixar a mídia.`);
    const payload: unknown = await response.json();
    const base64 = base64FromResponse(payload);
    if (!base64) throw new Error('A Evolution não retornou o conteúdo Base64 da mídia.');
    const contentType = contentTypeFor(media);
    return {
      buffer: base64Buffer(base64),
      contentType,
      fileName: media.fileName || `${media.kind}.${extensionFor(contentType, media.kind)}`,
    };
  },
  async sendText(instance: string, number: string, text: string, quoted?: EvolutionQuotedMessage): Promise<SentEvolutionMessage | null> {
    const response = await evolutionRequest(`/message/sendText/${encodeURIComponent(instance)}`, {
      method: 'POST',
      body: JSON.stringify({ number: normalizeEvolutionDestination(number), text, ...(quoted ? { quoted: { key: { id: quoted.messageId, ...(quoted.remoteJid ? { remoteJid: quoted.remoteJid } : {}), ...(quoted.fromMe !== undefined ? { fromMe: quoted.fromMe } : {}), ...(quoted.participant ? { participant: quoted.participant } : {}) } } } : {}) }),
    });
    if (!response.ok) throw new Error(`Evolution ${response.status}: ${await response.text()}`);
    return sentMessageFromResponse(response);
  },
  async sendMedia(instance: string, number: string, attachment: OutgoingAttachment, caption = '', quoted?: EvolutionQuotedMessage): Promise<SentEvolutionMessage | null> {
    const baseUrl = new URL(config.chatwootBaseUrl);
    const assetUrl = chatwootAssetUrl(attachment.url);
    if (assetUrl.protocol !== 'https:' && assetUrl.origin !== baseUrl.origin) throw new Error('URL de anexo não permitida.');
    const asset = await fetch(assetUrl);
    if (!asset.ok) throw new Error(`Não foi possível baixar o anexo do Chatwoot (${asset.status}).`);
    const buffer = Buffer.from(await asset.arrayBuffer());
    if (buffer.length > config.maxMediaBytes) throw new Error('O anexo do Chatwoot excede o tamanho permitido.');
    // Evolution v2 accepts a URL or the raw Base64 payload. A data URI is
    // rejected as "Owned media", so keep MIME information in mediatype.
    const media = buffer.toString('base64');
    const mediaType = attachment.fileType === 'image' ? 'image' : attachment.fileType === 'audio' ? 'audio' : attachment.fileType === 'video' ? 'video' : 'document';
    const response = await evolutionRequest(`/message/sendMedia/${encodeURIComponent(instance)}`, {
      method: 'POST',
      body: JSON.stringify({ number: normalizeEvolutionDestination(number), mediatype: mediaType, media, fileName: attachment.fileName, caption, ...(quoted ? { quoted: { key: { id: quoted.messageId, ...(quoted.remoteJid ? { remoteJid: quoted.remoteJid } : {}), ...(quoted.fromMe !== undefined ? { fromMe: quoted.fromMe } : {}), ...(quoted.participant ? { participant: quoted.participant } : {}) } } } : {}) }),
    });
    if (!response.ok) throw new Error(`Evolution ${response.status}: ${await response.text()}`);
    return sentMessageFromResponse(response);
  },
  async sendReaction(instance: string, target: EvolutionReactionTarget) {
    if (!target.remoteJid || target.remoteJid === 'status@broadcast') throw new Error('A mensagem de destino não é compatível com reactions Evolution.');
    if (target.remoteJid.endsWith('@g.us') && !target.fromMe && !target.participant) throw new Error('Uma reaction para mensagem de grupo exige o participante original.');
    const emoji = normalizeEvolutionReactionEmoji(target.emoji);
    if (emoji && !/^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}]$/u.test(emoji)) {
      throw new Error('A reação selecionada não é compatível com a Evolution.');
    }
    const response = await evolutionRequest(`/message/sendReaction/${encodeURIComponent(instance)}`, {
      method: 'POST',
      // Evolution v2 identifies the message by its original Baileys key. An
      // empty reaction is the documented WhatsApp operation for removal.
      body: JSON.stringify({ key: { remoteJid: target.remoteJid, fromMe: target.fromMe, id: target.messageId, ...(target.participant ? { participant: target.participant } : {}) }, reaction: emoji }),
    });
    if (!response.ok) throw new Error(`Evolution ${response.status}: ${await response.text()}`);
  },
  async editMessage(instance: string, target: EvolutionMutationTarget, text: string) {
    if (!target.fromMe || !text.trim()) throw new Error('A Evolution só permite editar mensagens de texto enviadas pelo próprio número.');
    const response = await evolutionRequest(`/chat/updateMessage/${encodeURIComponent(instance)}`, {
      method: 'POST',
      body: JSON.stringify({ number: target.remoteJid, text: text.trim(), key: { id: target.messageId, remoteJid: target.remoteJid, fromMe: target.fromMe, ...(target.participant ? { participant: target.participant } : {}) } }),
    });
    if (!response.ok) throw new Error(`Evolution ${response.status}: ${await response.text()}`);
  },
  async revokeMessage(instance: string, target: EvolutionMutationTarget) {
    if (!target.fromMe) throw new Error('A Evolution só permite apagar para todos mensagens enviadas pelo próprio número.');
    const response = await evolutionRequest(`/chat/deleteMessageForEveryone/${encodeURIComponent(instance)}`, {
      method: 'DELETE',
      body: JSON.stringify({ id: target.messageId, remoteJid: target.remoteJid, fromMe: target.fromMe, ...(target.participant ? { participant: target.participant } : {}) }),
    });
    if (!response.ok) throw new Error(`Evolution ${response.status}: ${await response.text()}`);
  },
};
