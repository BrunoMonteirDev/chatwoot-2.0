import { config } from './config.js';
import type { OutgoingAttachment } from './chatwootEvent.js';

export const normalizeEvolutionDestination = (number: string) => {
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

export const evolutionBridge = {
  async sendText(instance: string, number: string, text: string) {
    const response = await fetch(`${config.evolutionBaseUrl}/message/sendText/${encodeURIComponent(instance)}`, {
      method: 'POST',
      headers: { apikey: config.evolutionApiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ number: normalizeEvolutionDestination(number), text }),
    });
    if (!response.ok) throw new Error(`Evolution ${response.status}: ${await response.text()}`);
  },
  async sendMedia(instance: string, number: string, attachment: OutgoingAttachment, caption = '') {
    const baseUrl = new URL(config.chatwootBaseUrl);
    const assetUrl = chatwootAssetUrl(attachment.url);
    if (assetUrl.protocol !== 'https:' && assetUrl.origin !== baseUrl.origin) throw new Error('URL de anexo não permitida.');
    const asset = await fetch(assetUrl);
    if (!asset.ok) throw new Error(`Não foi possível baixar o anexo do Chatwoot (${asset.status}).`);
    const buffer = Buffer.from(await asset.arrayBuffer());
    // Evolution v2 accepts a URL or the raw Base64 payload. A data URI is
    // rejected as "Owned media", so keep MIME information in mediatype.
    const media = buffer.toString('base64');
    const mediaType = attachment.fileType === 'image' ? 'image' : attachment.fileType === 'audio' ? 'audio' : attachment.fileType === 'video' ? 'video' : 'document';
    const response = await fetch(`${config.evolutionBaseUrl}/message/sendMedia/${encodeURIComponent(instance)}`, {
      method: 'POST',
      headers: { apikey: config.evolutionApiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ number: normalizeEvolutionDestination(number), mediatype: mediaType, media, fileName: attachment.fileName, caption }),
    });
    if (!response.ok) throw new Error(`Evolution ${response.status}: ${await response.text()}`);
  },
};
