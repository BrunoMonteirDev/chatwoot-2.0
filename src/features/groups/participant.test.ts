import { describe, expect, it } from 'vitest';
import { indexGroupParticipants, participantIdentityKeys, participantLabel } from './participant';

describe('group participant identity', () => {
  it('uses the participant name without a group-name prefix', () => {
    expect(participantLabel('Maria Silva', '5544999999999@c.us')).toBe('Maria Silva');
  });

  it('uses the number when the participant name is unavailable', () => {
    expect(participantLabel(undefined, '5544999999999@s.whatsapp.net')).toBe('+5544999999999');
  });

  it('never exposes a raw LID as fallback', () => {
    expect(participantLabel(undefined, '12345@lid')).toBe('');
    expect(participantLabel('Participante', '12345@lid')).toBe('');
    expect(participantLabel('Equipe', '12345@lid', undefined, 'Equipe')).toBe('');
  });

  it('indexes equivalent provider identities to the same participant metadata', () => {
    const participant = { jid: '19696904601705@lid', lid: '19696904601705@lid', phoneJid: '554497755329@c.us', phone: '+554497755329', name: 'Maria' };
    const indexed = indexGroupParticipants([participant]);
    expect(participantIdentityKeys(participant)).toEqual(expect.arrayContaining(['19696904601705@lid', '554497755329@c.us', '554497755329@s.whatsapp.net', '554497755329']));
    expect(indexed['19696904601705@lid']?.name).toBe('Maria');
    expect(participantLabel(indexed['19696904601705@lid']?.name, indexed['19696904601705@lid']?.jid, indexed['19696904601705@lid']?.phone)).toBe('Maria');
    expect(participantLabel(undefined, indexed['19696904601705@lid']?.jid, indexed['19696904601705@lid']?.phone)).toBe('+554497755329');
  });

  it('replaces stale participant name and avatar when refreshed metadata is indexed', () => {
    const stale = indexGroupParticipants([{ jid: '123@lid', name: 'Nome antigo', avatarUrl: 'old.jpg' }]);
    const refreshed = indexGroupParticipants([{ jid: '123@lid', name: 'Nome atual', avatarUrl: 'new.jpg' }]);
    expect(stale['123@lid']).toMatchObject({ name: 'Nome antigo', avatarUrl: 'old.jpg' });
    expect(refreshed['123@lid']).toMatchObject({ name: 'Nome atual', avatarUrl: 'new.jpg' });
  });
});
