import { describe, expect, it } from 'vitest';
import { externalMessageId, parseExternalMessageId, providerForInbox, resolveMessageOperationTransport, resolveOutgoingTransport, resolveTransportRoute, transportConfigurationForInbox } from './providers';

describe('bridge provider routing', () => {
  it('reconhece Evolution legada e Meta Cloud explícita', () => {
    expect(providerForInbox({ evolution_provider: 'evolution' })).toBe('evolution');
    expect(providerForInbox({ whatsapp_provider: 'meta_cloud' })).toBe('meta_cloud');
  });

  it('mantém namespace de IDs por provider', () => {
    expect(externalMessageId('evolution', 'id')).toBe('evolution:id');
    expect(externalMessageId('waha', 'msg.id')).toBe('waha:msg.id');
    expect(externalMessageId('meta_cloud', 'wamid.id')).toBe('meta:wamid.id');
    expect(parseExternalMessageId('waha:msg.id')).toEqual({ provider: 'waha', id: 'msg.id' });
    expect(parseExternalMessageId('invalid')).toBeNull();
  });

  it('usa WAHA como transport web após o adapter de mensagens', () => {
    const configuration = transportConfigurationForInbox({ whatsapp_transports: ['waha'], waha_session_name: 'empresa-a' });
    expect(configuration).toMatchObject({ mode: 'web', transports: ['waha'], wahaSessionName: 'empresa-a' });
    expect(resolveOutgoingTransport({ configuration: configuration! })).toBe('waha');
    expect(resolveMessageOperationTransport({ sourceId: 'waha:msg-1' })).toBe('waha');
  });

  it('mantém transports e status de roteamento independentes no híbrido', () => {
    const configuration = transportConfigurationForInbox({ whatsapp_transports: ['meta_cloud', 'evolution'], evolution_instance_name: 'cw-complementar' });
    expect(configuration).toMatchObject({ mode: 'hybrid', transports: ['meta_cloud', 'evolution'], evolutionInstanceName: 'cw-complementar' });
    expect(resolveOutgoingTransport({ configuration: configuration! })).toBe('meta_cloud');
    expect(resolveOutgoingTransport({ configuration: configuration!, chatType: 'group' })).toBe('evolution');
  });

  it('resolve operações pelo transport da mensagem, e não pelo modo híbrido', () => {
    expect(resolveMessageOperationTransport({ sourceId: 'evolution:BAE5', contentAttributes: { whatsapp_transport: 'evolution' } })).toBe('evolution');
    expect(resolveMessageOperationTransport({ sourceId: 'meta:wamid.1', contentAttributes: { whatsapp_transport: 'meta_cloud' } })).toBe('meta_cloud');
    expect(resolveMessageOperationTransport({ sourceId: 'invalid' })).toBeNull();
  });

  it('centraliza capacidades e nunca atravessa o transport da mensagem alvo', () => {
    const configuration = transportConfigurationForInbox({ whatsapp_transports: ['meta_cloud', 'evolution'] })!;
    expect(resolveTransportRoute({ configuration, operation: 'reaction', target: { sourceId: 'evolution:3EB' } })).toEqual({ transport: 'evolution' });
    expect(resolveTransportRoute({ configuration, operation: 'group_message', chatType: 'group' })).toEqual({ transport: 'evolution' });
    expect(resolveTransportRoute({ configuration: transportConfigurationForInbox({ whatsapp_transports: ['meta_cloud'] })!, operation: 'group_message', chatType: 'group' })).toEqual({ transport: null, reason: 'transport_unavailable' });
    expect(resolveTransportRoute({ configuration, operation: 'edit', target: { sourceId: 'meta:wamid.1' } })).toEqual({ transport: null, reason: 'unsupported_operation' });
  });
});
