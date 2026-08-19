import { config } from './config.js';
import type { OutgoingAttachment } from './chatwootEvent.js';
import { chatwootAssetUrl } from './evolution.js';
import type { IncomingMetaMedia, MetaMediaKind } from './metaEvent.js';

export interface MetaCloudManualConfig { wabaId: string; phoneNumberId: string; accessToken: string; }
export interface MetaCloudConnection { provider: 'meta_cloud'; wabaId: string; phoneNumberId: string; displayPhoneNumber: string | null; verifiedName: string | null; }
export interface MetaEmbeddedSignupResult { onboardingMode: 'standard' | 'coexistence'; wabaId: string; phoneNumberId?: string | null; businessId?: string | null; }

type GraphErrorPayload = { error?: { code?: number; message?: string; type?: string; error_data?: { details?: string } } };

export class MetaCloudError extends Error {
  constructor(public readonly category: 'authentication' | 'permission' | 'number' | 'template_window' | 'rate_limit' | 'media' | 'transient' | 'unknown', message: string) {
    super(message);
    this.name = 'MetaCloudError';
  }
}

export interface SentMetaMessage { messageId: string; }
export interface DownloadedMetaMedia { buffer: Buffer; contentType: string; fileName: string; }
export interface MetaTemplateComponent { type: string; text?: string; format?: string; buttons?: Array<{ type?: string; text?: string; url?: string }> }
export interface MetaMessageTemplate { id: string | null; name: string; language: string; category: string | null; status: string | null; quality: string | null; components: MetaTemplateComponent[]; updatedAt: string | null; }
export interface MetaTemplateSendInput { name: string; language: string; components?: Array<Record<string, unknown>>; }

const graph = (path: string, token: string, init: RequestInit = {}) => fetch(`https://graph.facebook.com/${config.metaGraphVersion}/${path}`, {
  ...init,
  headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
});

const graphUrl = (path: string, query: Record<string, string>) => {
  const url = new URL(`https://graph.facebook.com/${config.metaGraphVersion}/${path}`);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return url;
};

const permittedMetaMediaUrl = (value: string) => {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  return url.protocol === 'https:' && (host === 'lookaside.fbsbx.com' || host.endsWith('.fbcdn.net') || host.endsWith('.facebook.com') || host.endsWith('.whatsapp.net'));
};

const graphFailure = async (response: Response): Promise<never> => {
  const payload = await response.json().catch(() => ({})) as GraphErrorPayload;
  const code = payload.error?.code;
  const detail = payload.error?.error_data?.details || payload.error?.message || response.statusText || 'Meta Cloud API rejected the request.';
  const category = response.status === 401 ? 'authentication'
    : response.status === 403 ? 'permission'
      : response.status === 429 ? 'rate_limit'
        : code === 131047 || code === 131051 ? 'template_window'
          : code === 131026 || code === 133010 ? 'number'
            : code === 131053 ? 'media'
              : response.status >= 500 ? 'transient' : 'unknown';
  throw new MetaCloudError(category, detail);
};

const messageIdFrom = (payload: unknown): SentMetaMessage => {
  const id = payload && typeof payload === 'object' && Array.isArray((payload as { messages?: unknown[] }).messages)
    ? (payload as { messages: Array<{ id?: unknown }> }).messages[0]?.id : undefined;
  if (typeof id !== 'string' || !id) throw new MetaCloudError('unknown', 'A Meta aceitou a solicitação sem retornar um wamid.');
  return { messageId: id };
};

const mediaTypeFor = (attachment: OutgoingAttachment): MetaMediaKind => attachment.fileType === 'image' ? 'image' : attachment.fileType === 'audio' ? 'audio' : attachment.fileType === 'video' ? 'video' : 'document';
const extensionFor = (kind: MetaMediaKind, mimeType: string) => ({
  'image/jpeg': 'jpg', 'image/png': 'png', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'video/mp4': 'mp4', 'application/pdf': 'pdf',
}[mimeType.toLowerCase()] || (kind === 'image' ? 'jpg' : kind === 'audio' ? 'ogg' : kind === 'video' ? 'mp4' : 'bin'));

