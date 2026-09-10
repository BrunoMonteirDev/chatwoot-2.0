import { config } from './config.js';
import { AsyncLocalStorage } from 'node:async_hooks';
import { normalizeBrazilianPhone } from '../phone.ts';
import type { DownloadedEvolutionMedia } from './evolution.js';
import { externalMessageId, transportConfigurationForInbox, type WhatsAppTransport, type WhatsAppTransportConfiguration } from './providers.js';
import type { StagedMetaHistoryMessage } from './metaHistoryStore.js';
import type { EvolutionGroupParticipant } from './evolutionEvent.js';

export type ApiInbox = { id: number; name?: string; channel_type: string; inbox_identifier?: string; additional_attributes?: Record<string, unknown>; secret?: string };
type Contact = { id: number; source_id: string; name?: string; phone_number?: string; thumbnail?: string | null };
type Conversation = { id: number; internal_id?: number; status: string; inbox_id?: number; last_activity_at?: number; meta?: { sender?: { id?: number; name?: string; thumbnail?: string | null; additional_attributes?: Record<string, unknown> | null } }; contact_inbox?: { source_id?: string | null }; messages?: Array<{ content_attributes?: Record<string, unknown> | null }> };
type ConversationTarget = { id: number; inbox_id: number; meta?: { sender?: { id?: number; name?: string; thumbnail?: string | null; phone_number?: string | null; additional_attributes?: Record<string, unknown> | null } }; contact_inbox?: { source_id?: string | null } };
type AccountContact = {
  id: number;
  name?: string;
  thumbnail?: string | null;
  phone_number?: string;
  additional_attributes?: Record<string, unknown>;
  // Chatwoot's account API serializes the inbox as a nested object, while
  // older responses used inbox_id. Accept both during the transition.
  contact_inboxes?: Array<{ inbox_id?: number; source_id: string; inbox?: { id?: number } }>;
};
export type PersistedGroupContact = {
  contactId: number; groupJid: string; subject?: string; avatarUrl?: string; description?: string;
  participants: unknown[]; historicalParticipants: unknown[]; syncedAt?: string;
};

export interface WhatsAppReactionUpdate {
  senderId: string;
  emoji: string;
  transport: WhatsAppTransport;
  origin: 'contact' | 'mobile' | 'platform';
  eventId?: string;
}

export interface WhatsAppMessageTransportMetadata {
  sourceId: string;
  transport: WhatsAppTransport;
  remoteJid: string;
  fromMe: boolean;
  providerMessageKey?: string;
}
export interface WhatsAppMessageTarget { id: number; conversation_id: number; source_id: string; content_attributes: Record<string, unknown>; attachments_count?: number }

export interface EvolutionMessageContext {
  chatType?: 'private' | 'group';
  participantJid?: string;
  participantName?: string;
  participantPhone?: string;
  participantAvatarUrl?: string;
  participantContactId?: number;
  isForwarded?: boolean;
  forwardingScore?: number;
  providerMessageKey?: string;
}

export interface HistoricalMetaImportInput {
  message: StagedMetaHistoryMessage;
  direction: 'incoming' | 'outgoing';
  remoteJid: string;
  status?: 'sent' | 'delivered' | 'read' | 'failed';
  mediaUnavailable?: boolean;
  media?: DownloadedEvolutionMedia;
}
export interface HistoricalWhatsAppImportInput {
  sourceId: string;
  threadId: string;
  timestamp: number;
  content: string;
  transport: 'meta_cloud' | 'waha';
  direction: 'incoming' | 'outgoing';
  remoteJid: string;
  quotedMessageId?: string;
  historyStatus?: string;
  status?: 'sent' | 'delivered' | 'read' | 'failed';
  mediaType?: 'image' | 'audio' | 'video' | 'document';
  mediaUnavailable?: boolean;
  media?: DownloadedEvolutionMedia;
  context?: EvolutionMessageContext;
}

const accountContext = new AsyncLocalStorage<number>();
let serviceToken: string | undefined;
let serviceTokenRequest: Promise<string> | undefined;

const bridgeApiToken = async () => {
  // Local development retains the explicit token. Production obtains a
  // dedicated server-side token from Rails by default, including when an old
  // value remains in .env.production. An old installation can opt back in
  // explicitly while it is being migrated.
  if (config.chatwootApiAccessToken && (process.env.NODE_ENV !== 'production' || process.env.BRIDGE_USE_LEGACY_CHATWOOT_TOKEN === 'true')) return config.chatwootApiAccessToken;
  if (serviceToken) return serviceToken;
  if (!serviceTokenRequest) {
    serviceTokenRequest = fetch(`${config.chatwootBaseUrl}/api/v1/bridge/access_token`, {
      headers: {
        Accept: 'application/json',
        'X-Bridge-Secret': config.webhookSecret,
        'X-Forwarded-Proto': 'https',
        'X-Forwarded-Ssl': 'on',
      },
    }).then(async response => {
      const body = await response.json().catch(() => ({})) as { api_access_token?: unknown };
      if (!response.ok || typeof body.api_access_token !== 'string' || !body.api_access_token) {
        throw new Error(`Chatwoot bridge credentials ${response.status}`);
      }
      serviceToken = body.api_access_token;
      return serviceToken;
    }).finally(() => { serviceTokenRequest = undefined; });
  }
  return serviceTokenRequest;
};

const currentAccountId = () => {
  const accountId = accountContext.getStore() ?? config.chatwootDefaultAccountId;
  if (!accountId) throw new Error('A conta Chatwoot não foi informada para esta operação.');
  return accountId;
};

const request = async <T>(path: string, init: RequestInit = {}, apiToken = false): Promise<T> => {
  const token = apiToken ? await bridgeApiToken() : undefined;
  // Rails receives this request over the private Docker HTTP network, while
  // the public application is HTTPS. Preserve the original scheme for every
  // API call so FORCE_SSL never redirects fetch to the non-existent
  // https://rails:3000 endpoint.
  const response = await fetch(`${config.chatwootBaseUrl}${path}`, { ...init, headers: {
    Accept: 'application/json',
    'X-Forwarded-Proto': 'https',
    'X-Forwarded-Ssl': 'on',
    ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { api_access_token: token } : {}),
    ...init.headers,
  } });
  const raw = await response.text();
  // Rails may render an HTML error page in development. Preserve the HTTP
  // failure without turning a response parser error into a bridge crash.
  let body: unknown;
  try { body = raw ? JSON.parse(raw) : undefined; } catch { body = undefined; }
  if (!response.ok) throw new Error(`Chatwoot ${response.status}: ${typeof body === 'object' && body && 'message' in body ? String(body.message) : response.statusText}`);
  return body as T;
};

