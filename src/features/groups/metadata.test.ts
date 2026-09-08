import { describe, expect, it } from 'vitest';
import { persistedGroupMetadata } from './metadata';

describe('persisted group metadata', () => {
  it('hydrates contact links and aliases before a provider refresh', () => {
    expect(persistedGroupMetadata({
      whatsapp_group_jid: '120@g.us',
      whatsapp_group_participants: [{ jid: '123@lid', lid: '123', phone_jid: '5544999999999@c.us', phone: '+5544999999999', display_name: 'João editado', contact_id: 44, admin: 'admin' }],
      whatsapp_group_participant_history: [{ jid: 'old@lid', phone: '+5544888888888', display_name: 'Ex-participante', contact_id: 45 }],
    }, 'waha', 'Equipe')).toMatchObject({
      subject: 'Equipe', memberCount: 1,
      participants: [{ contactId: 44, displayName: 'João editado', phoneJid: '5544999999999@c.us' }],
      historicalParticipants: [{ contactId: 45, displayName: 'Ex-participante' }],
    });
  });

  it('não trata conversa sem JID de grupo como metadata persistida', () => {
    expect(persistedGroupMetadata({ whatsapp_group_participants: [{ jid: '123@lid' }] }, 'waha')).toBeNull();
  });
});