const postMessage = async (configInput: MetaCloudManualConfig, number: string, type: 'text' | 'template' | 'reaction' | MetaMediaKind, message: Record<string, unknown>, quotedMessageId?: string): Promise<SentMetaMessage> => {
  const response = await graph(`${encodeURIComponent(configInput.phoneNumberId)}/messages`, configInput.accessToken, {
    method: 'POST', body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: number.replace(/\D/g, ''), type, ...message, ...(quotedMessageId ? { context: { message_id: quotedMessageId } } : {}) }),
  });
  if (!response.ok) return graphFailure(response);
  return messageIdFrom(await response.json());
};

const uploadMedia = async (configInput: MetaCloudManualConfig, bytes: BlobPart, contentType: string, fileName: string) => {
  if (!contentType || !fileName) throw new MetaCloudError('media', 'A mídia do template não possui tipo ou nome válidos.');
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', contentType);
  form.append('file', new Blob([bytes], { type: contentType }), fileName);
  const upload = await graph(`${encodeURIComponent(configInput.phoneNumberId)}/media`, configInput.accessToken, { method: 'POST', body: form });
  if (!upload.ok) return graphFailure(upload);
  const uploadBody = await upload.json() as { id?: string };
  if (!uploadBody.id) throw new MetaCloudError('media', 'A Meta não retornou o ID da mídia enviada.');
  return uploadBody.id;
};