// Administrative routes have already verified a Devise session. Use that
// session for the account/inbox ownership check instead of relying on the
// bridge service token. This keeps the check tenant-scoped and makes the
// local development bridge work before the service-account endpoint exists.
const requestWithSession = async <T>(path: string, sessionHeaders: Headers, init: RequestInit = {}): Promise<T> => {
  const headers = new Headers(sessionHeaders);
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (init.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  const response = await fetch(`${config.chatwootBaseUrl}${path}`, { ...init, headers });
  const raw = await response.text();
  let body: unknown;
  try { body = raw ? JSON.parse(raw) : undefined; } catch { body = undefined; }
  if (!response.ok) throw new Error(`Chatwoot ${response.status}: ${response.statusText}`);
  return body as T;
};

// Rails treats a dot in a dynamic URL segment as a format separator. WAHA
// group JIDs end in `@g.us`; encode the dot as well so a group ContactInbox
// source id reaches the public Chatwoot conversation route intact.
const encodeContactSourceForPath = (sourceId: string) => encodeURIComponent(sourceId).replace(/\./g, '%2E');

const replyAttributes = (quotedMessageId?: string) => quotedMessageId ? {
  // Chatwoot resolves this to its internal `in_reply_to` when the original
  // message exists. Keep the raw WhatsApp ID too: the builder deliberately
  // clears an unresolved external reference, but that must not erase data
  // from a reply to history that has not been imported yet.
  in_reply_to_external_id: `evolution:${quotedMessageId}`,
  evolution_quoted_message_id: quotedMessageId,
} : {};

const transportReplyAttributes = (transport: WhatsAppTransport, quotedMessageId?: string) => quotedMessageId ? {
  in_reply_to_external_id: externalMessageId(transport, quotedMessageId),
  ...(transport === 'meta_cloud' ? { meta_quoted_message_id: quotedMessageId } : transport === 'waha' ? { waha_quoted_message_id: quotedMessageId } : { evolution_quoted_message_id: quotedMessageId }),
} : {};

const transportMessageAttributes = (transport: WhatsAppTransport, messageType: 'incoming' | 'outgoing', remoteJid?: string, quotedMessageId?: string, context: EvolutionMessageContext = {}, inReplyTo?: number) => ({
  whatsapp_transport: transport,
  ...(remoteJid ? { whatsapp_remote_jid: remoteJid } : {}),
  ...(context.chatType === 'group' ? { whatsapp_chat_type: 'group' } : {}),
  ...(context.participantJid ? { whatsapp_participant_jid: context.participantJid } : {}),
  ...(context.participantName ? { whatsapp_participant_name: context.participantName } : {}),
  ...(context.participantPhone ? { whatsapp_participant_phone: context.participantPhone } : {}),
  ...(context.participantAvatarUrl ? { whatsapp_participant_avatar_url: context.participantAvatarUrl } : {}),
  ...(context.participantContactId ? { whatsapp_participant_contact_id: context.participantContactId } : {}),
  ...(context.isForwarded ? { whatsapp_is_forwarded: true } : {}),
  ...(typeof context.forwardingScore === 'number' ? { whatsapp_forwarding_score: context.forwardingScore } : {}),
  ...(transport === 'waha' && context.providerMessageKey ? { whatsapp_provider_message_key: context.providerMessageKey } : {}),
  // An outgoing message received from a linked WhatsApp session was written
  // on the phone, rather than by an agent in Chatwoot. Keep this provider
  // neutral so WAHA and Evolution have identical behaviour in the UI.
  ...(messageType === 'outgoing' ? { whatsapp_origin: 'mobile' } : {}),
  // Retain the legacy attribute for existing Evolution consumers.
  ...(transport === 'evolution' && messageType === 'outgoing' ? { evolution_origin: 'mobile' } : {}),
  ...(inReplyTo ? { in_reply_to: inReplyTo } : {}),
  ...transportReplyAttributes(transport, quotedMessageId),
});

const businessAppMessageAttributes = (remoteJid?: string, quotedMessageId?: string) => ({
  ...transportMessageAttributes('meta_cloud', 'outgoing', remoteJid, quotedMessageId),
  meta_origin: 'business_app',
});

const evolutionMessageAttributes = (messageType: 'incoming' | 'outgoing', remoteJid?: string, quotedMessageId?: string, context: EvolutionMessageContext = {}, inReplyTo?: number) => ({
  whatsapp_transport: 'evolution',
  ...(remoteJid ? { whatsapp_remote_jid: remoteJid } : {}),
  ...(context.chatType === 'group' ? { whatsapp_chat_type: 'group' } : {}),
  ...(context.participantJid ? { whatsapp_participant_jid: context.participantJid } : {}),
  ...(context.participantName ? { whatsapp_participant_name: context.participantName } : {}),
  ...(context.isForwarded ? { whatsapp_is_forwarded: true } : {}),
  ...(typeof context.forwardingScore === 'number' ? { whatsapp_forwarding_score: context.forwardingScore } : {}),
  ...(messageType === 'outgoing' ? { evolution_origin: 'mobile' } : {}),
  ...(inReplyTo ? { in_reply_to: inReplyTo } : {}),
  ...replyAttributes(quotedMessageId),
});

const mediaMessagePayload = (content: string, messageType: 'incoming' | 'outgoing', evolutionMessageId: string, media: DownloadedEvolutionMedia, quotedMessageId?: string, remoteJid?: string, context?: EvolutionMessageContext, inReplyTo?: number) => {
  const form = new FormData();
  if (content) form.append('content', content);
  form.append('message_type', messageType);
  form.append('source_id', `evolution:${evolutionMessageId}`);
  form.append('echo_id', `evolution:${evolutionMessageId}`);
  form.append('idempotent', 'true');
  if (messageType === 'incoming' && context?.participantContactId) { form.append('sender_type', 'Contact'); form.append('sender_id', String(context.participantContactId)); }
  form.append('attachments[]', new Blob([media.buffer], { type: media.contentType }), media.fileName);
  const attributes = evolutionMessageAttributes(messageType, remoteJid, quotedMessageId, context, inReplyTo);
  if (Object.keys(attributes).length) form.append('content_attributes', JSON.stringify(attributes));
  return form;
};

const transportMediaMessagePayload = (content: string, messageType: 'incoming' | 'outgoing', transport: WhatsAppTransport, messageId: string, media: DownloadedEvolutionMedia, quotedMessageId?: string, remoteJid?: string, inReplyTo?: number, context: EvolutionMessageContext = {}) => {
  const form = new FormData();
  if (content) form.append('content', content);
  form.append('message_type', messageType);
  const externalId = externalMessageId(transport, messageId);
  form.append('source_id', externalId);
  form.append('echo_id', externalId);
  form.append('idempotent', 'true');
  if (messageType === 'incoming' && context.participantContactId) { form.append('sender_type', 'Contact'); form.append('sender_id', String(context.participantContactId)); }
  form.append('attachments[]', new Blob([media.buffer], { type: media.contentType }), media.fileName);
  form.append('content_attributes', JSON.stringify(transportMessageAttributes(transport, messageType, remoteJid, quotedMessageId, context, inReplyTo)));
  return form;
};

export const chatwootBridge = {
  withAccount<T>(accountId: number, operation: () => Promise<T>): Promise<T> {
    if (!Number.isInteger(accountId) || accountId < 1) return Promise.reject(new Error('ID de conta Chatwoot inválido.'));
    return accountContext.run(accountId, operation);
  },
  async listServiceAccountIds(): Promise<number[]> {
    const profile = await request<{ accounts?: Array<{ id?: unknown }> }>('/api/v1/profile', {}, true);
    return [...new Set((profile.accounts || []).map(account => Number(account.id)).filter(accountId => Number.isInteger(accountId) && accountId > 0))];
  },
  async listAccountInboxes(accountId: number): Promise<ApiInbox[]> {
    return this.withAccount(accountId, async () => (await request<{ payload: ApiInbox[] }>(`/api/v1/accounts/${accountId}/inboxes`, {}, true)).payload || []);
  },
  listApiInboxes: () => request<{ payload: ApiInbox[] }>(`/api/v1/accounts/${currentAccountId()}/inboxes`, {}, true).then(response => response.payload.filter(item => item.channel_type === 'Channel::Api')),
  async findApiInboxById(inboxId: number): Promise<{ id: number; identifier: string; additionalAttributes: Record<string, unknown> }> {
    const inbox = (await this.listApiInboxes()).find(item => item.id === inboxId);
    if (!inbox?.inbox_identifier) throw new Error(`A inbox ${inboxId} não pertence a esta conta ou não é uma API inbox.`);
    return { id: inbox.id, identifier: inbox.inbox_identifier, additionalAttributes: inbox.additional_attributes || {} };
  },
  async findApiInboxByIdForSession(accountId: number, inboxId: number, sessionHeaders: Headers): Promise<{ id: number; identifier: string; additionalAttributes: Record<string, unknown> }> {
    const response = await requestWithSession<{ payload: ApiInbox[] }>(`/api/v1/accounts/${accountId}/inboxes`, sessionHeaders);
    const inbox = response.payload.find(item => item.id === inboxId && item.channel_type === 'Channel::Api');
    if (!inbox?.inbox_identifier) throw new Error(`A inbox ${inboxId} não pertence a esta conta ou não é uma API inbox.`);
    return { id: inbox.id, identifier: inbox.inbox_identifier, additionalAttributes: inbox.additional_attributes || {} };
  },
  async deleteInboxForSession(accountId: number, inboxId: number, sessionHeaders: Headers) {
    await requestWithSession(`/api/v1/accounts/${accountId}/inboxes/${inboxId}`, sessionHeaders, { method: 'DELETE' });
  },
  async findWhatsAppInboxByIdForSession(accountId: number, inboxId: number, sessionHeaders: Headers) {
    const response = await requestWithSession<{ payload: ApiInbox[] }>(`/api/v1/accounts/${accountId}/inboxes`, sessionHeaders);
    const inbox = response.payload.find(item => item.id === inboxId);
    if (!inbox) throw new Error(`A inbox ${inboxId} não pertence a esta conta.`);
    if (inbox.channel_type === 'Channel::Api') {
      const configuration = transportConfigurationForInbox(inbox.additional_attributes || {});
      if (!inbox.inbox_identifier || !configuration) throw new Error(`A inbox ${inboxId} não é uma inbox WhatsApp configurada.`);
      return { id: inbox.id, configuration };
    }
    const attributes = inbox.additional_attributes || {};
    const sessionName = attributes.hybrid_waha_session;
    if (inbox.channel_type !== 'Channel::Whatsapp' || attributes.hybrid_enabled !== true || typeof sessionName !== 'string' || !sessionName.trim()) {
      throw new Error(`A inbox ${inboxId} não possui WAHA híbrido configurado.`);
    }
    return { id: inbox.id, configuration: { mode: 'hybrid' as const, transports: ['meta_cloud', 'waha'] as WhatsAppTransport[], evolutionInstanceName: null, wahaSessionName: sessionName } };
  },
  async listInboxesForSession(accountId: number, sessionHeaders: Headers): Promise<ApiInbox[]> {
    return (await requestWithSession<{ payload: ApiInbox[] }>(`/api/v1/accounts/${accountId}/inboxes`, sessionHeaders)).payload;
  },
  async searchContactsForSession(accountId: number, query: string, sessionHeaders: Headers): Promise<AccountContact[]> {
    const response = await requestWithSession<{ payload: AccountContact[] }>(`/api/v1/accounts/${accountId}/contacts/search?q=${encodeURIComponent(query)}&include_contact_inboxes=false`, sessionHeaders);
    return response.payload;
  },
  async contactsByIdsForSession(accountId: number, contactIds: number[], sessionHeaders: Headers): Promise<AccountContact[]> {
    return Promise.all(contactIds.map(async id => {
      const response = await requestWithSession<{ payload: AccountContact }>(`/api/v1/accounts/${accountId}/contacts/${id}`, sessionHeaders);
      return response.payload;
    }));
  },
  async createOrFindContactForSession(accountId: number, input: { name: string; phoneNumber: string }, sessionHeaders: Headers) {
    const exactPhone = `+${input.phoneNumber.replace(/\D/g, '')}`;
    const findExact = async () => {
      const response = await requestWithSession<{ payload: AccountContact[] }>(`/api/v1/accounts/${accountId}/contacts/search?q=${encodeURIComponent(exactPhone)}&include_contact_inboxes=false`, sessionHeaders);
      return response.payload.find(contact => contact.phone_number && `+${contact.phone_number.replace(/\D/g, '')}` === exactPhone);
    };
    const existing = await findExact();
    if (existing) return { id: existing.id, name: existing.name || exactPhone, phoneNumber: existing.phone_number || exactPhone, avatarUrl: existing.thumbnail || null, existing: true };
    try {
      const created = await requestWithSession<{ payload: { contact: AccountContact; existing?: boolean } }>(`/api/v1/accounts/${accountId}/contacts`, sessionHeaders, {
        method: 'POST', body: JSON.stringify({ name: input.name.trim(), phone_number: exactPhone }),
      });
      const contact = created.payload.contact;
      return { id: contact.id, name: contact.name || exactPhone, phoneNumber: contact.phone_number || exactPhone, avatarUrl: contact.thumbnail || null, existing: Boolean(created.payload.existing) };
    } catch (error) {
      const raced = await findExact();
      if (!raced) throw error;
      return { id: raced.id, name: raced.name || exactPhone, phoneNumber: raced.phone_number || exactPhone, avatarUrl: raced.thumbnail || null, existing: true };
    }
  },
  async isApiInbox(inboxId: number) {
    return (await this.listApiInboxes()).some(inbox => inbox.id === inboxId);
  },
  async updateInboxAdditionalAttributes(inboxId: number, patch: Record<string, unknown>) {
    const inbox = (await this.listApiInboxes()).find(item => item.id === inboxId);
    if (!inbox) throw new Error(`A inbox ${inboxId} não é uma API inbox.`);
    return request(`/api/v1/accounts/${currentAccountId()}/inboxes/${inboxId}`, {
      method: 'PATCH', body: JSON.stringify({ channel: { additional_attributes: { ...(inbox.additional_attributes || {}), ...patch } } }),
    }, true);
  },
  async deleteInbox(inboxId: number) {
    await request(`/api/v1/accounts/${currentAccountId()}/inboxes/${inboxId}`, { method: 'DELETE' }, true);
  },
  async findInbox(instance: string): Promise<{ identifier: string; id: number }> {
    const inbox = (await this.listApiInboxes()).find(item => item.additional_attributes?.evolution_provider === 'evolution' && item.additional_attributes?.evolution_instance_name === instance);
    if (!inbox?.inbox_identifier) throw new Error(`Nenhuma inbox Evolution encontrada para a instância ${instance}.`);
    return { identifier: inbox.inbox_identifier, id: inbox.id };
  },
  async findEvolutionInboxById(inboxId: number): Promise<{ instance: string; id: number }> {
    const inbox = (await this.listApiInboxes()).find(item => {
      const configuration = transportConfigurationForInbox(item.additional_attributes || {});
      return item.id === inboxId && configuration?.transports.includes('evolution');
    });
    const instance = inbox?.additional_attributes?.evolution_instance_name;
    if (!inbox || typeof instance !== 'string') throw new Error(`A inbox ${inboxId} não é uma inbox Evolution configurada.`);
    return { instance, id: inbox.id };
  },
  async findWahaInbox(session: string): Promise<{ identifier: string; id: number }> {
    const inbox = (await this.listApiInboxes()).find(item => item.additional_attributes?.waha_session_name === session && transportConfigurationForInbox(item.additional_attributes || {})?.transports.includes('waha'));
    if (!inbox?.inbox_identifier) throw new Error(`Nenhuma inbox WAHA encontrada para a sessão ${session}.`);
    return { identifier: inbox.inbox_identifier, id: inbox.id };
  },
  async listPersistedGroupContacts(inboxId: number): Promise<PersistedGroupContact[]> {
    const groups: PersistedGroupContact[] = [];
    const seen = new Set<number>();
    for (let page = 1; page <= 1_000; page += 1) {
      const response = await request<{ data: { payload: Conversation[] } }>(`/api/v1/accounts/${currentAccountId()}/conversations?inbox_id=${inboxId}&status=all&page=${page}`, {}, true);
      const conversations = response.data?.payload;
      if (!Array.isArray(conversations) || !conversations.length) break;
      let discovered = 0;
      for (const conversation of conversations) {
        if (seen.has(conversation.id)) continue;
        seen.add(conversation.id); discovered += 1;
        if (conversation.inbox_id !== inboxId) continue;
        const contactId = conversation.meta?.sender?.id;
        if (!contactId) continue;
        const attributes = conversation.meta?.sender?.additional_attributes || {};
        const encoded = conversation.contact_inbox?.source_id?.match(/^whatsapp:group:(.+)$/)?.[1];
        const declared = typeof attributes.whatsapp_group_jid === 'string' ? attributes.whatsapp_group_jid : '';
        const messageJid = conversation.messages?.map(message => message.content_attributes?.whatsapp_remote_jid).find((value): value is string => typeof value === 'string' && value.endsWith('@g.us')) || '';
        let groupJid = declared || messageJid;
        try { groupJid = decodeURIComponent(encoded || declared || messageJid); } catch { continue; }
        if (!groupJid.endsWith('@g.us')) continue;
        groups.push({
          contactId, groupJid, subject: conversation.meta?.sender?.name,
          ...(conversation.meta?.sender?.thumbnail ? { avatarUrl: conversation.meta.sender.thumbnail } : {}),
          ...(typeof attributes.whatsapp_group_description === 'string' ? { description: attributes.whatsapp_group_description } : {}),
          participants: Array.isArray(attributes.whatsapp_group_participants) ? attributes.whatsapp_group_participants : [],
          historicalParticipants: Array.isArray(attributes.whatsapp_group_participant_history) ? attributes.whatsapp_group_participant_history : [],
          ...(typeof attributes.whatsapp_group_metadata_synced_at === 'string' ? { syncedAt: attributes.whatsapp_group_metadata_synced_at } : {}),
        });
      }
      // Protect against an API/proxy that ignores the page parameter.
      if (!discovered) break;
    }
    return groups;
  },
  async findWhatsAppInboxById(inboxId: number): Promise<{ id: number; configuration: WhatsAppTransportConfiguration }> {
    const inbox = (await this.listApiInboxes()).find(item => item.id === inboxId);
    const configuration = inbox && transportConfigurationForInbox(inbox.additional_attributes || {});
    if (!inbox || !configuration) throw new Error(`A inbox ${inboxId} não é uma inbox WhatsApp configurada.`);
    return { id: inbox.id, configuration };
  },
  async findMetaInboxByPhoneNumberId(phoneNumberId: string): Promise<{ identifier: string; id: number; configuration: WhatsAppTransportConfiguration }> {
    const inbox = (await this.listApiInboxes()).find(item => item.additional_attributes?.meta_phone_number_id === phoneNumberId && transportConfigurationForInbox(item.additional_attributes || {})?.transports.includes('meta_cloud'));
    const configuration = inbox && transportConfigurationForInbox(inbox.additional_attributes || {});
    if (!inbox?.inbox_identifier || !configuration) throw new Error(`Nenhuma inbox Meta Cloud encontrada para o Phone Number ID ${phoneNumberId}.`);
    return { identifier: inbox.inbox_identifier, id: inbox.id, configuration };
  },
  async findMetaInboxByWabaId(wabaId: string): Promise<{ id: number; configuration: WhatsAppTransportConfiguration }> {
    const inbox = (await this.listApiInboxes()).find(item => item.additional_attributes?.meta_waba_id === wabaId && transportConfigurationForInbox(item.additional_attributes || {})?.transports.includes('meta_cloud'));
    const configuration = inbox && transportConfigurationForInbox(inbox.additional_attributes || {});
    if (!inbox || !configuration) throw new Error(`Nenhuma inbox Meta Cloud encontrada para o WABA ${wabaId}.`);
    return { id: inbox.id, configuration };
  },
  async findContactSourceByPhone(inboxId: number, phoneNumber?: string) {
    if (!phoneNumber) return undefined;
    const normalizedPhoneNumber = normalizeBrazilianPhone(phoneNumber);
    const digits = normalizedPhoneNumber.replace(/\D/g, '');
    // Legacy contacts may still retain the additional digit. Search by the
    // canonical country/DDD prefix, then compare their canonical forms.
    const search = /^55([1-9]\d)\d{8}$/.exec(digits) ? `+55${digits.slice(2, 4)}` : normalizedPhoneNumber;
    const response = await request<{ payload: AccountContact[] }>(`/api/v1/accounts/${currentAccountId()}/contacts/search?q=${encodeURIComponent(search)}`, {}, true);
    const contact = response.payload.find(item => item.phone_number && normalizeBrazilianPhone(item.phone_number).replace(/\D/g, '') === digits);
    return contact?.contact_inboxes?.find(item => item.inbox_id === inboxId || item.inbox?.id === inboxId)?.source_id;
  },
  async findOrCreateGroupParticipantContact(inboxId: number, input: { phoneNumber: string; name?: string; avatarUrl?: string }) {
    const normalizedPhoneNumber = normalizeBrazilianPhone(input.phoneNumber);
    const digits = normalizedPhoneNumber.replace(/\D/g, '');
    const search = /^55([1-9]\d)\d{8}$/.exec(digits) ? `+55${digits.slice(2, 4)}` : normalizedPhoneNumber;
    const queries = [...new Set([search, normalizedPhoneNumber])];
    const findExisting = async () => (await Promise.all(queries.map(query => request<{ payload: AccountContact[] }>(`/api/v1/accounts/${currentAccountId()}/contacts/search?q=${encodeURIComponent(query)}`, {}, true))))
      .flatMap(item => item.payload).find(item => item.phone_number && normalizeBrazilianPhone(item.phone_number).replace(/\D/g, '') === digits);
    const existing = await findExisting();
    if (existing) {
      if (!existing.thumbnail && input.avatarUrl) await this.saveContactProfile(existing.id, { avatarUrl: input.avatarUrl });
      return { id: existing.id, name: existing.name, phoneNumber: existing.phone_number || normalizedPhoneNumber, avatarUrl: existing.thumbnail || input.avatarUrl, existing: true };
    }
    try {
      const created = await request<{ payload: { contact: AccountContact; existing?: boolean } }>(`/api/v1/accounts/${currentAccountId()}/contacts`, {
        method: 'POST', body: JSON.stringify({ name: input.name?.trim() || normalizedPhoneNumber, phone_number: normalizedPhoneNumber, inbox_id: inboxId, ...(input.avatarUrl ? { avatar_url: input.avatarUrl } : {}) }),
      }, true);
      const contact = created.payload.contact;
      return { id: contact.id, name: contact.name, phoneNumber: contact.phone_number || normalizedPhoneNumber, avatarUrl: contact.thumbnail || input.avatarUrl, existing: Boolean(created.payload.existing) };
    } catch (error) {
      const raced = await findExisting();
      if (!raced) throw error;
      if (!raced.thumbnail && input.avatarUrl) await this.saveContactProfile(raced.id, { avatarUrl: input.avatarUrl });
      return { id: raced.id, name: raced.name, phoneNumber: raced.phone_number || normalizedPhoneNumber, avatarUrl: raced.thumbnail || input.avatarUrl, existing: true };
    }
  },
  createOrFindContact: (identifier: string, input: { sourceId: string; name: string; phoneNumber?: string; avatarUrl?: string }) => request<Contact>(`/public/api/v1/inboxes/${encodeURIComponent(identifier)}/contacts`, { method: 'POST', body: JSON.stringify({ source_id: input.sourceId, name: input.name, ...(input.phoneNumber ? { phone_number: normalizeBrazilianPhone(input.phoneNumber) } : {}), ...(input.avatarUrl ? { avatar_url: input.avatarUrl } : {}) }) }),
  updatePublicContact: (identifier: string, sourceId: string, input: { name?: string; avatarUrl?: string }) => {
    if (!input.name && !input.avatarUrl) return Promise.resolve(undefined);
    return request(`/public/api/v1/inboxes/${encodeURIComponent(identifier)}/contacts/${encodeContactSourceForPath(sourceId)}`, {
      method: 'PATCH', body: JSON.stringify({ ...(input.name ? { name: input.name } : {}), ...(input.avatarUrl ? { avatar_url: input.avatarUrl } : {}) }),
    });
  },
  saveContactProfile: (contactId: number, input: { name?: string; avatarUrl?: string }) => {
    if (!input.name && !input.avatarUrl) return Promise.resolve(undefined);
    return request(`/api/v1/accounts/${currentAccountId()}/contacts/${contactId}`, {
      method: 'PATCH', body: JSON.stringify({ ...(input.name ? { name: input.name } : {}), ...(input.avatarUrl ? { avatar_url: input.avatarUrl } : {}) }),
    }, true);
  },
  saveEvolutionIdentity: (contactId: number, phoneNumber: string | undefined, lid: string | undefined) => request(`/api/v1/accounts/${currentAccountId()}/contacts/${contactId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      ...(phoneNumber ? { phone_number: normalizeBrazilianPhone(phoneNumber) } : {}),
      additional_attributes: {
        evolution_phone: phoneNumber ? normalizeBrazilianPhone(phoneNumber) : phoneNumber,
        ...(lid ? { evolution_lid: lid } : {}),
      },
    }),
  }, true),
  saveWahaIdentity: (contactId: number, phoneNumber: string | undefined, lid: string | undefined) => request(`/api/v1/accounts/${currentAccountId()}/contacts/${contactId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      ...(phoneNumber ? { phone_number: normalizeBrazilianPhone(phoneNumber) } : {}),
      additional_attributes: {
        ...(phoneNumber ? { waha_phone: normalizeBrazilianPhone(phoneNumber) } : {}),
        ...(lid ? { waha_lid: lid } : {}),
      },
    }),
  }, true),
  saveEvolutionGroup: (contactId: number, groupJid: string, name: string, details: { transport?: 'waha' | 'evolution'; avatarUrl?: string; description?: string; participants?: EvolutionGroupParticipant[]; historicalParticipants?: EvolutionGroupParticipant[]; participantAction?: string } = {}) => request(`/api/v1/accounts/${currentAccountId()}/contacts/${contactId}`, {
    method: 'PATCH', body: JSON.stringify({ name, additional_attributes: {
      whatsapp_chat_type: 'group', whatsapp_group_jid: groupJid,
      ...(details.transport ? { whatsapp_group_transport: details.transport } : {}),
      ...(details.avatarUrl ? { whatsapp_group_avatar_url: details.avatarUrl } : {}),
      ...(details.description !== undefined ? { whatsapp_group_description: details.description } : {}),
      ...(details.participants ? { whatsapp_group_participants: details.participants.map(item => ({ jid: item.jid, ...('lid' in item && item.lid ? { lid: item.lid } : {}), ...('phoneJid' in item && item.phoneJid ? { phone_jid: item.phoneJid } : {}), ...(item.phoneNumber ? { phone: item.phoneNumber } : {}), ...(item.name ? { name: item.name } : {}), ...(item.displayName ? { display_name: item.displayName } : {}), ...(item.avatarUrl ? { avatar_url: item.avatarUrl } : {}), ...(item.contactId ? { contact_id: item.contactId } : {}), ...(item.admin !== undefined ? { admin: item.admin } : {}) })) } : {}),
      ...(details.historicalParticipants ? { whatsapp_group_participant_history: details.historicalParticipants.map(item => ({ jid: item.jid, ...('lid' in item && item.lid ? { lid: item.lid } : {}), ...('phoneJid' in item && item.phoneJid ? { phone_jid: item.phoneJid } : {}), ...(item.phoneNumber ? { phone: item.phoneNumber } : {}), ...(item.name ? { name: item.name } : {}), ...(item.displayName ? { display_name: item.displayName } : {}), ...(item.avatarUrl ? { avatar_url: item.avatarUrl } : {}), ...(item.contactId ? { contact_id: item.contactId } : {}) })) } : {}),
      ...(details.participants ? { whatsapp_group_metadata_synced_at: new Date().toISOString() } : {}),
      ...(details.participantAction ? { whatsapp_group_last_participant_action: details.participantAction } : {}),
    } }),
  }, true),
  async ensureGroupConversation(inboxId: number, groupJid: string, name: string, transport: 'waha' | 'evolution', description?: string) {
    const sourceId = `whatsapp:group:${groupJid}`;
    let contact: AccountContact | undefined;
    try {
      const created = await request<{ payload: { contact: AccountContact } }>(`/api/v1/accounts/${currentAccountId()}/contacts`, {
        method: 'POST', body: JSON.stringify({ name, inbox_id: inboxId, source_id: sourceId, additional_attributes: { whatsapp_chat_type: 'group', whatsapp_group_jid: groupJid } }),
      }, true);
      contact = created.payload.contact;
    } catch {
      // A lifecycle webhook or an earlier idempotent attempt may already own
      // this source id. The conversation endpoint resolves that ContactInbox.
    }
    const existing = contact ? (await request<{ payload: Conversation[] }>(`/api/v1/accounts/${currentAccountId()}/contacts/${contact.id}/conversations`, {}, true)).payload.find(item => item.inbox_id === inboxId) : undefined;
    const conversation = existing || await request<Conversation>(`/api/v1/accounts/${currentAccountId()}/conversations`, {
      method: 'POST', body: JSON.stringify({ inbox_id: inboxId, ...(contact ? { contact_id: contact.id } : {}), source_id: sourceId, idempotent: true }),
    }, true);
    const contactId = contact?.id || conversation.meta?.sender?.id;
    if (!contactId) throw new Error('O Chatwoot não retornou o Contact do grupo.');
    await this.saveEvolutionGroup(contactId, groupJid, name, { transport, ...(description !== undefined ? { description } : {}) });
    return { conversationId: conversation.id, contactId, sourceId };
  },
  groupContactAttributes: (contactId: number) => request<{ payload: AccountContact }>(`/api/v1/accounts/${currentAccountId()}/contacts/${contactId}`, {}, true).then(response => response.payload.additional_attributes || {}),
  groupParticipantContact: (contactId: number) => request<{ payload: AccountContact }>(`/api/v1/accounts/${currentAccountId()}/contacts/${contactId}`, {}, true).then(response => ({ id: response.payload.id, name: response.payload.name, phoneNumber: response.payload.phone_number, avatarUrl: response.payload.thumbnail || undefined })),
  async findOrCreateConversation(identifier: string, sourceId: string, contactId: number, inboxId: number): Promise<Conversation> {
    // A contact may already have been created manually in Chatwoot. Its
    // ContactInbox source id is then a UUID rather than `whatsapp:<phone>`.
    // Look up conversations by contact and inbox first, not only by the
    // provider source id, otherwise Chatwoot creates a parallel thread.
    const listInternalConversations = async () => {
      const response = await request<{ payload: Conversation[] }>(`/api/v1/accounts/${currentAccountId()}/contacts/${contactId}/conversations`, {}, true);
      return response.payload
        .filter(conversation => conversation.inbox_id === inboxId)
        .sort((left, right) => (right.last_activity_at || 0) - (left.last_activity_at || 0));
    };
    const existing = (await listInternalConversations())[0];
    if (existing) return existing;

    // The public endpoint addresses a ContactInbox by source_id and is the
    // supported way to create a conversation. Its response exposes display_id
    // as `id`, however, while the authenticated API uses the database id.
    // Never pass the public response to administrative endpoints: create, then
    // read the canonical conversation from the authenticated account API.
    const root = `/public/api/v1/inboxes/${encodeURIComponent(identifier)}/contacts/${encodeContactSourceForPath(sourceId)}/conversations`;
    await request(root, { method: 'POST', body: JSON.stringify({ idempotent: true }) });
    const created = (await listInternalConversations())[0];
    if (!created) throw new Error('O Chatwoot não retornou a conversa recém-criada.');
    return created;
  },
  async conversationRecipient(conversationId: number, inboxId: number) {
    const conversation = await request<ConversationTarget>(`/api/v1/accounts/${currentAccountId()}/conversations/${conversationId}`, {}, true);
    if (conversation.inbox_id !== inboxId) throw new Error('A conversa não pertence à inbox informada.');
    const phoneNumber = conversation.meta?.sender?.phone_number?.replace(/\D/g, '') || conversation.contact_inbox?.source_id?.match(/^whatsapp:(\d{8,15})$/)?.[1];
    if (!phoneNumber || !/^\d{8,15}$/.test(phoneNumber)) throw new Error('A conversa não possui um contato individual WhatsApp válido.');
    return phoneNumber;
  },
  async conversationContactTarget(conversationId: number, inboxId: number) {
    const conversation = await request<ConversationTarget>(`/api/v1/accounts/${currentAccountId()}/conversations/${conversationId}`, {}, true);
    if (conversation.inbox_id !== inboxId) throw new Error('A conversa não pertence à inbox informada.');
    const attributes = conversation.meta?.sender?.additional_attributes;
    const rawPhone = conversation.meta?.sender?.phone_number || attributes?.waha_phone || attributes?.evolution_phone || conversation.contact_inbox?.source_id?.match(/^whatsapp:(\d{8,15})$/)?.[1];
    const digits = typeof rawPhone === 'string' ? rawPhone.replace(/\D/g, '') : '';
    if (!/^\d{8,15}$/.test(digits)) throw new Error('A conversa não possui um número WhatsApp resolvido.');
    return { phoneNumber: `+${digits}`, contactId: conversation.meta?.sender?.id, ...(conversation.contact_inbox?.source_id ? { sourceId: conversation.contact_inbox.source_id } : {}), ...(conversation.meta?.sender?.name ? { name: conversation.meta.sender.name } : {}), ...(conversation.meta?.sender?.thumbnail ? { avatarUrl: conversation.meta.sender.thumbnail } : {}) };
  },
  async conversationContactTargetForSession(accountId: number, conversationId: number, inboxId: number, sessionHeaders: Headers) {
    const conversation = await requestWithSession<ConversationTarget>(`/api/v1/accounts/${accountId}/conversations/${conversationId}`, sessionHeaders);
    if (conversation.inbox_id !== inboxId) throw new Error('A conversa não pertence à inbox informada.');
    const attributes = conversation.meta?.sender?.additional_attributes;
    const rawPhone = conversation.meta?.sender?.phone_number || attributes?.waha_phone || attributes?.evolution_phone || conversation.contact_inbox?.source_id?.match(/^whatsapp:(\d{8,15})$/)?.[1] || conversation.contact_inbox?.source_id;
    const digits = typeof rawPhone === 'string' ? rawPhone.replace(/\D/g, '') : '';
    if (!/^\d{8,15}$/.test(digits)) throw new Error('A conversa não possui um número WhatsApp resolvido.');
    return { phoneNumber: `+${digits}`, contactId: conversation.meta?.sender?.id, ...(conversation.contact_inbox?.source_id ? { sourceId: conversation.contact_inbox.source_id } : {}), ...(conversation.meta?.sender?.name ? { name: conversation.meta.sender.name } : {}), ...(conversation.meta?.sender?.thumbnail ? { avatarUrl: conversation.meta.sender.thumbnail } : {}) };
  },
  async conversationGroupTargetDetails(conversationId: number, inboxId: number) {
    const conversation = await request<ConversationTarget>(`/api/v1/accounts/${currentAccountId()}/conversations/${conversationId}`, {}, true);
    if (conversation.inbox_id !== inboxId) throw new Error('A conversa não pertence à inbox informada.');
    const sourceId = conversation.contact_inbox?.source_id;
    const attributes = conversation.meta?.sender?.additional_attributes;
    // The account conversation serializer omits contact_inbox on some
    // Chatwoot versions. Groups still carry their canonical JID on the
    // sender's additional attributes, so use it as the authoritative fallback.
    const encoded = typeof sourceId === 'string' && sourceId.match(/^whatsapp:group:(.+)$/)?.[1];
    const declaredJid = conversation.meta?.sender?.additional_attributes?.whatsapp_group_jid;
    const rawGroupJid = encoded || (typeof declaredJid === 'string' ? declaredJid : null);
    if (!rawGroupJid) throw new Error('A conversa não é um grupo WhatsApp válido.');
    try {
      const groupJid = decodeURIComponent(rawGroupJid);
      if (!groupJid.endsWith('@g.us')) throw new Error('invalid group');
      return { groupJid, contactId: conversation.meta?.sender?.id, persistedMetadata: {
        subject: conversation.meta?.sender?.name,
        avatarUrl: typeof attributes?.whatsapp_group_avatar_url === 'string' ? attributes.whatsapp_group_avatar_url : conversation.meta?.sender?.thumbnail || undefined,
        description: typeof attributes?.whatsapp_group_description === 'string' ? attributes.whatsapp_group_description : undefined,
        participants: Array.isArray(attributes?.whatsapp_group_participants) ? attributes.whatsapp_group_participants : [],
        historicalParticipants: Array.isArray(attributes?.whatsapp_group_participant_history) ? attributes.whatsapp_group_participant_history : [],
        syncedAt: typeof attributes?.whatsapp_group_metadata_synced_at === 'string' ? attributes.whatsapp_group_metadata_synced_at : undefined,
      } };
    } catch { throw new Error('A conversa não é um grupo WhatsApp válido.'); }
  },
  async conversationGroupTargetDetailsForSession(accountId: number, conversationId: number, inboxId: number, sessionHeaders: Headers) {
    const conversation = await requestWithSession<ConversationTarget>(`/api/v1/accounts/${accountId}/conversations/${conversationId}`, sessionHeaders);
    if (conversation.inbox_id !== inboxId) throw new Error('A conversa não pertence à inbox informada.');
    const senderId = conversation.meta?.sender?.id;
    const contact = !conversation.contact_inbox?.source_id && senderId
      ? (await requestWithSession<{ payload: AccountContact }>(`/api/v1/accounts/${accountId}/contacts/${senderId}`, sessionHeaders)).payload
      : undefined;
    const contactInbox = contact?.contact_inboxes?.find(item => (item.inbox?.id || item.inbox_id) === inboxId);
    const attributes = { ...(contact?.additional_attributes || {}), ...(conversation.meta?.sender?.additional_attributes || {}) };
    const sourceId = conversation.contact_inbox?.source_id || contactInbox?.source_id;
    const encoded = typeof sourceId === 'string' && sourceId.match(/^whatsapp:group:(.+)$/)?.[1];
    const declaredJid = attributes?.whatsapp_group_jid;
    const rawGroupJid = encoded || (typeof declaredJid === 'string' ? declaredJid : null);
    if (!rawGroupJid) throw new Error('A conversa não é um grupo WhatsApp válido.');
    const groupJid = decodeURIComponent(rawGroupJid);
    if (!groupJid.endsWith('@g.us')) throw new Error('A conversa não é um grupo WhatsApp válido.');
    return { groupJid, contactId: conversation.meta?.sender?.id, persistedMetadata: {
      subject: conversation.meta?.sender?.name || contact?.name,
      avatarUrl: typeof attributes?.whatsapp_group_avatar_url === 'string' ? attributes.whatsapp_group_avatar_url : conversation.meta?.sender?.thumbnail || contact?.thumbnail || undefined,
      description: typeof attributes?.whatsapp_group_description === 'string' ? attributes.whatsapp_group_description : undefined,
      participants: Array.isArray(attributes?.whatsapp_group_participants) ? attributes.whatsapp_group_participants : [],
      historicalParticipants: Array.isArray(attributes?.whatsapp_group_participant_history) ? attributes.whatsapp_group_participant_history : [],
      syncedAt: typeof attributes?.whatsapp_group_metadata_synced_at === 'string' ? attributes.whatsapp_group_metadata_synced_at : undefined,
    } };
  },
  async conversationGroupTarget(conversationId: number, inboxId: number) {
    return (await this.conversationGroupTargetDetails(conversationId, inboxId)).groupJid;
  },
  createSentMetaTemplateMessage: (conversationId: number, messageId: string, template: { name: string; language: string }) => request(`/api/v1/accounts/${currentAccountId()}/conversations/${conversationId}/messages`, {
    method: 'POST', body: JSON.stringify({
      content: `Template: ${template.name}`, idempotent: true,
      message_type: 'outgoing',
      source_id: `meta:${messageId}`,
      echo_id: `meta:${messageId}`,
      content_attributes: { whatsapp_transport: 'meta_cloud', whatsapp_message_kind: 'template', template_name: template.name, template_language: template.language },
    }),
  }, true),
  createIncomingMessage: (_identifier: string, _sourceId: string, conversationId: number, content: string, evolutionMessageId: string, quotedMessageId?: string, remoteJid?: string, context?: EvolutionMessageContext, inReplyTo?: number) => request(`/api/v1/accounts/${currentAccountId()}/conversations/${conversationId}/messages`, { method: 'POST', body: JSON.stringify({ content, message_type: 'incoming', source_id: `evolution:${evolutionMessageId}`, echo_id: `evolution:${evolutionMessageId}`, idempotent: true, ...(context?.participantContactId ? { sender_type: 'Contact', sender_id: context.participantContactId } : {}), content_attributes: evolutionMessageAttributes('incoming', remoteJid, quotedMessageId, context, inReplyTo) }), }, true),
  createMobileOutgoingMessage: (conversationId: number, content: string, evolutionMessageId: string, quotedMessageId?: string, remoteJid?: string, context?: EvolutionMessageContext, inReplyTo?: number) => request(`/api/v1/accounts/${currentAccountId()}/conversations/${conversationId}/messages`, {
    method: 'POST',
    // source_id prevents this echo from being delivered back to Evolution.
    // content_attributes is returned by the Chatwoot API and lets the UI
    // clearly distinguish messages written in the linked phone from agent
    // messages written in the platform.
    body: JSON.stringify({ content, message_type: 'outgoing', source_id: `evolution:${evolutionMessageId}`, echo_id: `evolution:${evolutionMessageId}`, idempotent: true, content_attributes: evolutionMessageAttributes('outgoing', remoteJid, quotedMessageId, context, inReplyTo) }),
  }, true),
  createIncomingMediaMessage: (conversationId: number, content: string, evolutionMessageId: string, media: DownloadedEvolutionMedia, quotedMessageId?: string, remoteJid?: string, context?: EvolutionMessageContext, inReplyTo?: number) => request(`/api/v1/accounts/${currentAccountId()}/conversations/${conversationId}/messages`, {
    method: 'POST', body: mediaMessagePayload(content, 'incoming', evolutionMessageId, media, quotedMessageId, remoteJid, context, inReplyTo),
  }, true),
  createMobileOutgoingMediaMessage: (conversationId: number, content: string, evolutionMessageId: string, media: DownloadedEvolutionMedia, quotedMessageId?: string, remoteJid?: string, context?: EvolutionMessageContext, inReplyTo?: number) => request(`/api/v1/accounts/${currentAccountId()}/conversations/${conversationId}/messages`, {
    method: 'POST', body: mediaMessagePayload(content, 'outgoing', evolutionMessageId, media, quotedMessageId, remoteJid, context, inReplyTo),
  }, true),
  createIncomingTransportMessage: (_identifier: string, _sourceId: string, conversationId: number, transport: WhatsAppTransport, content: string, messageId: string, quotedMessageId?: string, remoteJid?: string, inReplyTo?: number, context: EvolutionMessageContext = {}) => {
    const externalId = externalMessageId(transport, messageId);
    return request(`/api/v1/accounts/${currentAccountId()}/conversations/${conversationId}/messages`, {
      method: 'POST', body: JSON.stringify({ content, message_type: 'incoming', source_id: externalId, echo_id: externalId, idempotent: true, ...(context.participantContactId ? { sender_type: 'Contact', sender_id: context.participantContactId } : {}), content_attributes: transportMessageAttributes(transport, 'incoming', remoteJid, quotedMessageId, context, inReplyTo) }),
    }, true);
  },
  createMobileOutgoingTransportMessage: (conversationId: number, transport: WhatsAppTransport, content: string, messageId: string, quotedMessageId?: string, remoteJid?: string, inReplyTo?: number, context: EvolutionMessageContext = {}) => {
    const externalId = externalMessageId(transport, messageId);
    return request(`/api/v1/accounts/${currentAccountId()}/conversations/${conversationId}/messages`, { method: 'POST', body: JSON.stringify({ content, message_type: 'outgoing', source_id: externalId, echo_id: externalId, idempotent: true, content_attributes: transportMessageAttributes(transport, 'outgoing', remoteJid, quotedMessageId, context, inReplyTo) }) }, true);
  },
  createIncomingTransportMediaMessage: (conversationId: number, transport: WhatsAppTransport, content: string, messageId: string, media: DownloadedEvolutionMedia, quotedMessageId?: string, remoteJid?: string, inReplyTo?: number, context: EvolutionMessageContext = {}) => request(`/api/v1/accounts/${currentAccountId()}/conversations/${conversationId}/messages`, {
    method: 'POST', body: transportMediaMessagePayload(content, 'incoming', transport, messageId, media, quotedMessageId, remoteJid, inReplyTo, context),
  }, true),
  createMobileOutgoingTransportMediaMessage: (conversationId: number, transport: WhatsAppTransport, content: string, messageId: string, media: DownloadedEvolutionMedia, quotedMessageId?: string, remoteJid?: string, inReplyTo?: number, context: EvolutionMessageContext = {}) => request(`/api/v1/accounts/${currentAccountId()}/conversations/${conversationId}/messages`, {
    method: 'POST', body: transportMediaMessagePayload(content, 'outgoing', transport, messageId, media, quotedMessageId, remoteJid, inReplyTo, context),
  }, true),
  createBusinessAppEchoMessage: (conversationId: number, content: string, messageId: string, quotedMessageId?: string, remoteJid?: string) => request(`/api/v1/accounts/${currentAccountId()}/conversations/${conversationId}/messages`, {
    method: 'POST', body: JSON.stringify({ content, message_type: 'outgoing', source_id: `meta:${messageId}`, echo_id: `meta:${messageId}`, idempotent: true, content_attributes: businessAppMessageAttributes(remoteJid, quotedMessageId) }),
  }, true),
  createBusinessAppEchoMediaMessage: (conversationId: number, content: string, messageId: string, media: DownloadedEvolutionMedia, quotedMessageId?: string, remoteJid?: string) => {
    const form = transportMediaMessagePayload(content, 'outgoing', 'meta_cloud', messageId, media, quotedMessageId, remoteJid);
    form.set('content_attributes', JSON.stringify(businessAppMessageAttributes(remoteJid, quotedMessageId)));
    return request(`/api/v1/accounts/${currentAccountId()}/conversations/${conversationId}/messages`, { method: 'POST', body: form }, true);
  },
  updateWhatsAppReaction: (conversationId: number, sourceId: string, reaction: WhatsAppReactionUpdate) => request(`/api/v1/accounts/${currentAccountId()}/conversations/${conversationId}/messages/whatsapp_reaction`, {
    method: 'POST', body: JSON.stringify({ source_id: sourceId, reaction: { sender_id: reaction.senderId, emoji: reaction.emoji, transport: reaction.transport, origin: reaction.origin, ...(reaction.eventId ? { event_id: reaction.eventId } : {}) } }),
  }, true),
  updateWhatsAppReactionBySourceId: (sourceId: string, reaction: WhatsAppReactionUpdate) => request(`/api/v1/accounts/${currentAccountId()}/whatsapp/messages/reaction`, {
    method: 'POST', body: JSON.stringify({ source_id: sourceId, reaction: { sender_id: reaction.senderId, emoji: reaction.emoji, transport: reaction.transport, origin: reaction.origin, ...(reaction.eventId ? { event_id: reaction.eventId } : {}) } }),
  }, true),
  updateWhatsAppMessageTransport: (conversationId: number, messageId: number, metadata: WhatsAppMessageTransportMetadata) => request(`/api/v1/accounts/${currentAccountId()}/conversations/${conversationId}/messages/${messageId}/whatsapp_transport_metadata`, {
    method: 'POST', body: JSON.stringify({ source_id: metadata.sourceId, transport: metadata.transport, remote_jid: metadata.remoteJid, from_me: metadata.fromMe, ...(metadata.providerMessageKey ? { provider_message_key: metadata.providerMessageKey } : {}) }),
  }, true),
  updateWhatsAppMessageStatus: (sourceId: string, status: 'sent' | 'delivered' | 'read' | 'failed', externalError?: string | null) => request(`/api/v1/accounts/${currentAccountId()}/whatsapp/messages/status`, {
    method: 'POST', body: JSON.stringify({ source_id: sourceId, status, ...(externalError ? { external_error: externalError.slice(0, 500) } : {}) }),
  }, true),
  editWhatsAppMessageBySourceId: (sourceId: string, content: string) => request<{ id: number; conversation_id: number; content: string; content_attributes: Record<string, unknown> }>(`/api/v1/accounts/${currentAccountId()}/whatsapp/messages/edit`, {
    method: 'POST', body: JSON.stringify({ source_id: sourceId, content }),
  }, true),
  revokeWhatsAppMessageBySourceId: (sourceId: string) => request<{ id: number; conversation_id: number; content: string; content_attributes: Record<string, unknown> }>(`/api/v1/accounts/${currentAccountId()}/whatsapp/messages/revoke`, {
    method: 'POST', body: JSON.stringify({ source_id: sourceId }),
  }, true),
  messageTargetBySourceId: (sourceId: string) => request<WhatsAppMessageTarget>(`/api/v1/accounts/${currentAccountId()}/whatsapp/messages/target?source_id=${encodeURIComponent(sourceId)}`, {}, true),
  async importHistoricalWhatsAppMessage(conversationId: number, input: HistoricalWhatsAppImportInput) {
    const { media } = input;
    const body = new FormData();
    body.append('source_id', input.sourceId);
    body.append('direction', input.direction);
    body.append('timestamp', String(input.timestamp));
    body.append('content', input.content);
    body.append('thread_id', input.threadId);
    body.append('remote_jid', input.remoteJid);
    body.append('transport', input.transport);
    if (input.quotedMessageId) body.append('quoted_message_id', input.quotedMessageId);
    if (input.historyStatus) body.append('history_status', input.historyStatus);
    if (input.status) body.append('status', input.status);
    if (input.mediaType) body.append('media_type', input.mediaType);
    if (input.context?.chatType === 'group') body.append('chat_type', 'group');
    if (input.context?.participantJid) body.append('participant_jid', input.context.participantJid);
    if (input.context?.participantName) body.append('participant_name', input.context.participantName);
    if (input.context?.participantContactId) body.append('participant_contact_id', String(input.context.participantContactId));
    if (input.mediaUnavailable) body.append('historical_media_unavailable', 'true');
    if (media) body.append('attachment', new Blob([media.buffer], { type: media.contentType }), media.fileName);
    return request<{ id: number; created: boolean }>(`/api/v1/accounts/${currentAccountId()}/whatsapp/conversations/${conversationId}/history_messages`, { method: 'POST', body }, true);
  },
  importHistoricalMetaMessage(conversationId: number, input: HistoricalMetaImportInput) {
    const { message } = input;
    return this.importHistoricalWhatsAppMessage(conversationId, {
      sourceId: message.sourceId, threadId: message.threadId, timestamp: message.timestamp || 0, content: message.content,
      transport: 'meta_cloud', direction: input.direction, remoteJid: input.remoteJid, quotedMessageId: message.quotedMessageId,
      historyStatus: message.historyStatus || undefined, status: input.status, mediaType: message.media?.kind,
      mediaUnavailable: input.mediaUnavailable, media: input.media,
    });
  },
  resolveHistoricalReplies: (conversationId: number) => request<void>(`/api/v1/accounts/${currentAccountId()}/whatsapp/conversations/${conversationId}/history_messages/resolve_replies`, { method: 'POST' }, true),
};
