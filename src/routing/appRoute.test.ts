import { describe, expect, it } from 'vitest';
import { absoluteConversationUrl, appRouteFromUrl, canonicalConversationPath, urlForAppRoute } from './appRoute';

const route = (path: string) => appRouteFromUrl(new URL(path, 'https://app.example.test'));

describe('app routes', () => {
  it('maps a conversation URL and preserves its inbox filter', () => {
    expect(route('/app/accounts/42/inbox/106/conversations/698')).toEqual({ accountId: '42', tab: 'chats', conversationId: '698', inbox: '106' });
    expect(urlForAppRoute({ accountId: '42', tab: 'chats', conversationId: '698', inbox: '106' })).toBe('/app/accounts/42/inbox/106/conversations/698');
    expect(urlForAppRoute({ accountId: '42', tab: 'chats', conversationId: '698' })).toBe('/app/accounts/42/conversations/698');
    expect(route('/app/accounts/42/inbox/254')).toEqual({ accountId: '42', tab: 'chats', inbox: '254' });
    expect(urlForAppRoute({ accountId: '42', tab: 'chats', inbox: '254' })).toBe('/app/accounts/42/inbox/254');
  });

  it('maps routes for settings and primary application pages', () => {
    expect(route('/app/accounts/42/settings/caixas')).toEqual({ accountId: '42', tab: 'settings', settingsTab: 'caixas' });
    expect(route('/app/accounts/35/settings/inboxes/193')).toEqual({ accountId: '35', tab: 'settings', settingsTab: 'caixas', settingsInboxId: '193' });
    expect(route('/app/accounts/35/settings/caixas/193')).toEqual({ accountId: '35', tab: 'settings', settingsTab: 'caixas', settingsInboxId: '193' });
    expect(urlForAppRoute({ accountId: '35', tab: 'settings', settingsTab: 'caixas', settingsInboxId: '193' })).toBe('/app/accounts/35/settings/caixas/193');
    expect(route('/app/accounts/42/contacts')).toEqual({ accountId: '42', tab: 'communities' });
    expect(route('/app/accounts/42/calls')).toEqual({ accountId: '42', tab: 'calls' });
    expect(route('/app/accounts/42/apps/99')).toEqual({ accountId: '42', tab: 'media', appId: '99' });
    expect(urlForAppRoute({ accountId: '42', tab: 'media', appId: '99' })).toBe('/app/accounts/42/apps/99');
    expect(route('/unknown')).toEqual({ tab: 'chats' });
  });

  it('keeps a selected settings inbox in route state across direct loads and history entries', () => {
    const selected = route('/app/accounts/42/settings/caixas/123');
    const list = route('/app/accounts/42/settings/caixas');

    expect(selected).toEqual({ accountId: '42', tab: 'settings', settingsTab: 'caixas', settingsInboxId: '123' });
    expect(route(urlForAppRoute(selected))).toEqual(selected);
    expect(list).toEqual({ accountId: '42', tab: 'settings', settingsTab: 'caixas' });
    expect(route('/app/accounts/42/settings/caixas/not-an-inbox')).toEqual({ tab: 'chats' });
  });

  it('maps every inbox creation step and preserves it across a fresh parse', () => {
    const channel = route('/app/accounts/42/settings/caixas/new');
    const whatsapp = route('/app/accounts/42/settings/caixas/new/whatsapp');
    const waha = route('/app/accounts/42/settings/caixas/new/whatsapp?provider=waha');
    const meta = route('/app/accounts/42/settings/caixas/new/whatsapp?provider=meta');
    const hybrid = route('/app/accounts/42/settings/caixas/new/whatsapp?provider=hybrid');
    const agents = route('/app/accounts/42/settings/caixas/new/731/agents');

    expect(channel.inboxCreation).toEqual({ step: 'channel' });
    expect(whatsapp.inboxCreation).toEqual({ step: 'whatsapp' });
    expect(waha.inboxCreation).toEqual({ step: 'whatsapp', provider: 'waha' });
    expect(meta.inboxCreation).toEqual({ step: 'whatsapp', provider: 'meta' });
    expect(hybrid.inboxCreation).toEqual({ step: 'whatsapp', provider: 'hybrid' });
    expect(agents.inboxCreation).toEqual({ step: 'agents', inboxId: '731' });
    expect(urlForAppRoute(waha)).toBe('/app/accounts/42/settings/caixas/new/whatsapp?provider=waha');
    expect(urlForAppRoute(agents)).toBe('/app/accounts/42/settings/caixas/new/731/agents');
    for (const creationRoute of [channel, whatsapp, waha, meta, hybrid, agents]) {
      expect(route(urlForAppRoute(creationRoute))).toEqual(creationRoute);
    }
  });

  it('isolates wizard state by account and safely normalizes invalid creation routes', () => {
    expect(route('/app/accounts/84/settings/caixas/new/whatsapp?provider=waha').accountId).toBe('84');
    expect(route('/app/accounts/85/settings/caixas/new').inboxCreation).toEqual({ step: 'channel' });
    expect(route('/app/accounts/84/settings/caixas/new/whatsapp?provider=unknown').inboxCreation).toEqual({ step: 'whatsapp' });
    expect(route('/app/accounts/84/settings/caixas/new/not-an-inbox/agents').inboxCreation).toEqual({ step: 'channel' });
  });

  it('restores the correct wizard step from browser back and forward entries', () => {
    const entries = [
      '/app/accounts/42/settings/caixas/new',
      '/app/accounts/42/settings/caixas/new/whatsapp',
      '/app/accounts/42/settings/caixas/new/whatsapp?provider=waha',
    ];
    expect(route(entries[1]).inboxCreation).toEqual({ step: 'whatsapp' });
    expect(route(entries[0]).inboxCreation).toEqual({ step: 'channel' });
    expect(route(entries[2]).inboxCreation).toEqual({ step: 'whatsapp', provider: 'waha' });
  });

  it('generates a stable canonical conversation link without inboxId', () => {
    expect(canonicalConversationPath(42, 698)).toBe('/app/accounts/42/conversations/698');
    expect(absoluteConversationUrl('https://kopla.example.test', 42, 698)).toBe('https://kopla.example.test/app/accounts/42/conversations/698');
    expect(canonicalConversationPath(42, 698)).not.toContain('inbox');
  });
});