export const metaCloud = {
  async exchangeEmbeddedSignupCode(code: string): Promise<string> {
    if (!config.metaAppId || !config.metaAppSecret) throw new MetaCloudError('authentication', 'O bridge não possui META_APP_ID e META_APP_SECRET para concluir o Cadastro Incorporado.');
    if (!code.trim()) throw new MetaCloudError('authentication', 'A Meta não retornou um código de autorização.');
    // Facebook Login for Business exchanges the short-lived authorization code
    // on the server. `client_secret` never leaves this process.
    const response = await fetch(graphUrl('oauth/access_token', {
      client_id: config.metaAppId, client_secret: config.metaAppSecret, code: code.trim(),
    }), { headers: { Accept: 'application/json' } });
    if (!response.ok) return graphFailure(response);
    const payload = await response.json() as { access_token?: unknown };
    if (typeof payload.access_token !== 'string' || !payload.access_token) throw new MetaCloudError('authentication', 'A Meta não retornou um access token utilizável.');
    return payload.access_token;
  },

  async subscribeApp(input: MetaCloudManualConfig): Promise<void> {
    const response = await graph(`${encodeURIComponent(input.wabaId)}/subscribed_apps`, input.accessToken, { method: 'POST', body: JSON.stringify({}) });
    if (!response.ok) return graphFailure(response);
  },

  async completeEmbeddedSignup(code: string, result: MetaEmbeddedSignupResult): Promise<{ config: MetaCloudManualConfig; connection: MetaCloudConnection; webhookReady: boolean }> {
    if (!result.wabaId?.trim()) throw new MetaCloudError('number', 'O Cadastro Incorporado não informou o WABA ID.');
    const accessToken = await this.exchangeEmbeddedSignupCode(code);
    let phoneNumberId = result.phoneNumberId?.trim() || '';
    if (!phoneNumberId) {
      // FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING guarantees the WABA asset;
      // discover its sole registered number server-side. Never ask the
      // browser to guess an ID or register/migrate the Business App number.
      const response = await graph(`${encodeURIComponent(result.wabaId.trim())}/phone_numbers?fields=id`, accessToken);
      if (!response.ok) return graphFailure(response);
      const payload = await response.json() as { data?: Array<{ id?: unknown }> };
      const numbers = (payload.data || []).map(item => typeof item.id === 'string' ? item.id : '').filter(Boolean);
      if (numbers.length !== 1) throw new MetaCloudError('number', 'A Meta não retornou um único Phone Number ID para este WABA coexistente.');
      phoneNumberId = numbers[0];
    }
    const configInput = { wabaId: result.wabaId.trim(), phoneNumberId, accessToken };
    const connection = await this.validateManual(configInput);
    try {
      await this.subscribeApp(configInput);
      return { config: configInput, connection, webhookReady: true };
    } catch (error) {
      // Credentials remain valid after a subscription failure. The caller can
      // persist them as a repairable incomplete onboarding, never as connected.
      if (error instanceof MetaCloudError) return { config: configInput, connection, webhookReady: false };
      throw error;
    }
  },
  async validateManual(input: MetaCloudManualConfig): Promise<MetaCloudConnection> {
    if (!input.wabaId.trim() || !input.phoneNumberId.trim() || !input.accessToken.trim()) throw new Error('WABA ID, Phone Number ID e access token são obrigatórios.');
    const [phoneResponse, numbersResponse] = await Promise.all([
      graph(`${encodeURIComponent(input.phoneNumberId)}?fields=id,display_phone_number,verified_name`, input.accessToken),
      graph(`${encodeURIComponent(input.wabaId)}/phone_numbers?fields=id`, input.accessToken),
    ]);
    if (!phoneResponse.ok || !numbersResponse.ok) throw new Error('A Meta recusou as credenciais ou o número não está acessível.');
    const phone = await phoneResponse.json() as { id?: string; display_phone_number?: string; verified_name?: string };
    const numbers = await numbersResponse.json() as { data?: Array<{ id?: string }> };
    if (phone.id !== input.phoneNumberId || !numbers.data?.some(number => number.id === input.phoneNumberId)) throw new Error('O Phone Number ID não pertence ao WABA informado.');
    return { provider: 'meta_cloud', wabaId: input.wabaId, phoneNumberId: input.phoneNumberId, displayPhoneNumber: phone.display_phone_number || null, verifiedName: phone.verified_name || null };
  },
  sendText: (configInput: MetaCloudManualConfig, number: string, text: string, quotedMessageId?: string) => postMessage(configInput, number, 'text', { text: { body: text, preview_url: false } }, quotedMessageId),
  sendReaction: (configInput: MetaCloudManualConfig, number: string, targetMessageId: string, emoji: string) => {
    if (!targetMessageId.trim()) throw new MetaCloudError('unknown', 'A reação não possui a mensagem Meta de destino.');
    return postMessage(configInput, number, 'reaction', { reaction: { message_id: targetMessageId, emoji } });
  },
  async listTemplates(configInput: MetaCloudManualConfig): Promise<MetaMessageTemplate[]> {
    const response = await graph(`${encodeURIComponent(configInput.wabaId)}/message_templates?fields=id,name,language,category,status,quality_score,components,updated_time&limit=250`, configInput.accessToken);
    if (!response.ok) return graphFailure(response);
    const payload = await response.json() as { data?: Array<Record<string, unknown>> };
    return (payload.data || []).flatMap((template): MetaMessageTemplate[] => {
      if (typeof template.name !== 'string' || typeof template.language !== 'string') return [];
      return [{
        id: typeof template.id === 'string' ? template.id : null,
        name: template.name,
        language: template.language,
        category: typeof template.category === 'string' ? template.category : null,
        status: typeof template.status === 'string' ? template.status : null,
        quality: typeof template.quality_score === 'string' ? template.quality_score : null,
        components: Array.isArray(template.components) ? template.components.filter((component): component is MetaTemplateComponent => Boolean(component && typeof component === 'object' && typeof (component as { type?: unknown }).type === 'string')) : [],
        updatedAt: typeof template.updated_time === 'string' ? template.updated_time : null,
      }];
    });
  },
  sendTemplate: (configInput: MetaCloudManualConfig, number: string, input: MetaTemplateSendInput) => {
    if (!/^[a-z0-9_]+$/i.test(input.name) || !input.language.trim()) throw new MetaCloudError('unknown', 'Template inválido.');
    return postMessage(configInput, number, 'template', {
      template: { name: input.name, language: { code: input.language }, ...(input.components?.length ? { components: input.components } : {}) },
    }, undefined);
  },
  async uploadTemplateHeaderMedia(configInput: MetaCloudManualConfig, input: { buffer: Buffer; contentType: string; fileName: string; kind: 'image' | 'video' | 'document' }) {
    if (input.buffer.length > config.maxMediaBytes) throw new MetaCloudError('media', 'A mídia do cabeçalho excede o tamanho permitido.');
    const accepts = input.kind === 'image' ? /^image\// : input.kind === 'video' ? /^video\// : /^(application|text)\//;
    if (!accepts.test(input.contentType)) throw new MetaCloudError('media', 'O arquivo não corresponde ao tipo de cabeçalho do template.');
    return uploadMedia(configInput, input.buffer, input.contentType, input.fileName);
  },
  async sendMedia(configInput: MetaCloudManualConfig, number: string, attachment: OutgoingAttachment, caption = '', quotedMessageId?: string) {
    const assetUrl = chatwootAssetUrl(attachment.url);
    const chatwootUrl = new URL(config.chatwootBaseUrl);
    if (assetUrl.protocol !== 'https:' && assetUrl.origin !== chatwootUrl.origin) throw new MetaCloudError('media', 'URL de anexo não permitida.');
    const asset = await fetch(assetUrl);
    if (!asset.ok) throw new MetaCloudError('media', `Não foi possível baixar o anexo do Chatwoot (${asset.status}).`);
    const length = Number(asset.headers.get('content-length') || 0);
    if (length > config.maxMediaBytes) throw new MetaCloudError('media', 'O anexo do Chatwoot excede o tamanho permitido.');
    const rawAsset = await asset.arrayBuffer();
    if (rawAsset.byteLength > config.maxMediaBytes) throw new MetaCloudError('media', 'O anexo do Chatwoot excede o tamanho permitido.');
    const type = attachment.contentType || asset.headers.get('content-type') || 'application/octet-stream';
    const kind = mediaTypeFor(attachment);
    const fileName = attachment.fileName || `${kind}.${extensionFor(kind, type)}`;
    const mediaId = await uploadMedia(configInput, rawAsset, type, fileName);
    const media = kind === 'document'
      ? { document: { id: mediaId, filename: fileName, ...(caption ? { caption } : {}) } }
      : { [kind]: { id: mediaId, ...(kind !== 'audio' && caption ? { caption } : {}) } };
    return postMessage(configInput, number, kind, media, quotedMessageId);
  },
  async downloadMedia(configInput: MetaCloudManualConfig, media: IncomingMetaMedia): Promise<DownloadedMetaMedia> {
    const metadata = await graph(encodeURIComponent(media.mediaId), configInput.accessToken);
    if (!metadata.ok) return graphFailure(metadata);
    const details = await metadata.json() as { url?: string; mime_type?: string };
    if (!details.url || !permittedMetaMediaUrl(details.url)) throw new MetaCloudError('media', 'A Meta retornou uma URL de mídia não permitida.');
    const content = await fetch(details.url, { headers: { Authorization: `Bearer ${configInput.accessToken}` } });
    if (!content.ok) return graphFailure(content);
    const length = Number(content.headers.get('content-length') || 0);
    if (length > config.maxMediaBytes) throw new MetaCloudError('media', 'A mídia Meta excede o tamanho permitido.');
    const bytes = await content.arrayBuffer();
    if (bytes.byteLength > config.maxMediaBytes) throw new MetaCloudError('media', 'A mídia Meta excede o tamanho permitido.');
    const contentType = media.mimetype || details.mime_type || content.headers.get('content-type') || 'application/octet-stream';
    return { buffer: Buffer.from(bytes), contentType, fileName: media.fileName || `${media.kind}.${extensionFor(media.kind, contentType)}` };
  },
};
