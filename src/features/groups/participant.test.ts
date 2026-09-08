import { describe, expect, it } from 'vitest';
import { indexGroupParticipants, participantIdentityKeys, participantLabel } from './participant';

describe('group participant identity', () => {
  it('uses the participant name without a group-name prefix', () => {
    expect(participantLabel('Maria Silva', '5544999999999@c.us')).toBe('Maria Silva');
  });

  it('uses the number when the participant name is unavailable', () => {
    expect(participantLabel(undefined, '5544999999999@s.whatsapp.net')).toBe('+5544999999999');
  });

  it('indexes equivalent provider identities to the same participant metadata', () => {
    const keys = participantIdentityKeys({ jid: '123@lid', phoneJid: '5544999999999@c.us', phone: '+55 44 99999-9999' });
    expect(keys).toEqual(expect.arrayContaining(['123@lid', '5544999999999@c.us', '5544999999999@s.whatsapp.net', '5544999999999']));
  });

  it('replaces stale participant name and avatar when refreshed metadata is indexed', () => {
    const stale = indexGroupParticipants([{ jid: '123@lid', name: 'Nome antigo', avatarUrl: 'old.jpg' }]);
    const refreshed = indexGroupParticipants([{ jid: '123@lid', name: 'Nome atual', avatarUrl: 'new.jpg' }]);
    expect(stale['123@lid']).toMatchObject({ name: 'Nome antigo', avatarUrl: 'old.jpg' });
    expect(refreshed['123@lid']).toMatchObject({ name: 'Nome atual', avatarUrl: 'new.jpg' });
  });
});
