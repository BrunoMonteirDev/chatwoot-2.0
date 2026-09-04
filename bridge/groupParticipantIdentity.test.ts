import { describe, expect, it } from 'vitest';
import { GroupParticipantIdentityCache, resolveGroupParticipantIdentity } from './groupParticipantIdentity';

describe('group participant identity', () => {
  it('prefers a provider phone JID, preserves name and avatar, and never derives a phone from a LID', () => {
    expect(resolveGroupParticipantIdentity({ participant: '19696904601705@lid', participantAlt: '5511999999999@c.us', pushName: 'Ana', avatarUrl: 'https://avatar' })).toEqual({ providerId: '5511999999999@c.us', lid: '19696904601705', phoneJid: '5511999999999@c.us', phone: '+5511999999999', displayName: 'Ana', avatarUrl: 'https://avatar' });
    expect(resolveGroupParticipantIdentity({ participant: '19696904601705@lid' })).toEqual({ providerId: '19696904601705@lid', lid: '19696904601705' });
  });

  it('scopes LID cache by account, inbox and session', () => {
    const cache = new GroupParticipantIdentityCache(); const identity = resolveGroupParticipantIdentity({ participant: 'same@lid', participantAlt: '5511@c.us' });
    cache.set({ accountId: 1, inboxId: 2, session: 'a' }, identity);
    expect(cache.get({ accountId: 1, inboxId: 2, session: 'a' }, 'same')).toEqual(identity);
    expect(cache.get({ accountId: 2, inboxId: 2, session: 'a' }, 'same')).toBeUndefined();
    expect(cache.get({ accountId: 1, inboxId: 3, session: 'a' }, 'same')).toBeUndefined();
    expect(cache.get({ accountId: 1, inboxId: 2, session: 'b' }, 'same')).toBeUndefined();
  });
});
