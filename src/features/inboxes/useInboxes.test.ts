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

  it('não deixa snapshot antigo sobrescrever status novo nem contaminar outra inbox', () => {
    const current = [
      { ...inbox(1, 'Suporte', 'connected'), additionalAttributes: { waha_connection_status: 'connected', waha_connection_updated_at: '2026-09-10T12:00:10Z' } },
      { ...inbox(2, 'Vendas', 'connected'), additionalAttributes: { waha_connection_status: 'connected', waha_connection_updated_at: '2026-09-10T12:00:10Z' } },
    ];
    const merged = mergeRealtimeInbox(current, { ...inbox(1, 'Suporte', 'disconnected'), additionalAttributes: { waha_connection_status: 'disconnected', waha_connection_updated_at: '2026-09-10T12:00:09Z' } });
    expect(merged.find(item => item.id === 1)?.additionalAttributes.waha_connection_status).toBe('connected');
    expect(merged.find(item => item.id === 2)?.additionalAttributes.waha_connection_status).toBe('connected');
  });

  it('não reaproveita status de uma sessão antiga após troca de binding', () => {
    const previous = { ...inbox(1, 'Suporte', 'connected'), additionalAttributes: { waha_session_name: 'session-a', waha_connection_status: 'connected', waha_connection_updated_at: '2026-09-10T12:00:10Z' } };
    const updated = { ...inbox(1, 'Suporte', 'disconnected'), additionalAttributes: { waha_session_name: 'session-b', waha_connection_status: 'disconnected', waha_connection_updated_at: '2026-09-10T12:00:09Z' } };
    expect(mergeRealtimeInbox([previous], updated)[0].additionalAttributes.waha_connection_status).toBe('disconnected');
  });
});
