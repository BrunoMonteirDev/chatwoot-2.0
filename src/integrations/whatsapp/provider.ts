import type { Inbox } from '../../domain/currentUser';

export const WHATSAPP_TRANSPORTS = ['evolution', 'waha', 'meta_cloud'] as const;
export type WhatsAppTransport = typeof WHATSAPP_TRANSPORTS[number];
// Kept as an alias for the previous public integration API.
export type WhatsAppProvider = WhatsAppTransport;
export const WHATSAPP_MODES = ['official', 'web'] as const;
export type WhatsAppMode = typeof WHATSAPP_MODES[number];
export const WHATSAPP_TRANSPORT_STATUSES = ['connected', 'disconnected', 'pending'] as const;
export type WhatsAppTransportStatus = typeof WHATSAPP_TRANSPORT_STATUSES[number];

export interface MetaCloudInboxMetadata {
  whatsapp_provider?: 'meta_cloud';
  whatsapp_mode?: WhatsAppMode;
  whatsapp_transports?: WhatsAppTransport[];
  meta_waba_id: string;
  meta_phone_number_id: string;
  meta_display_phone_number?: string | null;
  meta_onboarding_mode?: 'standard' | 'coexistence';
  meta_business_app_status?: 'active' | 'offboarded' | 'not_applicable';
  meta_history_available?: boolean;
  meta_history_authorized?: boolean;
  meta_history_status?: 'not_available' | 'waiting' | 'receiving' | 'ready' | 'importing' | 'synced' | 'failed';
}

export interface WhatsAppInboxConfiguration { mode: WhatsAppMode; transports: WhatsAppTransport[]; meta: MetaCloudInboxMetadata | null; evolutionInstanceName: string | null; wahaSessionName: string | null; }

const transportsFor = (attributes: Record<string, unknown>): WhatsAppTransport[] => {
  const declared = Array.isArray(attributes.whatsapp_transports) ? attributes.whatsapp_transports.filter((item): item is WhatsAppTransport => item === 'evolution' || item === 'waha' || item === 'meta_cloud') : [];
  if (declared.length) return [...new Set(declared)];
  if (attributes.whatsapp_provider === 'meta_cloud') return ['meta_cloud'];
  // Existing Evolution inboxes predate the generic provider marker.
  return attributes.evolution_provider === 'evolution' ? ['evolution'] : [];
};

export const whatsappConfigurationForInbox = (inbox: Inbox): WhatsAppInboxConfiguration | null => {
  const attributes = inbox.additionalAttributes;
  const transports = transportsFor(attributes);
  if (!transports.length) return null;
  // Uma inbox pode conter várias conexões. Isso não cria outro tipo de inbox:
  // a API oficial apenas prevalece como conexão principal quando estiver presente.
  const mode: WhatsAppMode = transports.includes('meta_cloud') ? 'official' : 'web';
  const hasMeta = transports.includes('meta_cloud') && typeof attributes.meta_waba_id === 'string' && typeof attributes.meta_phone_number_id === 'string';
  return {
    mode, transports,
    meta: hasMeta ? { whatsapp_mode: mode, whatsapp_transports: transports, meta_waba_id: attributes.meta_waba_id as string, meta_phone_number_id: attributes.meta_phone_number_id as string, meta_display_phone_number: typeof attributes.meta_display_phone_number === 'string' ? attributes.meta_display_phone_number : null, ...(attributes.meta_onboarding_mode === 'coexistence' || attributes.meta_onboarding_mode === 'standard' ? { meta_onboarding_mode: attributes.meta_onboarding_mode } : {}), ...(attributes.meta_business_app_status === 'active' || attributes.meta_business_app_status === 'offboarded' || attributes.meta_business_app_status === 'not_applicable' ? { meta_business_app_status: attributes.meta_business_app_status } : {}), ...(typeof attributes.meta_history_available === 'boolean' ? { meta_history_available: attributes.meta_history_available } : {}), ...(typeof attributes.meta_history_authorized === 'boolean' ? { meta_history_authorized: attributes.meta_history_authorized } : {}), ...(attributes.meta_history_status === 'not_available' || attributes.meta_history_status === 'waiting' || attributes.meta_history_status === 'receiving' || attributes.meta_history_status === 'ready' || attributes.meta_history_status === 'importing' || attributes.meta_history_status === 'synced' || attributes.meta_history_status === 'failed' ? { meta_history_status: attributes.meta_history_status } : {}) } : null,
    evolutionInstanceName: typeof attributes.evolution_instance_name === 'string' ? attributes.evolution_instance_name : null,
    wahaSessionName: typeof attributes.waha_session_name === 'string' ? attributes.waha_session_name : null,
  };
};

