import { describe, expect, it } from 'vitest';
import { connectionStatusPatch, evolutionConnectionStatus, metaConnectionStatus } from './connectionStatus';

describe('WhatsApp connection states', () => {
  it('normaliza disponibilidade da Evolution e preserva status WAHA persistível', () => {
    expect(evolutionConnectionStatus({ instance: { state: 'open' } })).toBe('connected');
    expect(evolutionConnectionStatus({ state: 'close' })).toBe('disconnected');
    expect(connectionStatusPatch('waha', 'connecting')).toMatchObject({ waha_connection_status: 'connecting', waha_connection_updated_at: expect.any(String) });
  });

  it('trata Meta sem credencial como indisponível e preserva erro conhecido', () => {
    expect(metaConnectionStatus('connected', false)).toBe('disconnected');
    expect(metaConnectionStatus('error', true)).toBe('error');
  });
});
