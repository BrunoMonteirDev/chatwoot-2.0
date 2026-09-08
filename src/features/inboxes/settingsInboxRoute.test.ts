import { describe, expect, it } from 'vitest';
import { settingsInboxRouteState } from './settingsInboxRoute';

const inbox = (id: number) => ({
  id, name: `Inbox ${id}`, avatarUrl: null, channelType: 'Channel::Whatsapp', channelId: id,
  webhookUrl: null, inboxIdentifier: `inbox-${id}`, additionalAttributes: {},
});

describe('settings inbox route state', () => {
  it('keeps a direct inbox route pending while its account inboxes are loading, then selects it when it arrives', () => {
    expect(settingsInboxRouteState(123, [], 'loading')).toBe('pending');
    expect(settingsInboxRouteState(123, [inbox(123)], 'ready')).toBe('selected');
  });

  it('marks an inbox route missing only after loading has completed', () => {
    expect(settingsInboxRouteState(999, [], 'loading')).toBe('pending');
    expect(settingsInboxRouteState(999, [inbox(123)], 'ready')).toBe('missing');
  });
});