export const whatsappProviderForInbox = (inbox: Inbox): WhatsAppProvider | null => {
  const config = whatsappConfigurationForInbox(inbox);
  return config?.transports.length === 1 ? config.transports[0] : null;
};

export const transportStatusesForInbox = (inbox: Inbox): Partial<Record<WhatsAppTransport, WhatsAppTransportStatus>> => {
  const configuration = whatsappConfigurationForInbox(inbox);
  if (!configuration) return {};
  const status = (transport: WhatsAppTransport, fallback: WhatsAppTransportStatus) => {
    const value = inbox.additionalAttributes[`${transport}_connection_status`];
    return value === 'connected' || value === 'disconnected' || value === 'pending' ? value : fallback;
  };
  return Object.fromEntries(configuration.transports.map(transport => [transport, status(transport, transport === 'meta_cloud' ? 'connected' : 'pending')])) as Partial<Record<WhatsAppTransport, WhatsAppTransportStatus>>;
};

export const metaCloudMetadataForInbox = (inbox: Inbox): MetaCloudInboxMetadata | null => {
  const attributes = inbox.additionalAttributes;
  if (!whatsappConfigurationForInbox(inbox)?.transports.includes('meta_cloud') || typeof attributes.meta_waba_id !== 'string' || typeof attributes.meta_phone_number_id !== 'string') return null;
  return {
    whatsapp_provider: 'meta_cloud', whatsapp_mode: whatsappConfigurationForInbox(inbox)?.mode, whatsapp_transports: whatsappConfigurationForInbox(inbox)?.transports, meta_waba_id: attributes.meta_waba_id, meta_phone_number_id: attributes.meta_phone_number_id,
    meta_display_phone_number: typeof attributes.meta_display_phone_number === 'string' ? attributes.meta_display_phone_number : null,
    ...(attributes.meta_onboarding_mode === 'coexistence' || attributes.meta_onboarding_mode === 'standard' ? { meta_onboarding_mode: attributes.meta_onboarding_mode } : {}),
    ...(attributes.meta_business_app_status === 'active' || attributes.meta_business_app_status === 'offboarded' || attributes.meta_business_app_status === 'not_applicable' ? { meta_business_app_status: attributes.meta_business_app_status } : {}),
    ...(typeof attributes.meta_history_available === 'boolean' ? { meta_history_available: attributes.meta_history_available } : {}),
    ...(typeof attributes.meta_history_authorized === 'boolean' ? { meta_history_authorized: attributes.meta_history_authorized } : {}),
    ...(attributes.meta_history_status === 'not_available' || attributes.meta_history_status === 'waiting' || attributes.meta_history_status === 'receiving' || attributes.meta_history_status === 'ready' || attributes.meta_history_status === 'importing' || attributes.meta_history_status === 'synced' || attributes.meta_history_status === 'failed' ? { meta_history_status: attributes.meta_history_status } : {}),
  };
};

const externalNamespace: Record<WhatsAppProvider, 'evolution' | 'waha' | 'meta'> = { evolution: 'evolution', waha: 'waha', meta_cloud: 'meta' };
export const externalMessageId = (provider: WhatsAppProvider, id: string) => `${externalNamespace[provider]}:${id}`;

export const parseExternalMessageId = (value: string | null | undefined): { provider: WhatsAppProvider; id: string } | null => {
  if (typeof value !== 'string') return null;
  const match = /^(evolution|waha|meta):(.+)$/.exec(value);
  if (!match || !match[2]) return null;
  return { provider: match[1] === 'meta' ? 'meta_cloud' : match[1] as 'evolution' | 'waha', id: match[2] };
};
