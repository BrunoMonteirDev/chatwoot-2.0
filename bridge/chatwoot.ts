import { config } from './config.js';
import type { DownloadedEvolutionMedia } from './evolution.js';
import { transportConfigurationForInbox, type WhatsAppTransport, type WhatsAppTransportConfiguration } from './providers.js';
import type { StagedMetaHistoryMessage } from './metaHistoryStore.js';
import type { EvolutionGroupParticipant } from './evolutionEvent.js';

export type ApiInbox = { id: number; channel_type: string; inbox_identifier?: string; additional_attributes?: Record<string, unknown>; secret?: string };
type Contact = { id: number; source_id: string };
type Conversation = { id: number; status: string };
type ConversationTarget = { id: number; inbox_id: number; meta?: { sender?: { phone_number?: string | null } }; contact_inbox?: { source_id?: string | null } };
type AccountContact = { id: number; phone_number?: string; contact_inboxes?: Array<{ inbox_id: number; source_id: string }> };

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
}
export interface WhatsAppMessageTarget { source_id: string; content_attributes: Record<string, unknown> }

export interface EvolutionMessageContext {
  chatType?: 'private' | 'group';
  participantJid?: string;
  participantName?: string;
}

export interface HistoricalMetaImportInput {
  message: StagedMetaHistoryMessage;
  direction: 'incoming' | 'outgoing';
  remoteJid: string;
  status?: 'sent' | 'delivered' | 'read' | 'failed';
  mediaUnavailable?: boolean;
  media?: DownloadedEvolutionMedia;
}

const request = async <T>(path: string, init: RequestInit = {}, apiToken = false): Promise<T> => {
  const response = await fetch(`${config.chatwootBaseUrl}${path}`, { ...init, headers: { Accept: 'application/json', ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...(apiToken ? { api_access_token: config.chatwootApiAccessToken } : {}), ...init.headers } });
  const raw = await response.text();
  const body: unknown = raw ? JSON.parse(raw) : undefined;
  if (!response.ok) throw new Error(`Chatwoot ${response.status}: ${typeof body === 'object' && body && 'message' in body ? String(body.message) : response.statusText}`);
  return body as T;
};

const replyAttributes = (quotedMessageId?: string) => quotedMessageId ? {
  // Chatwoot resolves this to its internal `in_reply_to` when the original
  // message exists. Keep the raw WhatsApp ID too: the builder deliberately
  // clears an unresolved external reference, but that must not erase data
  // from a reply to history that has not been imported yet.
  in_reply_to_external_id: `evolution:${quotedMessageId}`,
  evolution_quoted_message_id: quotedMessageId,
} : {};

const transportReplyAttributes = (transport: WhatsAppTransport, quotedMessageId?: string) => quotedMessageId ? {
  in_reply_to_external_id: `${transport === 'meta_cloud' ? 'meta' : 'evolution'}:${quotedMessageId}`,
  ...(transport === 'meta_cloud' ? { meta_quoted_message_id: quotedMessageId } : { evolution_quoted_message_id: quotedMessageId }),
} : {};

const transportMessageAttributes = (transport: WhatsAppTransport, messageType: 'incoming' | 'outgoing', remoteJid?: string, quotedMessageId?: string, context: EvolutionMessageContext = {}) => ({
  whatsapp_transport: transport,
  ...(remoteJid ? { whatsapp_remote_jid: remoteJid } : {}),
  ...(context.chatType === 'group' ? { whatsapp_chat_type: 'group' } : {}),
  ...(context.participantJid ? { whatsapp_participant_jid: context.participantJid } : {}),
  ...(context.participantName ? { whatsapp_participant_name: context.participantName } : {}),
  ...(transport === 'evolution' && messageType === 'outgoing' ? { evolution_origin: 'mobile' } : {}),
  ...transportReplyAttributes(transport, quotedMessageId),
});

const businessAppMessageAttributes = (remoteJid?: string, quotedMessageId?: string) => ({
  ...transportMessageAttributes('meta_cloud', 'outgoing', remoteJid, quotedMessageId),
  meta_origin: 'business_app',
});

