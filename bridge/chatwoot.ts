import { config } from './config.js';

export type ApiInbox = { id: number; channel_type: string; inbox_identifier?: string; additional_attributes?: Record<string, unknown>; secret?: string };
type Contact = { id: number; source_id: string };
type Conversation = { id: number; status: string };
type AccountContact = { id: number; phone_number?: string; contact_inboxes?: Array<{ inbox_id: number; source_id: string }> };

const request = async <T>(path: string, init: RequestInit = {}, apiToken = false): Promise<T> => {
  const response = await fetch(`${config.chatwootBaseUrl}${path}`, { ...init, headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(apiToken ? { api_access_token: config.chatwootApiAccessToken } : {}), ...init.headers } });
  const raw = await response.text();
  const body: unknown = raw ? JSON.parse(raw) : undefined;
  if (!response.ok) throw new Error(`Chatwoot ${response.status}: ${typeof body === 'object' && body && 'message' in body ? String(body.message) : response.statusText}`);
  return body as T;
};

export const chatwootBridge = {
  listApiInboxes: () => request<{ payload: ApiInbox[] }>(`/api/v1/accounts/${config.chatwootAccountId}/inboxes`, {}, true).then(response => response.payload.filter(item => item.channel_type === 'Channel::Api')),
  async findInbox(instance: string): Promise<{ identifier: string; id: number }> {
    const inbox = (await this.listApiInboxes()).find(item => item.additional_attributes?.evolution_provider === 'evolution' && item.additional_attributes?.evolution_instance_name === instance);
    if (!inbox?.inbox_identifier) throw new Error(`Nenhuma inbox Evolution encontrada para a instância ${instance}.`);
    return { identifier: inbox.inbox_identifier, id: inbox.id };
  },
  async findEvolutionInboxById(inboxId: number): Promise<{ instance: string; id: number }> {
    const inbox = (await this.listApiInboxes()).find(item => item.id === inboxId && item.additional_attributes?.evolution_provider === 'evolution');
    const instance = inbox?.additional_attributes?.evolution_instance_name;
    if (!inbox || typeof instance !== 'string') throw new Error(`A inbox ${inboxId} não é uma inbox Evolution configurada.`);
    return { instance, id: inbox.id };
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
  async findOrCreateConversation(identifier: string, sourceId: string): Promise<Conversation> {
    const root = `/public/api/v1/inboxes/${encodeURIComponent(identifier)}/contacts/${encodeURIComponent(sourceId)}/conversations`;
    const conversations = await request<Conversation[]>(root);
    // One WhatsApp contact/inbox always uses its latest conversation. Reusing
    // resolved conversations prevents new threads for every incoming message.
    const latest = [...conversations].sort((left, right) => right.id - left.id)[0];
    return latest || request<Conversation>(root, { method: 'POST', body: JSON.stringify({}) });
  },
  createIncomingMessage: (identifier: string, sourceId: string, conversationId: number, content: string, echoId: string) => request(`${`/public/api/v1/inboxes/${encodeURIComponent(identifier)}/contacts/${encodeURIComponent(sourceId)}/conversations/${conversationId}/messages`}`, { method: 'POST', body: JSON.stringify({ content, echo_id: echoId }) }),
  createMobileOutgoingMessage: (conversationId: number, content: string, evolutionMessageId: string) => request(`/api/v1/accounts/${config.chatwootAccountId}/conversations/${conversationId}/messages`, {
    method: 'POST',
    // source_id prevents this echo from being delivered back to Evolution.
    // content_attributes is returned by the Chatwoot API and lets the UI
    // clearly distinguish messages written in the linked phone from agent
    // messages written in the platform.
    body: JSON.stringify({ content, message_type: 'outgoing', source_id: `evolution:${evolutionMessageId}`, echo_id: `evolution:${evolutionMessageId}`, content_attributes: { evolution_origin: 'mobile' } }),
  }, true),
};
