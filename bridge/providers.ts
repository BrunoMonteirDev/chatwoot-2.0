export const WHATSAPP_TRANSPORTS = ['evolution', 'meta_cloud'] as const;
export type WhatsAppTransport = typeof WHATSAPP_TRANSPORTS[number];
export type WhatsAppProvider = WhatsAppTransport;
export const WHATSAPP_MODES = ['official', 'web', 'hybrid'] as const;
export type WhatsAppMode = typeof WHATSAPP_MODES[number];

export const externalMessageId = (provider: WhatsAppProvider, id: string) => `${provider === 'meta_cloud' ? 'meta' : 'evolution'}:${id}`;

export const parseExternalMessageId = (value: string | null | undefined): { provider: WhatsAppProvider; id: string } | null => {
  if (typeof value !== 'string') return null;
  const match = /^(evolution|meta):(.+)$/.exec(value);
  if (!match || !match[2]) return null;
  return { provider: match[1] === 'meta' ? 'meta_cloud' : 'evolution', id: match[2] };
};

export interface WhatsAppTransportConfiguration { mode: WhatsAppMode; transports: WhatsAppTransport[]; evolutionInstanceName: string | null; }

export const transportConfigurationForInbox = (attributes: Record<string, unknown>): WhatsAppTransportConfiguration | null => {
  const declared = Array.isArray(attributes.whatsapp_transports) ? attributes.whatsapp_transports.filter((item): item is WhatsAppTransport => item === 'evolution' || item === 'meta_cloud') : [];
  const transports: WhatsAppTransport[] = declared.length ? [...new Set(declared)] : attributes.whatsapp_provider === 'meta_cloud' ? ['meta_cloud'] : attributes.evolution_provider === 'evolution' ? ['evolution'] : [];
  if (!transports.length) return null;
  return { mode: transports.length === 2 ? 'hybrid' : transports[0] === 'meta_cloud' ? 'official' : 'web', transports, evolutionInstanceName: typeof attributes.evolution_instance_name === 'string' ? attributes.evolution_instance_name : null };
};

export const providerForInbox = (attributes: Record<string, unknown>): WhatsAppProvider | null => {
  const config = transportConfigurationForInbox(attributes);
  return config?.transports.length === 1 ? config.transports[0] : null;
};

export type WhatsAppChatType = 'private' | 'group';

export type WhatsAppOperation = 'new_message' | 'reply' | 'reaction' | 'media' | 'template' | 'edit' | 'revoke' | 'group_message';

export interface TransportCapabilities {
  text: boolean;
  media: boolean;
  reply: boolean;
  reactions: boolean;
  edit: boolean;
  revoke: boolean;
  groups: boolean;
  templates: boolean;
}

// This is intentionally bridge-owned. UI code obtains operational failures
// from the bridge instead of guessing provider support from an inbox mode.
export const TRANSPORT_CAPABILITIES: Record<WhatsAppTransport, TransportCapabilities> = {
  // Evolution API v2.3.0 exposes /chat/updateMessage and
  // /chat/deleteMessageForEveryone for Baileys messages. The operation layer
  // additionally restricts both to fromMe messages with a real external key.
  evolution: { text: true, media: true, reply: true, reactions: true, edit: true, revoke: true, groups: true, templates: false },
  meta_cloud: { text: true, media: true, reply: true, reactions: true, edit: false, revoke: false, groups: false, templates: true },
};

const capabilityForOperation: Record<WhatsAppOperation, keyof TransportCapabilities> = {
  new_message: 'text', reply: 'reply', reaction: 'reactions', media: 'media', template: 'templates', edit: 'edit', revoke: 'revoke', group_message: 'groups',
};

export type TransportRoute = { transport: WhatsAppTransport } | { transport: null; reason: 'transport_unavailable' | 'unsupported_operation' | 'requires_template' };

export const resolveTransportRoute = ({
  configuration,
  operation,
  chatType = 'private',
  target,
  explicitTransport,
}: {
  configuration: WhatsAppTransportConfiguration;
  operation: WhatsAppOperation;
  chatType?: WhatsAppChatType;
  target?: { sourceId?: string | null; contentAttributes?: Record<string, unknown> };
  explicitTransport?: WhatsAppTransport | null;
}): TransportRoute => {
  // Mutations of an existing message are bound to the target identity.
  const targetTransport = target && resolveMessageOperationTransport(target);
  const requested = targetTransport || explicitTransport || (chatType === 'group'
    ? (configuration.transports.includes('evolution') ? 'evolution' : null)
    : (configuration.transports.includes('meta_cloud') ? 'meta_cloud' : configuration.transports.includes('evolution') ? 'evolution' : null));
  if (!requested || !configuration.transports.includes(requested)) return { transport: null, reason: 'transport_unavailable' };
  const capability = chatType === 'group' && operation !== 'reaction' ? 'groups' : capabilityForOperation[operation];
  if (!TRANSPORT_CAPABILITIES[requested][capability]) return { transport: null, reason: 'unsupported_operation' };
  return { transport: requested };
};

export const resolveOutgoingTransport = ({ configuration, chatType = 'private' }: { configuration: WhatsAppTransportConfiguration; chatType?: WhatsAppChatType }): WhatsAppTransport | null => {
  // Future group routing will explicitly choose Evolution. Until group support
  // exists, hybrid/private is deliberately Meta-first, never an implicit web fallback.
  const route = resolveTransportRoute({ configuration, chatType, operation: chatType === 'group' ? 'group_message' : 'new_message' });
  return route.transport;
};

// Operations which modify an existing WhatsApp message (reactions now; edits
// or remote deletes later) must use the transport that created that message.
// Inbox mode only chooses a route for *new* messages and is deliberately not
// consulted here.
export const resolveMessageOperationTransport = ({ sourceId, contentAttributes = {} }: { sourceId?: string | null; contentAttributes?: Record<string, unknown> }): WhatsAppTransport | null => {
  const declared = contentAttributes.whatsapp_transport;
  if (declared === 'evolution' || declared === 'meta_cloud') return declared;
  return parseExternalMessageId(sourceId)?.provider || null;
};