const evolutionMessageAttributes = (messageType: 'incoming' | 'outgoing', remoteJid?: string, quotedMessageId?: string, context: EvolutionMessageContext = {}) => ({
  whatsapp_transport: 'evolution',
  ...(remoteJid ? { whatsapp_remote_jid: remoteJid } : {}),
  ...(context.chatType === 'group' ? { whatsapp_chat_type: 'group' } : {}),
  ...(context.participantJid ? { whatsapp_participant_jid: context.participantJid } : {}),
  ...(context.participantName ? { whatsapp_participant_name: context.participantName } : {}),
  ...(messageType === 'outgoing' ? { evolution_origin: 'mobile' } : {}),
  ...replyAttributes(quotedMessageId),
});

const mediaMessagePayload = (content: string, messageType: 'incoming' | 'outgoing', evolutionMessageId: string, media: DownloadedEvolutionMedia, quotedMessageId?: string, remoteJid?: string, context?: EvolutionMessageContext) => {
  const form = new FormData();
  if (content) form.append('content', content);
  form.append('message_type', messageType);
  form.append('source_id', `evolution:${evolutionMessageId}`);
  form.append('echo_id', `evolution:${evolutionMessageId}`);
  form.append('attachments[]', new Blob([media.buffer], { type: media.contentType }), media.fileName);
  const attributes = evolutionMessageAttributes(messageType, remoteJid, quotedMessageId, context);
  if (Object.keys(attributes).length) form.append('content_attributes', JSON.stringify(attributes));
  return form;
};

const transportMediaMessagePayload = (content: string, messageType: 'incoming' | 'outgoing', transport: WhatsAppTransport, messageId: string, media: DownloadedEvolutionMedia, quotedMessageId?: string, remoteJid?: string) => {
  const form = new FormData();
  if (content) form.append('content', content);
  form.append('message_type', messageType);
  const externalId = `${transport === 'meta_cloud' ? 'meta' : 'evolution'}:${messageId}`;
  form.append('source_id', externalId);
  form.append('echo_id', externalId);
  form.append('attachments[]', new Blob([media.buffer], { type: media.contentType }), media.fileName);
  form.append('content_attributes', JSON.stringify(transportMessageAttributes(transport, messageType, remoteJid, quotedMessageId)));
  return form;
};

