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
});
