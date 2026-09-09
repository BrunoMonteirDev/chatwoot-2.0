// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GroupMetadataClient, persistedGroupMetadata } from './metadata';
import { MemoryGroupMetadataPersistence } from './GroupMetadataPersistence';
import { authSession } from '../../integrations/chatwoot/authSession';

describe('persisted group metadata', () => {
  beforeEach(() => authSession.set({ accessToken: 'token', tokenType: 'Bearer', client: 'client', expiry: '1', uid: 'agent@example.test' }));
  afterEach(() => { authSession.clear(); vi.unstubAllGlobals(); });
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

  it('hidrata metadata persistida sem consultar bridge enquanto está fresh', async () => {
    const persistence = new MemoryGroupMetadataPersistence();
    await persistence.put({ key: '1:2:3:waha', accountId: 1, inboxId: 2, conversationId: 3, updatedAt: 100, group: { id: '120@g.us', subject: 'Equipe', transport: 'waha', participants: [], canEditDescription: true } });
    vi.stubGlobal('fetch', vi.fn());
    const client = new GroupMetadataClient(persistence, () => 101);
    expect(await client.get(1, 2, 3, 'waha')).toMatchObject({ group: { subject: 'Equipe' } });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('deduplica refresh stale e persiste a resposta nova', async () => {
    const persistence = new MemoryGroupMetadataPersistence();
    await persistence.put({ key: '1:2:3:waha', accountId: 1, inboxId: 2, conversationId: 3, updatedAt: 0, group: { id: '120@g.us', subject: 'Antigo', transport: 'waha', participants: [], canEditDescription: true } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ group: { id: '120@g.us', subject: 'Novo', transport: 'waha', participants: [], canEditDescription: true } }), { status: 200 })));
    const client = new GroupMetadataClient(persistence, () => 400_000);
    const [first, second] = await Promise.all([client.get(1, 2, 3, 'waha'), client.get(1, 2, 3, 'waha')]);
    expect(first.group.subject).toBe('Novo'); expect(second.group.subject).toBe('Novo'); expect(fetch).toHaveBeenCalledTimes(1);
    expect((await persistence.get('1:2:3:waha'))?.group.subject).toBe('Novo');
  });
});
