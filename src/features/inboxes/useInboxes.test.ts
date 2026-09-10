import { describe, expect, it } from 'vitest';
import { mergeRealtimeInbox, removeInboxForAccount } from './useInboxes';

const inbox = (id: number, name: string, status: string) => ({
  id, name, avatarUrl: null, channelType: 'Channel::Api', channelId: id, webhookUrl: null, inboxIdentifier: `token-${id}`,
  additionalAttributes: { waha_connection_status: status },
});

describe('removeInboxForAccount', () => {
  const current = [inbox(41, 'Synthetic One', 'connected'), inbox(42, 'Synthetic Two', 'connected')];

  it('remove somente a inbox confirmada da conta ativa', () => {
    const updated = removeInboxForAccount(current, 7, 7, 41);
    expect(updated.map(item => item.id)).toEqual([42]);
  });

  it('preserva a lista para outra conta ou outro id de inbox', () => {
    expect(removeInboxForAccount(current, 7, 8, 41)).toBe(current);
    expect(removeInboxForAccount(current, 7, 7, 99)).toBe(current);
  });
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