export const chatwootBridge = {
  listApiInboxes: () => request<{ payload: ApiInbox[] }>(`/api/v1/accounts/${config.chatwootAccountId}/inboxes`, {}, true).then(response => response.payload.filter(item => item.channel_type === 'Channel::Api')),
  async isApiInbox(inboxId: number) {
    return (await this.listApiInboxes()).some(inbox => inbox.id === inboxId);
  },
  async updateInboxAdditionalAttributes(inboxId: number, patch: Record<string, unknown>) {
    const inbox = (await this.listApiInboxes()).find(item => item.id === inboxId);
    if (!inbox) throw new Error(`A inbox ${inboxId} não é uma API inbox.`);
    return request(`/api/v1/accounts/${config.chatwootAccountId}/inboxes/${inboxId}`, {
      method: 'PATCH', body: JSON.stringify({ channel: { additional_attributes: { ...(inbox.additional_attributes || {}), ...patch } } }),
    }, true);
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
    const response = await request<{ payload: AccountContact[] }>(`/api/v1/accounts/${config.chatwootAccountId}/contacts/search?q=${encodeURIComponent(phoneNumber)}`, {}, true);
    const digits = phoneNumber.replace(/\D/g, '');
    const contact = response.payload.find(item => item.phone_number?.replace(/\D/g, '') === digits);
    return contact?.contact_inboxes?.find(item => item.inbox_id === inboxId)?.source_id;
  },
  createOrFindContact: (identifier: string, input: { sourceId: string; name: string; phoneNumber?: string }) => request<Contact>(`/public/api/v1/inboxes/${encodeURIComponent(identifier)}/contacts`, { method: 'POST', body: JSON.stringify({ source_id: input.sourceId, name: input.name, ...(input.phoneNumber ? { phone_number: input.phoneNumber } : {}) }) }),
  saveEvolutionIdentity: (contactId: number, phoneNumber: string | undefined, lid: string | undefined) => request(`/api/v1/accounts/${config.chatwootAccountId}/contacts/${contactId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      ...(phoneNumber ? { phone_number: phoneNumber } : {}),
      additional_attributes: {
        evolution_phone: phoneNumber,
        ...(lid ? { evolution_lid: lid } : {}),
      },
    }),
  }, true),
  saveEvolutionGroup: (contactId: number, groupJid: string, name: string, details: { avatarUrl?: string; participants?: EvolutionGroupParticipant[]; participantAction?: string } = {}) => request(`/api/v1/accounts/${config.chatwootAccountId}/contacts/${contactId}`, {
    method: 'PATCH', body: JSON.stringify({ name, additional_attributes: {
      whatsapp_chat_type: 'group', whatsapp_group_jid: groupJid,
      ...(details.avatarUrl ? { whatsapp_group_avatar_url: details.avatarUrl } : {}),
      ...(details.participants ? { whatsapp_group_participants: details.participants.map(item => ({ jid: item.jid, ...(item.phoneNumber ? { phone: item.phoneNumber } : {}), ...(item.name ? { name: item.name } : {}), ...(item.avatarUrl ? { avatar_url: item.avatarUrl } : {}), ...(item.admin !== undefined ? { admin: item.admin } : {}) })) } : {}),
      ...(details.participantAction ? { whatsapp_group_last_participant_action: details.participantAction } : {}),
    } }),
  }, true),
  async findOrCreateConversation(identifier: string, sourceId: string): Promise<Conversation> {
    const root = `/public/api/v1/inboxes/${encodeURIComponent(identifier)}/contacts/${encodeURIComponent(sourceId)}/conversations`;
    const conversations = await request<Conversation[]>(root);
    // One WhatsApp contact/inbox always uses its latest conversation. Reusing
    // resolved conversations prevents new threads for every incoming message.
    const latest = [...conversations].sort((left, right) => right.id - left.id)[0];
    return latest || request<Conversation>(root, { method: 'POST', body: JSON.stringify({}) });
  },
  async conversationRecipient(conversationId: number, inboxId: number) {
    const conversation = await request<ConversationTarget>(`/api/v1/accounts/${config.chatwootAccountId}/conversations/${conversationId}`, {}, true);
    if (conversation.inbox_id !== inboxId) throw new Error('A conversa não pertence à inbox informada.');
    const phoneNumber = conversation.meta?.sender?.phone_number?.replace(/\D/g, '') || conversation.contact_inbox?.source_id?.match(/^whatsapp:(\d{8,15})$/)?.[1];
    if (!phoneNumber || !/^\d{8,15}$/.test(phoneNumber)) throw new Error('A conversa não possui um contato individual WhatsApp válido.');
    return phoneNumber;
  },
  createSentMetaTemplateMessage: (conversationId: number, messageId: string, template: { name: string; language: string }) => request(`/api/v1/accounts/${config.chatwootAccountId}/conversations/${conversationId}/messages`, {
    method: 'POST', body: JSON.stringify({
      content: `Template: ${template.name}`,
      message_type: 'outgoing',
      source_id: `meta:${messageId}`,
      echo_id: `meta:${messageId}`,
      content_attributes: { whatsapp_transport: 'meta_cloud', whatsapp_message_kind: 'template', template_name: template.name, template_language: template.language },
    }),
  }, true),
  createIncomingMessage: (_identifier: string, _sourceId: string, conversationId: number, content: string, evolutionMessageId: string, quotedMessageId?: string, remoteJid?: string, context?: EvolutionMessageContext) => request(`/api/v1/accounts/${config.chatwootAccountId}/conversations/${conversationId}/messages`, { method: 'POST', body: JSON.stringify({ content, message_type: 'incoming', source_id: `evolution:${evolutionMessageId}`, echo_id: `evolution:${evolutionMessageId}`, content_attributes: evolutionMessageAttributes('incoming', remoteJid, quotedMessageId, context) }), }, true),
  createMobileOutgoingMessage: (conversationId: number, content: string, evolutionMessageId: string, quotedMessageId?: string, remoteJid?: string, context?: EvolutionMessageContext) => request(`/api/v1/accounts/${config.chatwootAccountId}/conversations/${conversationId}/messages`, {
    method: 'POST',
    // source_id prevents this echo from being delivered back to Evolution.
    // content_attributes is returned by the Chatwoot API and lets the UI
    // clearly distinguish messages written in the linked phone from agent
    // messages written in the platform.
    body: JSON.stringify({ content, message_type: 'outgoing', source_id: `evolution:${evolutionMessageId}`, echo_id: `evolution:${evolutionMessageId}`, content_attributes: evolutionMessageAttributes('outgoing', remoteJid, quotedMessageId, context) }),
  }, true),
  createIncomingMediaMessage: (conversationId: number, content: string, evolutionMessageId: string, media: DownloadedEvolutionMedia, quotedMessageId?: string, remoteJid?: string, context?: EvolutionMessageContext) => request(`/api/v1/accounts/${config.chatwootAccountId}/conversations/${conversationId}/messages`, {
    method: 'POST', body: mediaMessagePayload(content, 'incoming', evolutionMessageId, media, quotedMessageId, remoteJid, context),
  }, true),
  createMobileOutgoingMediaMessage: (conversationId: number, content: string, evolutionMessageId: string, media: DownloadedEvolutionMedia, quotedMessageId?: string, remoteJid?: string, context?: EvolutionMessageContext) => request(`/api/v1/accounts/${config.chatwootAccountId}/conversations/${conversationId}/messages`, {
    method: 'POST', body: mediaMessagePayload(content, 'outgoing', evolutionMessageId, media, quotedMessageId, remoteJid, context),
  }, true),
  createIncomingTransportMessage: (_identifier: string, _sourceId: string, conversationId: number, transport: WhatsAppTransport, content: string, messageId: string, quotedMessageId?: string, remoteJid?: string) => {
    const externalId = `${transport === 'meta_cloud' ? 'meta' : 'evolution'}:${messageId}`;
    return request(`/api/v1/accounts/${config.chatwootAccountId}/conversations/${conversationId}/messages`, {
      method: 'POST', body: JSON.stringify({ content, message_type: 'incoming', source_id: externalId, echo_id: externalId, content_attributes: transportMessageAttributes(transport, 'incoming', remoteJid, quotedMessageId) }),
    }, true);
  },
  createIncomingTransportMediaMessage: (conversationId: number, transport: WhatsAppTransport, content: string, messageId: string, media: DownloadedEvolutionMedia, quotedMessageId?: string, remoteJid?: string) => request(`/api/v1/accounts/${config.chatwootAccountId}/conversations/${conversationId}/messages`, {
    method: 'POST', body: transportMediaMessagePayload(content, 'incoming', transport, messageId, media, quotedMessageId, remoteJid),
  }, true),
  createBusinessAppEchoMessage: (conversationId: number, content: string, messageId: string, quotedMessageId?: string, remoteJid?: string) => request(`/api/v1/accounts/${config.chatwootAccountId}/conversations/${conversationId}/messages`, {
    method: 'POST', body: JSON.stringify({ content, message_type: 'outgoing', source_id: `meta:${messageId}`, echo_id: `meta:${messageId}`, content_attributes: businessAppMessageAttributes(remoteJid, quotedMessageId) }),
  }, true),
  createBusinessAppEchoMediaMessage: (conversationId: number, content: string, messageId: string, media: DownloadedEvolutionMedia, quotedMessageId?: string, remoteJid?: string) => {
    const form = transportMediaMessagePayload(content, 'outgoing', 'meta_cloud', messageId, media, quotedMessageId, remoteJid);
    form.set('content_attributes', JSON.stringify(businessAppMessageAttributes(remoteJid, quotedMessageId)));
    return request(`/api/v1/accounts/${config.chatwootAccountId}/conversations/${conversationId}/messages`, { method: 'POST', body: form }, true);
  },
  updateWhatsAppReaction: (conversationId: number, sourceId: string, reaction: WhatsAppReactionUpdate) => request(`/api/v1/accounts/${config.chatwootAccountId}/conversations/${conversationId}/messages/whatsapp_reaction`, {
    method: 'POST', body: JSON.stringify({ source_id: sourceId, reaction: { sender_id: reaction.senderId, emoji: reaction.emoji, transport: reaction.transport, origin: reaction.origin, ...(reaction.eventId ? { event_id: reaction.eventId } : {}) } }),
  }, true),
  updateWhatsAppReactionBySourceId: (sourceId: string, reaction: WhatsAppReactionUpdate) => request(`/api/v1/accounts/${config.chatwootAccountId}/whatsapp/messages/reaction`, {
    method: 'POST', body: JSON.stringify({ source_id: sourceId, reaction: { sender_id: reaction.senderId, emoji: reaction.emoji, transport: reaction.transport, origin: reaction.origin, ...(reaction.eventId ? { event_id: reaction.eventId } : {}) } }),
  }, true),
  updateWhatsAppMessageTransport: (conversationId: number, messageId: number, metadata: WhatsAppMessageTransportMetadata) => request(`/api/v1/accounts/${config.chatwootAccountId}/conversations/${conversationId}/messages/${messageId}/whatsapp_transport_metadata`, {
    method: 'POST', body: JSON.stringify({ source_id: metadata.sourceId, transport: metadata.transport, remote_jid: metadata.remoteJid, from_me: metadata.fromMe }),
  }, true),
  updateWhatsAppMessageStatus: (sourceId: string, status: 'sent' | 'delivered' | 'read' | 'failed', externalError?: string | null) => request(`/api/v1/accounts/${config.chatwootAccountId}/whatsapp/messages/status`, {
    method: 'POST', body: JSON.stringify({ source_id: sourceId, status, ...(externalError ? { external_error: externalError.slice(0, 500) } : {}) }),
  }, true),
  editWhatsAppMessageBySourceId: (sourceId: string, content: string) => request<{ id: number; conversation_id: number; content: string; content_attributes: Record<string, unknown> }>(`/api/v1/accounts/${config.chatwootAccountId}/whatsapp/messages/edit`, {
    method: 'POST', body: JSON.stringify({ source_id: sourceId, content }),
  }, true),
  revokeWhatsAppMessageBySourceId: (sourceId: string) => request<{ id: number; conversation_id: number; content: string; content_attributes: Record<string, unknown> }>(`/api/v1/accounts/${config.chatwootAccountId}/whatsapp/messages/revoke`, {
    method: 'POST', body: JSON.stringify({ source_id: sourceId }),
  }, true),
  messageTargetBySourceId: (sourceId: string) => request<WhatsAppMessageTarget>(`/api/v1/accounts/${config.chatwootAccountId}/whatsapp/messages/target?source_id=${encodeURIComponent(sourceId)}`, {}, true),
  async importHistoricalMetaMessage(conversationId: number, input: HistoricalMetaImportInput) {
    const { message, media } = input;
    const body = new FormData();
    body.append('source_id', message.sourceId);
    body.append('direction', input.direction);
    body.append('timestamp', String(message.timestamp || ''));
    body.append('content', message.content);
    body.append('thread_id', message.threadId);
    body.append('remote_jid', input.remoteJid);
    if (message.quotedMessageId) body.append('quoted_message_id', message.quotedMessageId);
    if (message.historyStatus) body.append('history_status', message.historyStatus);
    if (input.status) body.append('status', input.status);
    if (message.media) body.append('media_type', message.media.kind);
    if (input.mediaUnavailable) body.append('historical_media_unavailable', 'true');
    if (media) body.append('attachment', new Blob([media.buffer], { type: media.contentType }), media.fileName);
    return request<{ id: number; created: boolean }>(`/api/v1/accounts/${config.chatwootAccountId}/whatsapp/conversations/${conversationId}/history_messages`, { method: 'POST', body }, true);
  },
};
