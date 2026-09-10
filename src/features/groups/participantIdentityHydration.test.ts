// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConversationMessage } from '../../domain/currentUser';
import { authSession } from '../../integrations/chatwoot/authSession';
import { clearContactDetailsCache } from '../contacts/useContactDetails';
import { GroupParticipantIdentityClient, visibleGroupParticipantIdentityQueries } from './participantIdentityHydration';

const message = (overrides: Partial<ConversationMessage> = {}): ConversationMessage => ({
  id: 1, conversationId: 81, kind: 'incoming', contentType: 'text', content: 'oi', createdAt: 1, updatedAt: null,
  status: 'sent', senderId: 800, senderName: 'Equipe', senderPhoneNumber: null, senderAvatarUrl: null, origin: null,
  attachments: [], contentAttributes: { whatsapp_chat_type: 'group', whatsapp_remote_jid: '120@g.us', whatsapp_participant_jid: '123@lid' }, ...overrides,
});

describe('visible group participant identities', () => {
  beforeEach(() => { clearContactDetailsCache(); authSession.set({ accessToken: 'token', tokenType: 'Bearer', client: 'client', expiry: '9999999999', uid: 'agent@example.test' }); });

  it('usa participant_contact_id antes do sender_id e suporta sender_id real', () => {
    expect(visibleGroupParticipantIdentityQueries([message({ contentAttributes: { whatsapp_remote_jid: '120@g.us', whatsapp_participant_contact_id: 91 } })])).toEqual([{ contactId: 91, aliases: [] }]);
    expect(visibleGroupParticipantIdentityQueries([message({ senderId: 92, contentAttributes: { whatsapp_remote_jid: '120@g.us' } })])).toEqual([{ contactId: 92, aliases: [] }]);
  });

  it('deduplica autores visíveis por alias LID e ignora mensagens completas/privadas', () => {
    const queries = visibleGroupParticipantIdentityQueries([
      message({ id: 1 }), message({ id: 2 }),
      message({ id: 3, senderId: 91, senderName: 'Maria', senderPhoneNumber: '+5544999999999', senderAvatarUrl: 'maria.jpg' }),
      message({ id: 4, contentAttributes: { whatsapp_remote_jid: '5544999999999@c.us' } }),
    ]);
    expect(queries).toEqual([{ contactId: 800, aliases: ['123@lid'] }]);
  });

  it('faz um batch, reutiliza RAM e não consulta metadata/provider', async () => {
    const client = new GroupParticipantIdentityClient();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ participants: [{ jid: '123@lid', contactId: 91, displayName: 'Maria', avatarUrl: 'maria.jpg' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);
    const queries = visibleGroupParticipantIdentityQueries([message({ id: 1 }), message({ id: 2 }), message({ id: 3, senderId: 801, contentAttributes: { whatsapp_remote_jid: '120@g.us', whatsapp_participant_jid: '456@lid' } })]);
    await client.resolve(1, 5, 81, queries);
    await client.resolve(1, 5, 81, [queries[0]]);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0][0])).toContain('/groups/participant-identities');
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('/groups/metadata');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ identifiers: [{ contactId: 800, aliases: ['123@lid'] }, { contactId: 801, aliases: ['456@lid'] }] });
    vi.unstubAllGlobals();
  });
});
