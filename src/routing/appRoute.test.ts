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
    expect(urlForAppRoute({ accountId: '35', tab: 'settings', settingsTab: 'caixas', settingsInboxId: '193' })).toBe('/app/accounts/35/settings/inboxes/193');
    expect(route('/app/accounts/42/contacts')).toEqual({ accountId: '42', tab: 'communities' });
    expect(route('/app/accounts/42/calls')).toEqual({ accountId: '42', tab: 'calls' });
    expect(route('/app/accounts/42/apps/99')).toEqual({ accountId: '42', tab: 'media', appId: '99' });
    expect(urlForAppRoute({ accountId: '42', tab: 'media', appId: '99' })).toBe('/app/accounts/42/apps/99');
    expect(route('/unknown')).toEqual({ tab: 'chats' });
  });

  it('generates a stable canonical conversation link without inboxId', () => {
    expect(canonicalConversationPath(42, 698)).toBe('/app/accounts/42/conversations/698');
    expect(absoluteConversationUrl('https://kopla.example.test', 42, 698)).toBe('https://kopla.example.test/app/accounts/42/conversations/698');
    expect(canonicalConversationPath(42, 698)).not.toContain('inbox');
  });
});
