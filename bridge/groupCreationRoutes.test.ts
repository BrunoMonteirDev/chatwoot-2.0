import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createServer, type Server } from 'node:http';
import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

let bridgeServer: Server; let railsServer: Server; let base: string; let dir: string;
let waha: typeof import('./waha').wahaTransport; let chatwoot: typeof import('./chatwoot').chatwootBridge; let groupMetadataBackfill: typeof import('./index').groupMetadataBackfill;
let evolution: typeof import('./evolution').evolutionBridge;
const headers = { 'Content-Type': 'application/json', 'access-token': 'token', 'token-type': 'Bearer', client: 'client', expiry: '9999999999', uid: 'agent@example.test' };
const post = (path: string, body: Record<string, unknown>) => fetch(`${base}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
const postWaha = (body: Record<string, unknown>) => {
  const raw = JSON.stringify(body);
  return fetch(`${base}/webhooks/waha`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-webhook-hmac': createHmac('sha512', 'synthetic-waha-secret').update(raw).digest('hex') }, body: raw });
};
const inbox = (id: number, name: string, session: string) => ({ id, name, channel_type: 'Channel::Api', inbox_identifier: `api-${id}`, additional_attributes: { whatsapp_transports: ['waha'], waha_session_name: session } });

beforeAll(async () => {
  dir = await mkdtemp(`${tmpdir()}/group-creation-routes-`);
  railsServer = createServer((_request, response) => { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ account_id: 1, role: 'administrator', accounts: [{ id: 1, role: 'administrator' }] })); });
  railsServer.listen(0, '127.0.0.1'); await new Promise<void>(resolve => railsServer.once('listening', resolve));
  const railsBase = `http://127.0.0.1:${(railsServer.address() as { port: number }).port}`;
  for (const [key, value] of Object.entries({ NODE_ENV: 'test', BRIDGE_WEBHOOK_SECRET: 'test', BRIDGE_PUBLIC_URL: 'https://bridge.synthetic.example', CHATWOOT_BASE_URL: railsBase, BRIDGE_REDIS_URL: '', WAHA_BASE_URL: 'http://waha.test', WAHA_API_KEY: 'key', WAHA_WEBHOOK_SECRET: 'synthetic-waha-secret', BRIDGE_DEDUP_FILE: `${dir}/dedup.json`, BRIDGE_IDENTITY_FILE: `${dir}/identities.json`, BRIDGE_GROUP_CREATION_FILE: `${dir}/creations.json`, BRIDGE_WAHA_SESSION_OWNERSHIP_FILE: `${dir}/sessions.json` })) vi.stubEnv(key, value);
  const Store = (await import('./wahaSessionStore')).WahaSessionStore; const store = new Store(`${dir}/sessions.json`);
  await store.reserve({ accountId: 1, inboxId: 10, sessionName: 'session-a' }); await store.reserve({ accountId: 1, inboxId: 20, sessionName: 'session-b' }); await store.reserve({ accountId: 1, inboxId: 30, sessionName: 'hybrid-a1-i30' });
  const imported = await import('./index'); groupMetadataBackfill = imported.groupMetadataBackfill; waha = (await import('./waha')).wahaTransport; evolution = (await import('./evolution')).evolutionBridge; chatwoot = (await import('./chatwoot')).chatwootBridge;
  bridgeServer = imported.app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => bridgeServer.once('listening', resolve)); base = `http://127.0.0.1:${(bridgeServer.address() as { port: number }).port}`;
});
afterAll(async () => { vi.restoreAllMocks(); vi.unstubAllEnvs(); if (bridgeServer) await new Promise<void>((resolve, reject) => bridgeServer.close(error => error ? reject(error) : resolve())); if (railsServer) await new Promise<void>((resolve, reject) => railsServer.close(error => error ? reject(error) : resolve())); await rm(dir, { recursive: true, force: true }); });

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(chatwoot, 'listInboxesForSession').mockResolvedValue([inbox(10, 'A', 'session-a'), inbox(20, 'B', 'session-b')] as never);
  vi.spyOn(chatwoot, 'listServiceAccountIds').mockResolvedValue([1]);
  vi.spyOn(chatwoot, 'listAccountInboxes').mockResolvedValue([inbox(10, 'A', 'session-a'), inbox(20, 'B', 'session-b'), { id: 30, name: 'Hybrid', channel_type: 'Channel::Whatsapp', additional_attributes: { hybrid_enabled: true, hybrid_waha_session: 'hybrid-a1-i30' } }] as never);
  vi.spyOn(chatwoot, 'contactsByIdsForSession').mockImplementation(async (_accountId, ids) => ids.map(id => ({ id, name: `Contact ${id}`, phone_number: `+55119999999${id}` })) as never);
  vi.spyOn(chatwoot, 'ensureGroupConversation').mockResolvedValue({ conversationId: 91, contactId: 55, sourceId: 'whatsapp:group:group@g.us' });
  vi.spyOn(chatwoot, 'conversationGroupTargetDetailsForSession').mockResolvedValue({ groupJid: '222@g.us', contactId: 55, persistedMetadata: { participants: [] } } as never);
  vi.spyOn(chatwoot, 'saveEvolutionGroup').mockResolvedValue({} as never);
  vi.spyOn(waha, 'getSession').mockImplementation(async name => ({ name, status: 'WORKING', connectionStatus: 'connected' }));
  vi.spyOn(waha, 'listChats').mockResolvedValue([]);
  vi.spyOn(waha, 'createGroup').mockImplementation(async session => ({ id: `${session === 'session-b' ? '222' : '111'}@g.us` }));
  vi.spyOn(waha, 'updateGroupDescription').mockResolvedValue({} as never); vi.spyOn(waha, 'getGroupInviteLink').mockResolvedValue('https://chat.whatsapp.com/code'); vi.spyOn(waha, 'sendText').mockResolvedValue({} as never);
  vi.spyOn(waha, 'getGroupMetadata').mockResolvedValue({ id: '222@g.us', subject: 'Equipe', participants: [] }); vi.spyOn(waha, 'addGroupParticipant').mockResolvedValue({ id: '222@g.us', subject: 'Equipe', participants: [] });
  vi.spyOn(evolution, 'getConnection').mockResolvedValue({ state: 'open' }); vi.spyOn(evolution, 'createGroup').mockResolvedValue({ id: '333@g.us' }); vi.spyOn(evolution, 'getGroupInviteLink').mockResolvedValue('https://chat.whatsapp.com/evolution'); vi.spyOn(evolution, 'sendText').mockResolvedValue({} as never);
});

