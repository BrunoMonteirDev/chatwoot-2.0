import { describe, expect, it, vi } from 'vitest';
import { discoverConfiguredWahaGroupScopes, wahaGroupScopeForInbox } from './wahaGroupScopeDiscovery';

const apiInbox = (id: number, sessionName: string) => ({
  id, name: `Synthetic inbox ${id}`, channel_type: 'Channel::Api', inbox_identifier: `synthetic-${id}`,
  additional_attributes: { whatsapp_transports: ['waha'], waha_session_name: sessionName },
});

describe('WAHA group scope discovery', () => {
  it('aceita uma instalação totalmente vazia sem consultar inboxes', async () => {
    const listInboxes = vi.fn();
    await expect(discoverConfiguredWahaGroupScopes({ listAccountIds: async () => [], listInboxes })).resolves.toEqual([]);
    expect(listInboxes).not.toHaveBeenCalled();
  });

  it('descobre bindings API e híbridos sem IDs ou nomes predefinidos', () => {
    expect(wahaGroupScopeForInbox(47, apiInbox(608, 'tenant-session-x'))).toEqual({ accountId: 47, inboxId: 608, sessionName: 'tenant-session-x' });
    expect(wahaGroupScopeForInbox(73, { id: 904, channel_type: 'Channel::Whatsapp', additional_attributes: { hybrid_enabled: true, hybrid_waha_session: 'native-session-y' } })).toEqual({ accountId: 73, inboxId: 904, sessionName: 'native-session-y' });
    expect(wahaGroupScopeForInbox(73, { id: 905, channel_type: 'Channel::Whatsapp', additional_attributes: { hybrid_enabled: false } })).toBeNull();
    expect(wahaGroupScopeForInbox(73, { id: 906, channel_type: 'Channel::Api', additional_attributes: { whatsapp_transports: ['evolution'], waha_session_name: 'stale-session' } })).toBeNull();
  });

  it('mantém duas accounts e várias inboxes/sessões isoladas', async () => {
    const inboxes = new Map([
      [47, [apiInbox(608, 'tenant-session-x'), apiInbox(609, 'tenant-session-z')]],
      [73, [apiInbox(904, 'tenant-session-y')]],
    ]);
    const scopes = await discoverConfiguredWahaGroupScopes({
      listAccountIds: async () => [47, 73, 47],
      listInboxes: async accountId => inboxes.get(accountId) || [],
    });
    expect(scopes).toEqual([
      { accountId: 47, inboxId: 608, sessionName: 'tenant-session-x' },
      { accountId: 47, inboxId: 609, sessionName: 'tenant-session-z' },
      { accountId: 73, inboxId: 904, sessionName: 'tenant-session-y' },
    ]);
  });

  it('uma account indisponível não bloqueia os outros tenants', async () => {
    const warn = vi.fn();
    await expect(discoverConfiguredWahaGroupScopes({
      listAccountIds: async () => [47, 73],
      listInboxes: async accountId => { if (accountId === 47) throw new Error('synthetic unavailable'); return [apiInbox(904, 'tenant-session-y')]; },
      log: { warn },
    })).resolves.toEqual([{ accountId: 73, inboxId: 904, sessionName: 'tenant-session-y' }]);
    expect(warn).toHaveBeenCalledWith('[groups] account scope discovery skipped', expect.objectContaining({ accountId: 47, error: 'synthetic unavailable' }));
  });
});
