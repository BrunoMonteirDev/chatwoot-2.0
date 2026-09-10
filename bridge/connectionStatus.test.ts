import { describe, expect, it } from 'vitest';
import { ConnectionStatusOrder, connectionStatusPatch, evolutionConnectionStatus, metaConnectionStatus } from './connectionStatus';

describe('WhatsApp connection states', () => {
  it('normaliza disponibilidade da Evolution e preserva status WAHA persistível', () => {
    expect(evolutionConnectionStatus({ instance: { state: 'open' } })).toBe('connected');
    expect(evolutionConnectionStatus({ state: 'close' })).toBe('disconnected');
    expect(connectionStatusPatch('waha', 'connecting')).toMatchObject({ waha_connection_status: 'connecting', waha_connection_updated_at: expect.any(String) });
    expect(connectionStatusPatch('waha', 'connected', '2026-09-10T12:00:00Z').waha_connection_updated_at).toBe('2026-09-10T12:00:00.000Z');
  });

  it('trata Meta sem credencial como indisponível e preserva erro conhecido', () => {
    expect(metaConnectionStatus('connected', false)).toBe('disconnected');
    expect(metaConnectionStatus('error', true)).toBe('error');
  });

  it('impede evento antigo de sobrescrever um status novo e isola inboxes e contas', () => {
    const order = new ConnectionStatusOrder();
    expect(order.accept('1:3:waha', '2026-09-10T12:00:10Z')).toBe(true);
    expect(order.accept('1:3:waha', '2026-09-10T12:00:09Z')).toBe(false);
    expect(order.accept('1:4:waha', '2026-09-10T12:00:09Z')).toBe(true);
    expect(order.accept('2:3:waha', '2026-09-10T12:00:09Z')).toBe(true);
    expect(order.accept('1:3:waha:session-b', '2026-09-10T12:00:09Z')).toBe(true);
  });
});
