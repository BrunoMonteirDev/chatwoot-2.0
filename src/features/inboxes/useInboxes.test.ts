import { describe, expect, it } from 'vitest';
import { mergeRealtimeInbox } from './useInboxes';

const inbox = (id: number, name: string, status: string) => ({
  id, name, avatarUrl: null, channelType: 'Channel::Api', channelId: id, webhookUrl: null, inboxIdentifier: `token-${id}`,
  additionalAttributes: { waha_connection_status: status },
});

describe('mergeRealtimeInbox', () => {
  it('substitui somente a inbox alterada, preservando o status WhatsApp recebido pelo cable', () => {
    const merged = mergeRealtimeInbox([inbox(1, 'Suporte', 'connected'), inbox(2, 'Vendas', 'connected')], inbox(1, 'Suporte', 'disconnected'));
    expect(merged.find((item) => item.id === 1)?.additionalAttributes.waha_connection_status).toBe('disconnected');
    expect(merged.find((item) => item.id === 2)?.additionalAttributes.waha_connection_status).toBe('connected');
  });

  it('aplica inbox.updated de Meta nativo sem afetar inboxes WAHA', () => {
    const nativeMeta = { id: 3, name: 'Meta', avatarUrl: null, channelType: 'Channel::Whatsapp', channelId: 3, webhookUrl: null, inboxIdentifier: null, additionalAttributes: { meta_connection_status: 'connected' } };
    const offline = { ...nativeMeta, additionalAttributes: { meta_connection_status: 'disconnected', meta_connection_last_error: 'Partner removed' } };
    const merged = mergeRealtimeInbox([inbox(1, 'Suporte', 'connected'), nativeMeta], offline);
    expect(merged.find((item) => item.id === 3)?.additionalAttributes.meta_connection_status).toBe('disconnected');
    expect(merged.find((item) => item.id === 1)?.additionalAttributes.waha_connection_status).toBe('connected');
  });
});