describe('group creation routing and idempotency', () => {
  it('expõe somente a URL pública runtime configurada pelo ambiente', async () => {
    const response = await fetch(`${base}/config`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ bridgePublicUrl: 'https://bridge.synthetic.example' });
  });

  it('descobre grupos silenciosos da primeira conexão sem persistence prévia', async () => {
    vi.spyOn(chatwoot, 'listPersistedGroupContacts').mockResolvedValue([]);
    vi.mocked(waha.listChats).mockResolvedValue([
      { id: '700001@g.us', name: 'Synthetic group alpha' },
      { id: '700002@g.us', name: 'Synthetic group beta' },
      { id: '5500000000000@c.us', name: 'Synthetic private chat' },
    ]);
    vi.mocked(chatwoot.ensureGroupConversation)
      .mockResolvedValueOnce({ conversationId: 801, contactId: 901, sourceId: 'whatsapp:group:700001@g.us' })
      .mockResolvedValueOnce({ conversationId: 802, contactId: 902, sourceId: 'whatsapp:group:700002@g.us' });
    vi.spyOn(chatwoot, 'groupContactAttributes').mockResolvedValue({});
    vi.mocked(waha.getGroupMetadata).mockImplementation(async (_session, groupJid) => ({ id: groupJid, subject: `Metadata ${groupJid}`, participants: [{ jid: '5500000000001@c.us', phoneNumber: '5500000000001', name: 'Synthetic member' }] }));
    vi.spyOn(waha, 'getChatAvatarUrl').mockResolvedValue(undefined);
    vi.spyOn(chatwoot, 'findOrCreateGroupParticipantContact').mockResolvedValue({ id: 990, name: 'Synthetic member', phoneNumber: '+5500000000001', avatarUrl: undefined, existing: true });
    vi.spyOn(chatwoot, 'saveWahaIdentity').mockResolvedValue({} as never);

    await groupMetadataBackfill.reconcile({ accountId: 47, inboxId: 608, sessionName: 'tenant-session-x' });

    expect(chatwoot.ensureGroupConversation).toHaveBeenCalledTimes(2);
    expect(chatwoot.ensureGroupConversation).toHaveBeenCalledWith(608, '700001@g.us', 'Synthetic group alpha', 'waha');
    expect(waha.getGroupMetadata).toHaveBeenCalledTimes(2);
    expect(chatwoot.saveEvolutionGroup).toHaveBeenCalledWith(901, '700001@g.us', 'Metadata 700001@g.us', expect.objectContaining({ transport: 'waha', participants: [expect.objectContaining({ contactId: 990 })] }));
  });

  it('backfills a silent persisted group and resolves LID to a real Contact', async () => {
    vi.spyOn(chatwoot, 'listPersistedGroupContacts').mockResolvedValue([{ contactId: 55, groupJid: '222@g.us', subject: 'Nome persistido', description: 'Descrição rica', participants: [], historicalParticipants: [] }]);
    vi.spyOn(chatwoot, 'groupContactAttributes').mockResolvedValue({});
    vi.mocked(waha.getGroupMetadata).mockResolvedValue({ id: '222@g.us', subject: 'Equipe', description: 'Descrição WAHA', participants: [{ jid: '123@lid', lid: '123@lid', name: 'Synthetic participant', admin: 'admin' }] });
    vi.spyOn(waha, 'resolveLid').mockResolvedValue('5511999999999'); vi.spyOn(waha, 'getChatAvatarUrl').mockResolvedValue(undefined);
    vi.spyOn(chatwoot, 'findOrCreateGroupParticipantContact').mockResolvedValue({ id: 91, name: 'Synthetic resolved participant', phoneNumber: '+5511999999999', avatarUrl: undefined, existing: true });
    vi.spyOn(chatwoot, 'saveWahaIdentity').mockResolvedValue({} as never);
    await groupMetadataBackfill.reconcile({ accountId: 1, inboxId: 20, sessionName: 'session-b' });
    expect(waha.getGroupMetadata).toHaveBeenCalledWith('session-b', '222@g.us'); expect(waha.resolveLid).toHaveBeenCalledWith('session-b', '123');
    expect(chatwoot.findOrCreateGroupParticipantContact).toHaveBeenCalledWith(20, expect.objectContaining({ phoneNumber: '+5511999999999' }));
    expect(chatwoot.saveEvolutionGroup).toHaveBeenCalledWith(55, '222@g.us', 'Equipe', expect.objectContaining({ transport: 'waha', description: 'Descrição WAHA', participants: [expect.objectContaining({ jid: '123@lid', lid: '123', phoneJid: '5511999999999@c.us', contactId: 91, admin: 'admin' })] }));
  });

  it('atualiza membros e descrição por evento mesmo sem cache de identities', async () => {
    vi.spyOn(chatwoot, 'listPersistedGroupContacts').mockResolvedValue([
      { contactId: 901, groupJid: '700003@g.us', subject: 'Synthetic group old', description: 'Synthetic description old', participants: [{ jid: '5500000000001@c.us', phone: '5500000000001', contact_id: 991 }], historicalParticipants: [] },
      { contactId: 902, groupJid: '700003@g.us', subject: 'Synthetic duplicate', participants: [], historicalParticipants: [] },
    ]);
    vi.mocked(waha.getGroupMetadata).mockResolvedValue({ id: '700003@g.us', subject: 'Synthetic group new', description: 'Synthetic description new', participants: [{ jid: '5500000000002@c.us', phoneNumber: '5500000000002', name: 'Synthetic member new' }] });
    vi.spyOn(waha, 'getChatAvatarUrl').mockResolvedValue(undefined);
    vi.spyOn(chatwoot, 'findOrCreateGroupParticipantContact').mockResolvedValue({ id: 992, name: 'Synthetic member new', phoneNumber: '+5500000000002', avatarUrl: undefined, existing: true });
    vi.spyOn(chatwoot, 'saveWahaIdentity').mockResolvedValue({} as never);
    const response = await postWaha({ event: 'group.v2.update', session: 'session-b', payload: { id: 'synthetic-event-update', group: { id: '700003@g.us' } } });
    expect(response.status).toBe(202);
    await vi.waitFor(() => expect(chatwoot.saveEvolutionGroup).toHaveBeenCalledTimes(2));
    expect(chatwoot.saveEvolutionGroup).toHaveBeenCalledWith(901, '700003@g.us', 'Synthetic group new', expect.objectContaining({ description: 'Synthetic description new', participants: [expect.objectContaining({ contactId: 992 })], historicalParticipants: expect.arrayContaining([expect.objectContaining({ contactId: 991 }), expect.objectContaining({ contactId: 992 })]) }));
    expect(chatwoot.saveEvolutionGroup).toHaveBeenCalledWith(902, '700003@g.us', 'Synthetic group new', expect.anything());
  });

  it('payload parcial posterior não apaga metadata rica persistida', async () => {
    vi.spyOn(chatwoot, 'listPersistedGroupContacts').mockResolvedValue([{ contactId: 903, groupJid: '700004@g.us', subject: 'Synthetic rich group', description: 'Synthetic rich description', participants: [{ jid: '5500000000003@c.us', phone: '5500000000003', contact_id: 993 }, { jid: '5500000000004@c.us', phone: '5500000000004', contact_id: 994 }], historicalParticipants: [] }]);
    vi.mocked(waha.getGroupMetadata).mockResolvedValue({ id: '700004@g.us', participants: [{ jid: '5500000000003@c.us', phoneNumber: '5500000000003' }] });
    vi.spyOn(waha, 'getChatAvatarUrl').mockResolvedValue(undefined);
    const failed = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await postWaha({ event: 'group.v2.update', session: 'session-b', payload: { id: 'synthetic-event-partial', group: { id: '700004@g.us' } } });
    expect(response.status).toBe(202);
    await vi.waitFor(() => expect(failed).toHaveBeenCalledWith('[waha] group lifecycle processing failed', expect.objectContaining({ error: 'WAHA returned partial group metadata.' })));
    expect(chatwoot.saveEvolutionGroup).not.toHaveBeenCalled();
  });

  it('redescobre cada binding WORKING pelo Chatwoot no restart', async () => {
    const reconcile = vi.spyOn(groupMetadataBackfill, 'reconcile').mockResolvedValue(undefined);
    vi.mocked(waha.getSession).mockImplementation(async name => ({ name, status: name === 'session-b' ? 'FAILED' : 'WORKING', connectionStatus: name === 'session-b' ? 'error' : 'connected' }));
    const { reconcileWorkingWahaGroups } = await import('./index'); await reconcileWorkingWahaGroups();
    expect(reconcile).toHaveBeenCalledWith({ accountId: 1, inboxId: 10, sessionName: 'session-a' });
    expect(reconcile).toHaveBeenCalledWith({ accountId: 1, inboxId: 30, sessionName: 'hybrid-a1-i30' });
    expect(reconcile).not.toHaveBeenCalledWith(expect.objectContaining({ inboxId: 20 }));
  });

  it('adota o binding persistido quando o primeiro evento chega antes do índice local', async () => {
    vi.mocked(chatwoot.listServiceAccountIds).mockResolvedValue([47]);
    vi.mocked(chatwoot.listAccountInboxes).mockResolvedValue([inbox(608, 'Synthetic inbox', 'first-event-session')] as never);
    vi.spyOn(chatwoot, 'findWahaInbox').mockResolvedValue({ id: 608, identifier: 'synthetic-608' });
    vi.spyOn(chatwoot, 'updateInboxAdditionalAttributes').mockResolvedValue({} as never);
    const reconcile = vi.spyOn(groupMetadataBackfill, 'reconcile').mockResolvedValue(undefined);
    const response = await postWaha({ event: 'session.status', session: 'first-event-session', payload: { id: 'synthetic-first-status', status: 'WORKING' } });
    expect(response.status).toBe(202);
    await vi.waitFor(() => expect(reconcile).toHaveBeenCalledWith({ accountId: 47, inboxId: 608, sessionName: 'first-event-session' }));
  });

  it('mantém accounts e inboxes isoladas durante a reconciliação genérica', async () => {
    vi.mocked(chatwoot.listServiceAccountIds).mockResolvedValue([47, 73]);
    vi.mocked(chatwoot.listAccountInboxes).mockImplementation(async accountId => accountId === 47
      ? [inbox(608, 'Synthetic X', 'tenant-session-x'), inbox(609, 'Synthetic Z', 'tenant-session-z')] as never
      : [inbox(904, 'Synthetic Y', 'tenant-session-y')] as never);
    const reconcile = vi.spyOn(groupMetadataBackfill, 'reconcile').mockResolvedValue(undefined);
    const { reconcileWorkingWahaGroups } = await import('./index'); await reconcileWorkingWahaGroups();
    expect(reconcile).toHaveBeenCalledWith({ accountId: 47, inboxId: 608, sessionName: 'tenant-session-x' });
    expect(reconcile).toHaveBeenCalledWith({ accountId: 47, inboxId: 609, sessionName: 'tenant-session-z' });
    expect(reconcile).toHaveBeenCalledWith({ accountId: 73, inboxId: 904, sessionName: 'tenant-session-y' });
  });

  it('reads group details from persistence without any WAHA call', async () => {
    vi.spyOn(chatwoot, 'findWhatsAppInboxByIdForSession').mockResolvedValue({ id: 20, configuration: { mode: 'web', transports: ['waha'], evolutionInstanceName: null, wahaSessionName: 'session-b' } });
    vi.mocked(chatwoot.conversationGroupTargetDetailsForSession).mockResolvedValue({ groupJid: '222@g.us', contactId: 55, persistedMetadata: { subject: 'Equipe', participants: [{ jid: '123@lid', phone_jid: '5511999999999@c.us', phone: '5511999999999', contact_id: 91 }], historicalParticipants: [], syncedAt: new Date().toISOString() } } as never);
    const provider = vi.spyOn(waha, 'getGroupMetadata'); const avatar = vi.spyOn(waha, 'getChatAvatarUrl'); const session = vi.spyOn(waha, 'getSession');
    const response = await fetch(`${base}/groups/metadata?accountId=1&inboxId=20&conversationId=81&transport=waha`, { headers });
    const result = await response.json(); expect(response.status, JSON.stringify(result)).toBe(200); expect(result).toMatchObject({ group: { memberCount: 1, participants: [{ jid: '123@lid', phoneNumber: '5511999999999', contactId: 91 }] } });
    expect(provider).not.toHaveBeenCalled(); expect(avatar).not.toHaveBeenCalled(); expect(session).not.toHaveBeenCalled();
  });

  it('resolves only requested persisted participant identities without provider access', async () => {
    const avatarLookup = vi.spyOn(waha, 'getChatAvatarUrl');
    const evolutionMetadata = vi.spyOn(evolution, 'getGroupMetadata');
    vi.mocked(chatwoot.contactsByIdsForSession).mockResolvedValue([{ id: 91, name: 'Synthetic current participant', phone_number: '+5511999999999', thumbnail: 'synthetic-current.jpg' }] as never);
    vi.mocked(chatwoot.conversationGroupTargetDetailsForSession).mockResolvedValue({
      groupJid: '222@g.us', contactId: 55, persistedMetadata: {
        participants: [
          { jid: '123@lid', phone_jid: '5511999999999@c.us', display_name: 'Synthetic participant', avatar_url: 'synthetic.jpg', contact_id: 91 },
          { jid: '456@lid', display_name: 'Outro membro', contact_id: 92 },
        ],
        historicalParticipants: [],
      },
    } as never);
    const response = await post('/groups/participant-identities', { accountId: 1, inboxId: 20, conversationId: 81, identifiers: [{ contactId: 800, aliases: ['123@lid'] }] });
    const result = await response.json(); expect(response.status, JSON.stringify(result)).toBe(200);
    expect(result).toEqual({ participants: [expect.objectContaining({ jid: '123@lid', contactId: 91, displayName: 'Synthetic current participant', avatarUrl: 'synthetic-current.jpg', phoneNumber: '+5511999999999' })] });
    expect(chatwoot.contactsByIdsForSession).toHaveBeenCalledWith(1, [91], expect.any(Headers));
    expect(waha.getGroupMetadata).not.toHaveBeenCalled();
    expect(avatarLookup).not.toHaveBeenCalled();
    expect(evolutionMetadata).not.toHaveBeenCalled();
  });

  it('selecting inbox B calls only session B', async () => {
    const response = await post('/groups/creation', { accountId: 1, inboxId: 20, creationRequestId: 'routing-b-001', name: 'Equipe B', description: '', mode: 'invite', contactIds: [1] });
    expect(response.status).toBe(201); expect(await response.json()).toMatchObject({ created: true, conversationId: 91, groupJid: '222@g.us', inbox: { id: 20 }, provider: { session: 'session-b' } });
    expect(waha.createGroup).toHaveBeenCalledWith('session-b', 'Equipe B', []); expect(waha.createGroup).not.toHaveBeenCalledWith('session-a', expect.anything(), expect.anything());
    expect(waha.getGroupInviteLink).toHaveBeenCalledWith('session-b', '222@g.us');
    expect(waha.sendText).toHaveBeenCalledWith('session-b', '551199999991', expect.stringContaining('https://chat.whatsapp.com/code'));
    expect(waha.sendText).not.toHaveBeenCalledWith(expect.anything(), '222@g.us', expect.anything());
  });

  it('fails when B is unavailable even while A is WORKING', async () => {
    vi.mocked(waha.getSession).mockImplementation(async name => ({ name, status: name === 'session-b' ? 'FAILED' : 'WORKING', connectionStatus: name === 'session-b' ? 'error' : 'connected' }));
    const response = await post('/groups/creation', { accountId: 1, inboxId: 20, creationRequestId: 'routing-b-002', name: 'Equipe B', description: '', mode: 'invite', contactIds: [1] });
    expect(response.status).toBe(409); expect(await response.json()).toMatchObject({ code: 'provider_session_not_working' }); expect(waha.createGroup).not.toHaveBeenCalled(); expect(waha.getSession).not.toHaveBeenCalledWith('session-a');
  });

  it('keeps created=true when invite link fails and never creates again on HTTP retry', async () => {
    vi.mocked(waha.getGroupInviteLink).mockRejectedValue(new Error('invalid response'));
    const body = { accountId: 1, inboxId: 20, creationRequestId: 'partial-link-001', name: 'Equipe', description: '', mode: 'invite', contactIds: [1] };
    const first = await post('/groups/creation', body); const firstBody = await first.json(); expect(first.status).toBe(201); expect(firstBody).toMatchObject({ created: true, conversationId: 91, inviteStatus: 'failed', results: [{ contactId: 1, ok: false, error: 'invite_code_fetch_failed' }] });
    const retry = await post('/groups/creation', body); expect(retry.status).toBe(201); expect(await retry.json()).toMatchObject({ groupJid: firstBody.groupJid, created: true }); expect(waha.createGroup).toHaveBeenCalledTimes(1);
  });

  it('retries only failed invitations and never recreates the group', async () => {
    vi.mocked(waha.sendText).mockImplementation(async (_session, phone) => { if (phone.includes('992')) throw new Error('send failed'); return {} as never; });
    const body = { accountId: 1, inboxId: 20, creationRequestId: 'partial-send-01', name: 'Equipe', description: '', mode: 'invite', contactIds: [1, 2, 3] };
    const created = await post('/groups/creation', body); const result = await created.json(); expect(result.inviteStatus).toBe('partial'); expect(result.results.filter((item: { ok: boolean }) => !item.ok)).toHaveLength(1);
    vi.mocked(waha.sendText).mockResolvedValue({} as never); vi.mocked(waha.sendText).mockClear();
    const retried = await post('/groups/creation/invitations', { accountId: 1, inboxId: 20, creationRequestId: body.creationRequestId, groupId: result.groupId, contactIds: [2] });
    expect(retried.status).toBe(200); expect((await retried.json()).inviteStatus).toBe('complete'); expect(waha.sendText).toHaveBeenCalledTimes(1); expect(waha.createGroup).toHaveBeenCalledTimes(1);
  });

  it('uses only the native hybrid inbox binding and rejects Meta-only', async () => {
    vi.mocked(chatwoot.listInboxesForSession).mockResolvedValue([{ id: 30, name: 'Hybrid', channel_type: 'Channel::Whatsapp', additional_attributes: { hybrid_enabled: true, hybrid_waha_session: 'hybrid-a1-i30' } }] as never);
    const hybrid = await post('/groups/creation', { accountId: 1, inboxId: 30, creationRequestId: 'hybrid-route-01', name: 'Hybrid', description: '', mode: 'direct', contactIds: [1], directConfirmed: true });
    expect(hybrid.status).toBe(201); expect(waha.createGroup).toHaveBeenCalledWith('hybrid-a1-i30', 'Hybrid', ['551199999991']);
    vi.mocked(chatwoot.listInboxesForSession).mockResolvedValue([{ id: 40, name: 'Meta', channel_type: 'Channel::Whatsapp', additional_attributes: {} }] as never);
    const meta = await post('/groups/creation', { accountId: 1, inboxId: 40, creationRequestId: 'meta-reject-001', name: 'Meta', description: '', mode: 'direct', contactIds: [1], directConfirmed: true });
    expect(meta.status).toBe(422); expect(await meta.json()).toMatchObject({ code: 'inbox_not_group_capable' });
  });

  it('uses exactly the Evolution instance bound to the selected inbox', async () => {
    vi.mocked(chatwoot.listInboxesForSession).mockResolvedValue([{ id: 50, name: 'Evolution B', channel_type: 'Channel::Api', inbox_identifier: 'api-50', additional_attributes: { whatsapp_transports: ['evolution'], evolution_instance_name: 'instance-b', evolution_provider: 'evolution' } }] as never);
    const response = await post('/groups/creation', { accountId: 1, inboxId: 50, creationRequestId: 'evolution-b-01', name: 'Evolution', description: '', mode: 'invite', contactIds: [1] });
    expect(response.status).toBe(201); expect(evolution.createGroup).toHaveBeenCalledWith('instance-b', 'Evolution', []); expect(waha.createGroup).not.toHaveBeenCalled();
  });

  it('rejects a cross-account request before any provider call', async () => {
    const response = await post('/groups/creation', { accountId: 2, inboxId: 20, creationRequestId: 'cross-account-01', name: 'Cross', description: '', mode: 'invite', contactIds: [1] });
    expect(response.status).toBe(401); expect(waha.createGroup).not.toHaveBeenCalled(); expect(evolution.createGroup).not.toHaveBeenCalled();
  });

  it('existing group defaults to invite semantics while direct add requires confirmation', async () => {
    const invited = await post('/groups/participants', { accountId: 1, inboxId: 20, conversationId: 91, transport: 'waha', mode: 'invite', contactIds: [1], directConfirmed: false });
    expect(invited.status).toBe(200); expect(waha.sendText).toHaveBeenCalledWith('session-b', '551199999991', expect.stringContaining('https://chat.whatsapp.com/code')); expect(waha.addGroupParticipant).not.toHaveBeenCalled();
    expect(waha.getGroupInviteLink).toHaveBeenCalledWith('session-b', '222@g.us'); expect(waha.sendText).not.toHaveBeenCalledWith('session-b', '222@g.us', expect.anything());
    const blocked = await post('/groups/participants', { accountId: 1, inboxId: 20, conversationId: 91, transport: 'waha', mode: 'direct', contactIds: [1], directConfirmed: false }); expect(blocked.status).toBe(422);
    const direct = await post('/groups/participants', { accountId: 1, inboxId: 20, conversationId: 91, transport: 'waha', mode: 'direct', contactIds: [1], directConfirmed: true }); expect(direct.status).toBe(200); expect(waha.addGroupParticipant).toHaveBeenCalledWith('session-b', '222@g.us', '551199999991');
  });

  it('never sends or directly adds a Contact already in the group', async () => {
    vi.mocked(waha.getGroupMetadata).mockResolvedValue({ id: '222@g.us', subject: 'Equipe', participants: [{ jid: '551199999991@c.us', phoneNumber: '551199999991' }] });
    const response = await post('/groups/participants', { accountId: 1, inboxId: 20, conversationId: 91, transport: 'waha', mode: 'invite', contactIds: [1], directConfirmed: false });
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ results: [{ contactId: 1, ok: false, error: 'already_member' }] }); expect(waha.sendText).not.toHaveBeenCalled(); expect(waha.addGroupParticipant).not.toHaveBeenCalled();
  });

  it('sends three private invitations independently and never targets the group JID', async () => {
    vi.mocked(waha.sendText).mockImplementation(async (_session, phone) => { if (phone === '551199999992') throw new Error('send failed'); return {} as never; });
    const response = await post('/groups/participants', { accountId: 1, inboxId: 20, conversationId: 91, transport: 'waha', mode: 'invite', contactIds: [1, 2, 3], directConfirmed: false });
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ inviteStatus: 'partial', results: [{ contactId: 1, ok: true }, { contactId: 2, ok: false, error: 'invite_send_failed' }, { contactId: 3, ok: true }] });
    expect(waha.sendText).toHaveBeenCalledTimes(3);
    expect(vi.mocked(waha.sendText).mock.calls.map(call => call[1])).toEqual(['551199999991', '551199999992', '551199999993']);
    expect(waha.sendText).not.toHaveBeenCalledWith('session-b', '222@g.us', expect.anything());
  });

  it('rejects a cross-account existing-group invitation before fetching or sending', async () => {
    const response = await post('/groups/participants', { accountId: 2, inboxId: 20, conversationId: 91, transport: 'waha', mode: 'invite', contactIds: [1], directConfirmed: false });
    expect(response.status).toBe(401); expect(waha.getGroupInviteLink).not.toHaveBeenCalled(); expect(waha.sendText).not.toHaveBeenCalled();
  });
});
