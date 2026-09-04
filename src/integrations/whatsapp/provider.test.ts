import { describe, expect, it } from 'vitest';
import { externalMessageId, isNativeWhatsAppInbox, metaCloudMetadataForInbox, metaHistoryStatusForInbox, parseExternalMessageId, transportStatusesForInbox, whatsappConfigurationForInbox, whatsappProviderForInbox } from './provider';

const inbox = { id: 1, name: 'WhatsApp', avatarUrl: null, channelType: 'Channel::Api', channelId: 1, webhookUrl: null, inboxIdentifier: 'token', additionalAttributes: {} };

describe('WhatsApp providers', () => {
  it('mantém a identificação das inboxes Evolution legadas', () => {
    const legacy = { ...inbox, additionalAttributes: { evolution_provider: 'evolution' } };
    expect(whatsappProviderForInbox(legacy)).toBe('evolution');
    expect(whatsappConfigurationForInbox(legacy)).toMatchObject({ mode: 'web', transports: ['evolution'] });
  });

  it('normaliza conexões não oficiais e oficiais na mesma inbox', () => {
    expect(whatsappConfigurationForInbox({ ...inbox, additionalAttributes: { whatsapp_provider: 'evolution', whatsapp_transports: ['evolution'], evolution_provider: 'evolution' } })).toMatchObject({ mode: 'web', transports: ['evolution'] });
    expect(whatsappConfigurationForInbox({ ...inbox, additionalAttributes: { whatsapp_provider: 'meta_cloud', meta_waba_id: 'waba', meta_phone_number_id: 'phone' } })).toMatchObject({ mode: 'official', transports: ['meta_cloud'] });
    expect(whatsappConfigurationForInbox({ ...inbox, additionalAttributes: { whatsapp_transports: ['meta_cloud', 'evolution'], meta_waba_id: 'waba', meta_phone_number_id: 'phone', evolution_instance_name: 'cw-x' } })).toMatchObject({ mode: 'official', transports: ['meta_cloud', 'evolution'], evolutionInstanceName: 'cw-x' });
    expect(whatsappConfigurationForInbox({ ...inbox, additionalAttributes: { whatsapp_transports: ['waha'], waha_session_name: 'empresa' } })).toMatchObject({ mode: 'web', transports: ['waha'], wahaSessionName: 'empresa' });
  });

  it('identifica Meta Cloud somente por metadados explícitos', () => {
    const meta = { ...inbox, additionalAttributes: { whatsapp_provider: 'meta_cloud', meta_waba_id: 'waba-1', meta_phone_number_id: 'phone-1', meta_display_phone_number: '+55 11 99999-9999' } };
    expect(whatsappProviderForInbox(meta)).toBe('meta_cloud');
    expect(metaCloudMetadataForInbox(meta)).toMatchObject({ meta_waba_id: 'waba-1', meta_phone_number_id: 'phone-1' });
  });

  it('mantém Channel::Whatsapp nativo fora da camada de transportes do bridge', () => {
    const native = { ...inbox, channelType: 'Channel::Whatsapp', additionalAttributes: {} };
    expect(isNativeWhatsAppInbox(native)).toBe(true);
    expect(whatsappConfigurationForInbox(native)).toBeNull();
    expect(metaCloudMetadataForInbox(native)).toBeNull();
  });

  it('expõe o lifecycle History nativo sem criar metadados de bridge', () => {
    const native = { ...inbox, channelType: 'Channel::Whatsapp', additionalAttributes: { meta_history_status: 'syncing' } };
    expect(metaHistoryStatusForInbox(native)).toBe('syncing');
    expect(whatsappConfigurationForInbox(native)).toBeNull();
  });

  it('namespaceia e interpreta IDs externos sem misturar provedores', () => {
    expect(externalMessageId('evolution', 'BAE5')).toBe('evolution:BAE5');
    expect(externalMessageId('waha', 'ABC')).toBe('waha:ABC');
    expect(externalMessageId('meta_cloud', 'wamid.1')).toBe('meta:wamid.1');
    expect(parseExternalMessageId('evolution:BAE5')).toEqual({ provider: 'evolution', id: 'BAE5' });
    expect(parseExternalMessageId('meta:wamid.1')).toEqual({ provider: 'meta_cloud', id: 'wamid.1' });
    expect(parseExternalMessageId('waha:ABC')).toEqual({ provider: 'waha', id: 'ABC' });
    expect(parseExternalMessageId('BAE5')).toBeNull();
  });

  it('mantém status público independente por transport', () => {
    const hybrid = { ...inbox, additionalAttributes: { whatsapp_transports: ['meta_cloud', 'evolution'], meta_connection_status: 'connected', evolution_connection_status: 'disconnected' } };
    expect(transportStatusesForInbox(hybrid)).toEqual({ meta_cloud: 'connected', evolution: 'disconnected' });
  });

  it('mantém coexistência Meta independente de outras conexões vinculadas', () => {
    const hybridCoexistence = { ...inbox, additionalAttributes: { whatsapp_transports: ['meta_cloud', 'evolution'], meta_waba_id: 'waba', meta_phone_number_id: 'phone', meta_onboarding_mode: 'coexistence', meta_business_app_status: 'active', meta_history_status: 'waiting' } };
    expect(whatsappConfigurationForInbox(hybridCoexistence)).toMatchObject({ mode: 'official', transports: ['meta_cloud', 'evolution'] });
    expect(metaCloudMetadataForInbox(hybridCoexistence)).toMatchObject({ meta_onboarding_mode: 'coexistence', meta_business_app_status: 'active', meta_history_status: 'waiting' });
  });
});
