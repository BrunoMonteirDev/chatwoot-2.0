import express from 'express';
import multer from 'multer';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { normalizeBrazilianPhone } from '../phone.ts';
import { chatwootBridge } from './chatwoot.js';
import { config } from './config.js';
import { PersistentDedupStore } from './dedupStore.js';
import { evolutionGroupSourceId, parseIncomingEvolutionEdit, parseIncomingEvolutionGroupLifecycle, parseIncomingEvolutionMessage, parseIncomingEvolutionReaction, parseIncomingEvolutionRevoke, type IncomingEvolutionMessage, type IncomingEvolutionReaction } from './evolutionEvent.js';
import { IdentityStore } from './identityStore.js';
import { parseOutgoingChatwootMessage } from './chatwootEvent.js';
import { evolutionBridge } from './evolution.js';
import { metaCloud, MetaCloudError } from './meta.js';
import { MetaConfigStore } from './metaConfigStore.js';
import { MetaEmbeddedSignupSessionStore, type MetaOnboardingMode } from './metaEmbeddedSignupStore.js';
import { MetaHistoryStore } from './metaHistoryStore.js';
import { parseMetaWebhook, type IncomingMetaMessage } from './metaEvent.js';
import { externalMessageId, parseExternalMessageId, resolveMessageOperationTransport, resolveOutgoingTransport, transportConfigurationForInbox } from './providers.js';
import { reactionTransport, UnsupportedReactionTransportError } from './reactionTransport.js';
import { bridgeCors, chatwootSessionHeaders, requireChatwootSession } from './auth.js';
import { bridgeRedis } from './redis.js';
import { bridgeMetrics } from './metrics.js';
import { enforceRateLimit } from './rateLimit.js';
import { wahaTransport, WahaApiError } from './waha.js';
import { WahaSessionOwnershipError, WahaSessionStore } from './wahaSessionStore.js';
import { normalizeWahaMessageId, parseIncomingWahaGroupLifecycle, parseIncomingWahaMessage, parseIncomingWahaMutation, parseIncomingWahaReaction, parseWahaHistoryMessage, parseWahaWebhook, wahaGroupSourceId, type IncomingWahaMessage } from './wahaEvent.js';
import { createTrackId } from './track.js';
import { WahaHistoryStore, type WahaHistoryJob, type WahaHistoryRange } from './wahaHistoryStore.js';
import { connectionStatusPatch, evolutionConnectionStatus, metaConnectionStatus, type ConnectionStatus } from './connectionStatus.js';
import { groupMetadataCache, type GroupMetadata } from './groupMetadata.js';

const app = express();
const templateHeaderUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxMediaBytes, files: 1 } });
const dedup = new PersistentDedupStore(config.dedupFile);
const identities = new IdentityStore(config.identityFile);
const metaConfigs = new MetaConfigStore(config.metaConfigFile);
const metaEmbeddedSignupSessions = new MetaEmbeddedSignupSessionStore(config.metaEmbeddedSignupSessionTtlMs);
const metaHistory = new MetaHistoryStore(config.metaHistoryFile);
const wahaSessions = new WahaSessionStore(config.wahaSessionOwnershipFile);
const wahaHistory = new WahaHistoryStore(config.wahaHistoryFile);
const historyImports = new Map<number, Promise<void>>();
const wahaHistoryImports = new Map<number, Promise<void>>();
// WAHA can emit its own `fromMe` webhook before the send endpoint returns the
// provider message id. During that small window, Chatwoot still owns the
// outgoing bubble and the echo must not become a second "mobile" bubble.
type PendingWahaOutgoing = { session: string; destination: string; content: string; media: boolean; expiresAt: number };
const pendingWahaOutgoing = new Map<string, PendingWahaOutgoing>();
const wahaDestination = (value: string) => value.endsWith('@g.us') ? value : value.replace(/\D/g, '');
const queueWahaOutgoing = (session: string, destination: string, content: string, media: boolean) => {
  const key = `${session}:${randomUUID()}`;
  pendingWahaOutgoing.set(key, { session, destination: wahaDestination(destination), content: content.trim(), media, expiresAt: Date.now() + 30_000 });
  return key;
};
const consumePendingWahaOutgoing = (session: string, message: { remoteJid: string; content: string; media?: unknown }) => {
  const destination = wahaDestination(message.remoteJid);
  const content = message.content.trim();
  const media = Boolean(message.media);
  for (const [key, pending] of pendingWahaOutgoing) {
    if (pending.expiresAt < Date.now()) { pendingWahaOutgoing.delete(key); continue; }
    if (pending.session === session && pending.destination === destination && pending.content === content && pending.media === media) {
      pendingWahaOutgoing.delete(key);
      return true;
    }
  }
  return false;
};
app.use(express.json({ limit: '2mb', verify: (request, _response, buffer) => { (request as express.Request & { rawBody?: string }).rawBody = buffer.toString('utf8'); } }));
app.use(bridgeCors);
app.get('/health', (_request, response) => response.json({ ok: true, redis: bridgeRedis.enabled ? 'configured' : 'local-development', metrics: bridgeMetrics.snapshot() }));
app.get('/ready', async (_request, response) => {
  try {
    const [chatwoot, redis, waha] = await Promise.all([
      // The Chatwoot root serves HTML and deliberately rejects an explicit
      // JSON Accept header. Readiness only needs to prove the service answers.
      // Rails is behind a TLS-terminating reverse proxy in production. The
      // bridge reaches Puma over the private HTTP network, so preserve the
      // original HTTPS scheme to avoid a FORCE_SSL redirect to `https://rails`.
      fetch(`${config.chatwootBaseUrl}/`, {
        headers: { 'X-Forwarded-Proto': 'https', 'X-Forwarded-Ssl': 'on' },
        // A fresh Chatwoot redirects / to onboarding. Its HTTP response
        // proves Puma is ready; following it would attempt TLS on the
        // private HTTP-only Rails port.
        redirect: 'manual',
      }),
      bridgeRedis.ping(),
      wahaTransport.health(),
    ]);
    if (chatwoot.status >= 500 || !redis || !waha) throw new Error('dependency unavailable');
    return response.json({ ok: true });
  } catch {
    return response.status(503).json({ ok: false });
  }
});
const requireBridgeAdministrator = async (request: express.Request, response: express.Response) => {
  if (await requireChatwootSession(request, true)) return true;
  response.status(401).json({ error: 'Unauthorized' });
  return false;
};
const requireBridgeUser = async (request: express.Request, response: express.Response) => {
  if (await requireChatwootSession(request)) return true;
  response.status(401).json({ error: 'Unauthorized' });
  return false;
};
const groupTransport = (configuration: { transports: Array<'evolution' | 'waha' | 'meta_cloud'> }, requested: unknown) => {
  if (requested === 'evolution' || requested === 'waha' || requested === 'meta_cloud') return configuration.transports.includes(requested) ? requested : null;
  // A hybrid inbox must state the transport that owns this group. The browser
  // gets it from the conversation's latest group message; never assume Meta.
  return configuration.transports.length === 1 ? configuration.transports[0] : null;
};
const loadGroupMetadata = async (transport: 'evolution' | 'waha', configuration: { evolutionInstanceName: string | null; wahaSessionName: string | null }, groupJid: string): Promise<GroupMetadata> => {
  if (transport === 'waha') {
    if (!configuration.wahaSessionName) throw new Error('A sessão WAHA desta inbox não está configurada.');
    const metadata = await wahaTransport.getGroupMetadata(configuration.wahaSessionName, groupJid);
    // Signed WhatsApp profile URLs are provider data. Resolve each distinct
    // participant once while the group metadata cache is cold, never during a
    // React render or once per individual message bubble.
    const participants = await Promise.all(metadata.participants.map(async participant => ({ ...participant, ...(await wahaTransport.getChatAvatarUrl(configuration.wahaSessionName!, participant.jid).then(avatarUrl => avatarUrl ? { avatarUrl } : {}).catch(() => ({}))) })));
    return { ...metadata, participants, transport, canEditDescription: true };
  }
  if (!configuration.evolutionInstanceName) throw new Error('A instância Evolution desta inbox não está configurada.');
  return { ...(await evolutionBridge.getGroupMetadata(configuration.evolutionInstanceName, groupJid)), transport, canEditDescription: true };
};

app.get('/groups/metadata', async (request, response) => {
  if (!(await requireBridgeUser(request, response))) return;
  const inboxId = Number(request.query.inboxId); const conversationId = Number(request.query.conversationId);
  if (!Number.isInteger(inboxId) || !Number.isInteger(conversationId)) return response.status(400).json({ error: 'Inbox e conversa são obrigatórias.' });
  try {
    const inbox = await chatwootBridge.findWhatsAppInboxById(inboxId);
    const groupJid = await chatwootBridge.conversationGroupTarget(conversationId, inboxId);
    const transport = groupTransport(inbox.configuration, request.query.transport);
    if (!transport) return response.status(409).json({ error: 'Não foi possível determinar o transporte deste grupo.', category: 'transport_unavailable' });
    if (transport === 'meta_cloud') return response.status(422).json({ error: 'Metadados de grupos não estão disponíveis na Meta Cloud.', category: 'unsupported_operation' });
    const cached = groupMetadataCache.get(transport, groupJid);
    const metadata = cached || groupMetadataCache.set(await loadGroupMetadata(transport, inbox.configuration, groupJid));
    return response.json({ group: metadata, cached: Boolean(cached) });
  } catch (error) { return response.status(502).json({ error: error instanceof Error ? error.message : 'Não foi possível carregar o grupo.' }); }
});

app.patch('/groups/description', async (request, response) => {
  if (!(await requireBridgeUser(request, response))) return;
  const body = request.body as { inboxId?: unknown; conversationId?: unknown; transport?: unknown; description?: unknown };
  if (!Number.isInteger(body.inboxId) || !Number.isInteger(body.conversationId) || typeof body.description !== 'string') return response.status(400).json({ error: 'Descrição de grupo inválida.' });
  try {
    const inbox = await chatwootBridge.findWhatsAppInboxById(body.inboxId as number);
    const groupJid = await chatwootBridge.conversationGroupTarget(body.conversationId as number, body.inboxId as number);
    const transport = groupTransport(inbox.configuration, body.transport);
    if (!transport) return response.status(409).json({ error: 'Não foi possível determinar o transporte deste grupo.', category: 'transport_unavailable' });
    if (transport === 'meta_cloud') return response.status(422).json({ error: 'A Meta Cloud não permite editar descrição de grupos.', category: 'unsupported_operation' });
    let group: GroupMetadata;
    if (transport === 'waha') {
      if (!inbox.configuration.wahaSessionName) throw new Error('A sessão WAHA desta inbox não está configurada.');
      group = { ...(await wahaTransport.updateGroupDescription(inbox.configuration.wahaSessionName, groupJid, body.description)), transport, canEditDescription: true };
    } else {
      if (!inbox.configuration.evolutionInstanceName) throw new Error('A instância Evolution desta inbox não está configurada.');
      group = { ...(await evolutionBridge.updateGroupDescription(inbox.configuration.evolutionInstanceName, groupJid, body.description)), transport, canEditDescription: true };
    }
    return response.json({ group: groupMetadataCache.set({ ...group, description: group.description ?? body.description }) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível editar a descrição do grupo.';
    return response.status(/\b(401|403)\b|admin|permission|not authorized/i.test(message) ? 403 : 502).json({ error: message });
  }
});

app.post('/groups/participants', async (request, response) => {
  if (!(await requireBridgeUser(request, response))) return;
  const body = request.body as { inboxId?: unknown; conversationId?: unknown; transport?: unknown; participant?: unknown };
  if (!Number.isInteger(body.inboxId) || !Number.isInteger(body.conversationId) || typeof body.participant !== 'string' || !body.participant.trim()) return response.status(400).json({ error: 'Participante inválido.' });
  try {
    const inbox = await chatwootBridge.findWhatsAppInboxById(body.inboxId as number); const groupJid = await chatwootBridge.conversationGroupTarget(body.conversationId as number, body.inboxId as number); const transport = groupTransport(inbox.configuration, body.transport);
    if (!transport) return response.status(409).json({ error: 'Não foi possível determinar o transporte deste grupo.', category: 'transport_unavailable' });
    if (transport === 'meta_cloud') return response.status(422).json({ error: 'A Meta Cloud não permite participantes de grupos.', category: 'unsupported_operation' });
    const group = transport === 'waha'
      ? !inbox.configuration.wahaSessionName ? null : { ...(await wahaTransport.addGroupParticipant(inbox.configuration.wahaSessionName, groupJid, body.participant)), transport, canEditDescription: true }
      : !inbox.configuration.evolutionInstanceName ? null : { ...(await evolutionBridge.addGroupParticipant(inbox.configuration.evolutionInstanceName, groupJid, body.participant)), transport, canEditDescription: true };
    if (!group) throw new Error('A conexão deste grupo não está configurada.');
    return response.json({ group: groupMetadataCache.set(group) });
  } catch (error) { const message = error instanceof Error ? error.message : 'Não foi possível adicionar o participante.'; return response.status(/\b(401|403)\b|admin|permission|not authorized/i.test(message) ? 403 : 502).json({ error: message }); }
});

app.post('/groups/leave', async (request, response) => {
  if (!(await requireBridgeUser(request, response))) return;
  const body = request.body as { inboxId?: unknown; conversationId?: unknown; transport?: unknown };
  if (!Number.isInteger(body.inboxId) || !Number.isInteger(body.conversationId)) return response.status(400).json({ error: 'Grupo inválido.' });
  try {
    const inbox = await chatwootBridge.findWhatsAppInboxById(body.inboxId as number); const groupJid = await chatwootBridge.conversationGroupTarget(body.conversationId as number, body.inboxId as number); const transport = groupTransport(inbox.configuration, body.transport);
    if (!transport) return response.status(409).json({ error: 'Não foi possível determinar o transporte deste grupo.', category: 'transport_unavailable' });
    if (transport === 'meta_cloud') return response.status(422).json({ error: 'A Meta Cloud não permite sair de grupos.', category: 'unsupported_operation' });
    if (transport === 'waha') { if (!inbox.configuration.wahaSessionName) throw new Error('A sessão WAHA desta inbox não está configurada.'); await wahaTransport.leaveGroup(inbox.configuration.wahaSessionName, groupJid); }
    else { if (!inbox.configuration.evolutionInstanceName) throw new Error('A instância Evolution desta inbox não está configurada.'); await evolutionBridge.leaveGroup(inbox.configuration.evolutionInstanceName, groupJid); }
    return response.status(204).end();
  } catch (error) { const message = error instanceof Error ? error.message : 'Não foi possível sair do grupo.'; return response.status(/\b(401|403)\b|admin|permission|not authorized/i.test(message) ? 403 : 502).json({ error: message }); }
});
const saveConnectionStatus = (accountId: number, inboxId: number, transport: 'evolution' | 'waha' | 'meta_cloud', status: ConnectionStatus) =>
  chatwootBridge.withAccount(accountId, () => chatwootBridge.updateInboxAdditionalAttributes(inboxId, connectionStatusPatch(transport, status)));

// A provider quote ID is not a Chatwoot message ID. Resolve it before message
// creation so Chatwoot persists its native `in_reply_to` relation and the UI
// can render the quoted card immediately. Keep the external ID as a fallback
// when the original is outside the retained conversation history.
const replyTargetId = async (conversationId: number, transport: 'evolution' | 'waha' | 'meta_cloud', quotedMessageId?: string) => {
  if (!quotedMessageId) return undefined;
  try {
    const target = await chatwootBridge.messageTargetBySourceId(externalMessageId(transport, quotedMessageId));
    return target.conversation_id === conversationId ? target.id : undefined;
  } catch {
    return undefined;
  }
};

// App ID and Configuration ID are browser-safe inputs required by Facebook
// Login for Business. App Secret and every access token intentionally remain
// absent from this response.
app.get('/meta/embedded-signup/config', (_request, response) => {
  if (!config.metaAppId || !config.metaEmbeddedSignupConfigId) return response.status(503).json({ error: 'Embedded Signup is not configured on this bridge.' });
  return response.json({ appId: config.metaAppId, configurationId: config.metaEmbeddedSignupConfigId, graphApiVersion: config.metaGraphVersion, embeddedSignupVersion: 4 });
});

app.post('/meta/embedded-signup/start', async (request, response) => {
  if (!(await enforceRateLimit(request, response, 'embedded-signup-start', 10, 600))) return;
  if (!(await requireBridgeAdministrator(request, response))) return;
  if (!config.metaAppId || !config.metaAppSecret || !config.metaEmbeddedSignupConfigId) return response.status(503).json({ error: 'Embedded Signup is not fully configured.' });
  const body = request.body as { accountId?: unknown; inboxId?: unknown; inboxName?: unknown; onboardingMode?: unknown };
  const inboxId = body.inboxId === null || body.inboxId === undefined ? null : body.inboxId;
  const onboardingMode: MetaOnboardingMode = body.onboardingMode === 'coexistence' ? 'coexistence' : 'standard';
  if (!Number.isInteger(body.accountId) || (inboxId !== null && !Number.isInteger(inboxId)) || (inboxId === null && (typeof body.inboxName !== 'string' || !body.inboxName.trim()))) return response.status(400).json({ error: 'Invalid Embedded Signup request.' });
  try {
    if (inboxId !== null) await chatwootBridge.withAccount(body.accountId as number, () => chatwootBridge.findWhatsAppInboxById(inboxId as number));
    const session = await metaEmbeddedSignupSessions.start({ accountId: body.accountId as number, inboxId: inboxId as number | null, inboxName: inboxId === null ? (body.inboxName as string).trim() : null, onboardingMode });
    return response.status(201).json({ onboardingSession: session.id, expiresAt: session.expiresAt });
  } catch (error) {
    console.warn('[meta-embedded-signup] start rejected', { inboxId, error: error instanceof Error ? error.message : 'unknown error' });
    return response.status(422).json({ error: 'The selected inbox cannot receive Meta Cloud configuration.' });
  }
});

app.post('/meta/embedded-signup/complete', async (request, response) => {
  if (!(await enforceRateLimit(request, response, 'embedded-signup-complete', 10, 600))) return;
  if (!(await requireBridgeAdministrator(request, response))) return;
  const body = request.body as { onboardingSession?: unknown; code?: unknown; publicResult?: { onboardingMode?: unknown; wabaId?: unknown; phoneNumberId?: unknown; businessId?: unknown } };
  if (typeof body.onboardingSession !== 'string' || typeof body.code !== 'string' || !body.publicResult || (body.publicResult.onboardingMode !== 'standard' && body.publicResult.onboardingMode !== 'coexistence') || typeof body.publicResult.wabaId !== 'string' || (body.publicResult.onboardingMode === 'standard' && typeof body.publicResult.phoneNumberId !== 'string')) return response.status(400).json({ error: 'Invalid Embedded Signup completion.' });
  const session = await metaEmbeddedSignupSessions.get(body.onboardingSession);
  if (!session || session.stage !== 'started') return response.status(409).json({ error: 'The onboarding session is expired, invalid, or was already used.' });
  if (session.onboardingMode !== body.publicResult.onboardingMode) return response.status(422).json({ error: 'The Meta completion event does not match the requested onboarding flow.' });
  try {
    const completed = await metaCloud.completeEmbeddedSignup(body.code, {
      onboardingMode: body.publicResult.onboardingMode, wabaId: body.publicResult.wabaId, phoneNumberId: typeof body.publicResult.phoneNumberId === 'string' ? body.publicResult.phoneNumberId : null,
      businessId: typeof body.publicResult.businessId === 'string' ? body.publicResult.businessId : null,
    });
    session.stage = 'validated';
    session.pending = completed;
    await metaEmbeddedSignupSessions.save(session);
    return response.json({ connection: completed.connection, webhookReady: completed.webhookReady, onboardingMode: session.onboardingMode });
  } catch (error) {
    console.warn('[meta-embedded-signup] completion failed', { error: error instanceof Error ? error.message : 'unknown error' });
    return response.status(422).json({ error: 'Could not exchange and validate Meta authorization.' });
  }
});

app.post('/meta/embedded-signup/finalize', async (request, response) => {
  if (!(await requireBridgeAdministrator(request, response))) return;
  const body = request.body as { onboardingSession?: unknown; inboxId?: unknown };
  if (typeof body.onboardingSession !== 'string' || !Number.isInteger(body.inboxId)) return response.status(400).json({ error: 'Invalid Embedded Signup finalization.' });
  const session = await metaEmbeddedSignupSessions.get(body.onboardingSession);
  if (!session || session.stage !== 'validated' || !session.pending) return response.status(409).json({ error: 'The onboarding session is not ready for finalization.' });
  // Existing inboxes are pinned at /start. New-inbox sessions use a random,
  // expiring server-side capability; their target must be an API inbox in the
  // configured Chatwoot account before its credential can be persisted.
  if (!metaEmbeddedSignupSessions.permitsInbox(session, body.inboxId as number) || !(await chatwootBridge.isApiInbox(body.inboxId as number))) return response.status(422).json({ error: 'This onboarding session cannot be associated with that inbox.' });
  try {
    await metaConfigs.save(body.inboxId as number, session.pending.config);
    const completed = await metaEmbeddedSignupSessions.consume(session.id);
    return response.json({ connection: completed?.pending?.connection, webhookReady: completed?.pending?.webhookReady, inboxId: body.inboxId });
  } catch (error) {
    console.error('[meta-embedded-signup] finalization failed', { inboxId: body.inboxId, error: error instanceof Error ? error.message : 'unknown error' });
    return response.status(502).json({ error: 'Could not persist Meta credentials.' });
  }
});
app.post('/providers/meta/validate', async (request, response) => {
  if (!(await enforceRateLimit(request, response, 'meta-configuration', 20, 60))) return;
  if (!(await requireBridgeAdministrator(request, response))) return;
  try {
    const body = request.body as { inboxId?: unknown; wabaId?: unknown; phoneNumberId?: unknown; accessToken?: unknown };
    if (!Number.isInteger(body.inboxId) || typeof body.wabaId !== 'string' || typeof body.phoneNumberId !== 'string' || typeof body.accessToken !== 'string') return response.status(400).json({ error: 'Invalid Meta configuration' });
    const connection = await metaCloud.validateManual({ wabaId: body.wabaId, phoneNumberId: body.phoneNumberId, accessToken: body.accessToken });
    await metaConfigs.save(body.inboxId as number, { wabaId: body.wabaId, phoneNumberId: body.phoneNumberId, accessToken: body.accessToken });
    return response.status(200).json({ connection });
  } catch (error) {
    console.warn('[meta-cloud] validation failed', { error: error instanceof Error ? error.message : 'unknown error' });
    return response.status(422).json({ error: 'Could not validate Meta Cloud credentials' });
  }
});

app.get('/providers/meta/inboxes/:inboxId/templates', async (request, response) => {
  if (!(await requireBridgeUser(request, response))) return;
  const inboxId = Number(request.params.inboxId);
  if (!Number.isInteger(inboxId) || inboxId < 1) return response.status(400).json({ error: 'Invalid inbox ID' });
  try {
    const inbox = await chatwootBridge.findWhatsAppInboxById(inboxId);
    if (!inbox.configuration.transports.includes('meta_cloud')) return response.status(422).json({ error: 'Templates require Meta Cloud on this inbox.' });
    const credentials = await metaConfigs.get(inboxId);
    if (!credentials) return response.status(422).json({ error: 'Meta Cloud requires reconnection.' });
    const templates = await metaCloud.listTemplates(credentials);
    return response.json({ templates });
  } catch (error) {
    console.error('[meta-cloud] list templates failed', { inboxId, error: error instanceof MetaCloudError ? error.category : 'unknown' });
    return response.status(502).json({ error: 'Could not load Meta templates.' });
  }
});

app.post('/operations/templates', templateHeaderUpload.single('header'), async (request, response) => {
  if (!(await enforceRateLimit(request, response, 'templates', 30, 60))) return;
  if (!(await requireBridgeUser(request, response))) return;
  const rawBody = request.body as { inboxId?: unknown; conversationId?: unknown; template?: unknown };
  const uploadedHeader = (request as express.Request & { file?: { buffer: Buffer; mimetype: string; originalname: string } }).file;
  let template: unknown = rawBody.template;
  if (typeof rawBody.template === 'string') {
    try { template = JSON.parse(rawBody.template) as unknown; }
    catch { return response.status(400).json({ error: 'Invalid template operation.' }); }
  }
  const body = { ...rawBody, template } as { inboxId?: unknown; conversationId?: unknown; template?: { name?: unknown; language?: unknown; components?: unknown } };
  if (!Number.isInteger(body.inboxId) || !Number.isInteger(body.conversationId) || !body.template || typeof body.template.name !== 'string' || typeof body.template.language !== 'string' || (body.template.components !== undefined && !Array.isArray(body.template.components))) return response.status(400).json({ error: 'Invalid template operation.' });
  try {
    const inbox = await chatwootBridge.findWhatsAppInboxById(body.inboxId as number);
    if (!inbox.configuration.transports.includes('meta_cloud')) return response.status(422).json({ error: 'Templates require Meta Cloud on this inbox.' });
    const rawInbox = await chatwootBridge.findApiInboxById(inbox.id);
    if (rawInbox.additionalAttributes.meta_connection_status === 'disconnected' || rawInbox.additionalAttributes.meta_connection_status === 'error') return response.status(409).json({ error: 'Meta Cloud is disconnected.', category: 'transport_unavailable' });
    const credentials = await metaConfigs.get(inbox.id);
    if (!credentials) {
      return response.status(409).json({ error: 'Meta Cloud requires reconnection.', category: 'transport_unavailable' });
    }
    const number = await chatwootBridge.conversationRecipient(body.conversationId as number, inbox.id);
    const components = (body.template.components as Array<Record<string, unknown>> | undefined)?.map(component => ({ ...component })) || [];
    const header = components.find(component => String(component.type).toLowerCase() === 'header');
    const headerParameter = header && Array.isArray(header.parameters) ? header.parameters[0] as Record<string, unknown> | undefined : undefined;
    const headerKind = headerParameter && (headerParameter.type === 'image' || headerParameter.type === 'video' || headerParameter.type === 'document') ? headerParameter.type : null;
    if (headerKind && !uploadedHeader) return response.status(422).json({ error: 'Este template exige o arquivo do cabeçalho.' });
    if (uploadedHeader && !headerKind) return response.status(422).json({ error: 'O arquivo de cabeçalho não corresponde ao template selecionado.' });
    if (uploadedHeader && headerKind) {
      const mediaId = await metaCloud.uploadTemplateHeaderMedia(credentials, { buffer: uploadedHeader.buffer, contentType: uploadedHeader.mimetype, fileName: uploadedHeader.originalname, kind: headerKind });
      header!.parameters = [{ type: headerKind, [headerKind]: { id: mediaId, ...(headerKind === 'document' ? { filename: uploadedHeader.originalname } : {}) } }];
    }
    const sent = await metaCloud.sendTemplate(credentials, number, { name: body.template.name, language: body.template.language, components: components.length ? components : undefined });
    await chatwootBridge.createSentMetaTemplateMessage(body.conversationId as number, sent.messageId, { name: body.template.name, language: body.template.language });
    bridgeMetrics.increment('whatsapp_templates_sent_total', { transport: 'meta_cloud' });
    return response.status(201).json({ sourceId: externalMessageId('meta_cloud', sent.messageId) });
  } catch (error) {
    const category = error instanceof MetaCloudError ? error.category : 'unknown';
    if (error instanceof MetaCloudError && ['authentication', 'permission', 'number'].includes(error.category)) {
      return response.status(409).json({ error: 'Meta Cloud is unavailable.', category: 'transport_unavailable' });
    }
    console.error('[meta-cloud] template send failed', { category });
    return response.status(422).json({ error: 'Could not send Meta template.', category });
  }
});

app.post('/providers/evolution/instances', async (request, response) => {
  if (!(await enforceRateLimit(request, response, 'evolution-configuration', 20, 60))) return;
  if (!(await requireBridgeAdministrator(request, response))) return;
  const instanceName = (request.body as { instanceName?: unknown }).instanceName;
  if (typeof instanceName !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(instanceName)) return response.status(400).json({ error: 'Invalid Evolution instance name' });
  try { return response.status(201).json(await evolutionBridge.createInstance(instanceName)); }
  catch (error) { console.error('[evolution-bridge] instance creation failed', { error: error instanceof Error ? error.message : 'unknown error' }); return response.status(502).json({ error: 'Could not create Evolution instance' }); }
});

app.get('/providers/evolution/instances/:instanceName/connection', async (request, response) => {
  if (!(await requireBridgeAdministrator(request, response))) return;
  try { return response.json(await evolutionBridge.getConnection(request.params.instanceName)); }
  catch { return response.status(502).json({ error: 'Could not read Evolution connection' }); }
});

app.get('/providers/evolution/instances/:instanceName/qr', async (request, response) => {
  if (!(await requireBridgeAdministrator(request, response))) return;
  try { return response.json(await evolutionBridge.getQrCode(request.params.instanceName)); }
  catch { return response.status(502).json({ error: 'Could not request Evolution QR code' }); }
});

app.post('/providers/evolution/instances/:instanceName/webhook', async (request, response) => {
  if (!(await requireBridgeAdministrator(request, response))) return;
  try { return response.json(await evolutionBridge.configureWebhook(request.params.instanceName)); }
  catch (error) { return response.status(422).json({ error: error instanceof Error ? error.message : 'Could not configure Evolution webhook' }); }
});

app.delete('/providers/evolution/instances/:instanceName', async (request, response) => {
  if (!(await requireBridgeAdministrator(request, response))) return;
  try { return response.json(await evolutionBridge.disconnect(request.params.instanceName)); }
  catch { return response.status(502).json({ error: 'Could not disconnect Evolution instance' }); }
});

const validWahaSessionName = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
const wahaContext = async (request: express.Request, response: express.Response, source: Record<string, unknown>) => {
  // Query parameters arrive as strings while POST bodies are numeric JSON.
  // Normalize them server-side; never use their value as authorization by
  // itself—profile auth and an account-scoped inbox lookup still follow.
  const number = (value: unknown) => typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN;
  const accountId = number(source.accountId); const inboxId = number(source.inboxId);
  if (!Number.isInteger(accountId) || !Number.isInteger(inboxId)) { response.status(403).json({ error: 'WAHA session is not available for this inbox.' }); return null; }
  const sessionHeaders = chatwootSessionHeaders(request);
  if (!sessionHeaders) { response.status(401).json({ error: 'Unauthorized' }); return null; }
  try { await chatwootBridge.findApiInboxByIdForSession(accountId as number, inboxId as number, sessionHeaders); return { accountId: accountId as number, inboxId: inboxId as number }; }
  catch { response.status(403).json({ error: 'WAHA session is not available for this inbox.' }); return null; }
};
const wahaOwnershipResponse = (response: express.Response, error: unknown) => {
  if (error instanceof WahaSessionOwnershipError) return response.status(error.code === 'conflict' ? 409 : 403).json({ error: 'WAHA session is not available for this inbox.' });
  return null;
};
const configureWahaInbox = async (accountId: number, inboxId: number, sessionName: string, status?: string) => chatwootBridge.withAccount(accountId, async () => {
  const inbox = await chatwootBridge.findApiInboxById(inboxId);
  const configuration = transportConfigurationForInbox(inbox.additionalAttributes);
  const transports = [...new Set([...(configuration?.transports || []), 'waha'])];
  await chatwootBridge.updateInboxAdditionalAttributes(inboxId, { waha_session_name: sessionName, waha_provider: 'waha', ...(status ? connectionStatusPatch('waha', status as ConnectionStatus) : {}), whatsapp_transports: transports, whatsapp_mode: transports.length > 1 ? 'hybrid' : 'web' });
});
const clearWahaInbox = async (accountId: number, inboxId: number) => chatwootBridge.withAccount(accountId, async () => {
  const inbox = await chatwootBridge.findApiInboxById(inboxId);
  const configuration = transportConfigurationForInbox(inbox.additionalAttributes);
  const transports = (configuration?.transports || []).filter((transport) => transport !== 'waha');
  await chatwootBridge.updateInboxAdditionalAttributes(inboxId, {
    waha_session_name: '', ...connectionStatusPatch('waha', 'disconnected'),
    whatsapp_transports: transports,
    whatsapp_mode: transports.length > 1 ? 'hybrid' : transports[0] === 'meta_cloud' ? 'official' : transports[0] === 'evolution' ? 'web' : '',
  });
});

// This endpoint is intentionally scoped to a Chatwoot session and inbox. It
// follows the exact same route selector used by outgoing webhooks, including
// the Meta-first private route of hybrid inboxes.
app.get('/providers/whatsapp/inboxes/:inboxId/connection', async (request, response) => {
  if (!(await requireBridgeUser(request, response))) return;
  const accountId = Number(request.query.accountId);
  const inboxId = Number(request.params.inboxId);
  const chatType = request.query.chatType === 'group' ? 'group' : 'private';
  if (!Number.isInteger(accountId) || !Number.isInteger(inboxId)) return response.status(400).json({ error: 'Invalid inbox context.' });
  const headers = chatwootSessionHeaders(request);
  if (!headers) return response.status(401).json({ error: 'Unauthorized' });
  try {
    const inbox = await chatwootBridge.findApiInboxByIdForSession(accountId, inboxId, headers);
    const configuration = transportConfigurationForInbox(inbox.additionalAttributes);
    if (!configuration) return response.json({ applicable: false, sendAllowed: true });
    const transport = resolveOutgoingTransport({ configuration, chatType });
    if (!transport) return response.json({ applicable: true, sendAllowed: false, transport: null, status: 'disconnected' });
    let status: ConnectionStatus = 'pending';
    if (transport === 'evolution') {
      if (!configuration.evolutionInstanceName) status = 'disconnected';
      else {
        try { status = evolutionConnectionStatus(await evolutionBridge.getConnection(configuration.evolutionInstanceName)); }
        catch { status = 'error'; }
      }
    } else if (transport === 'waha') {
      if (!configuration.wahaSessionName) status = 'disconnected';
      else {
        try {
          const session = await wahaTransport.getSession(configuration.wahaSessionName);
          status = session.connectionStatus;
          await wahaSessions.update(configuration.wahaSessionName, { status: session.status, engine: session.engine, phone: session.me?.id });
        } catch { status = 'error'; }
      }
    } else {
      status = metaConnectionStatus(inbox.additionalAttributes.meta_connection_status, Boolean(await metaConfigs.get(inboxId)));
    }
    await saveConnectionStatus(accountId, inboxId, transport, status);
    return response.json({ applicable: true, transport, status, sendAllowed: status === 'connected' });
  } catch (error) {
    return response.status(403).json({ error: 'WhatsApp inbox is not available for this account.' });
  }
});
// Controlled one-time adoption for inboxes configured before ownership storage
// existed. The bridge verifies the account-scoped Chatwoot inbox itself; it
// never adopts an arbitrary browser-provided session name.
const adoptLegacyWahaOwnership = async (accountId: number, inboxId: number) => {
  const inbox = await chatwootBridge.withAccount(accountId, () => chatwootBridge.findApiInboxById(inboxId));
  const sessionName = inbox.additionalAttributes.waha_session_name;
  const transports = transportConfigurationForInbox(inbox.additionalAttributes)?.transports || [];
  if (typeof sessionName !== 'string' || !validWahaSessionName(sessionName) || !transports.includes('waha')) return null;
  const existing = await wahaSessions.get(sessionName);
  if (existing) return existing;
  return wahaSessions.reserve({ accountId, inboxId, sessionName });
};
const wahaErrorResponse = (response: express.Response, error: unknown) => {
  // WAHA responses are normalized before reaching the browser. Keep enough
  // server-side context to diagnose an integration failure without logging a
  // request Authorization header, API key, QR content, or media payload.
  console.warn('[waha] operation failed', {
    kind: error instanceof WahaApiError ? error.kind : 'unknown',
    status: error instanceof WahaApiError ? error.status : undefined,
    message: error instanceof Error ? error.message.slice(0, 240) : 'unknown error',
  });
  if (error instanceof WahaApiError && error.kind === 'not_configured') return response.status(503).json({ error: 'WAHA is not configured on this bridge.' });
  if (error instanceof WahaApiError && error.kind === 'timeout') return response.status(504).json({ error: 'WAHA request timed out.' });
  if (error instanceof WahaApiError && error.kind === 'api' && error.status === 404) return response.status(404).json({ error: 'WAHA session was not found.' });
  if (error instanceof WahaApiError && error.kind === 'api' && error.status === 422 && /already exists|já existe/i.test(error.message)) return response.status(409).json({ error: 'Já existe uma sessão WAHA com esse nome. Escolha outro nome para esta caixa.' });
  if (error instanceof WahaApiError && error.kind === 'api') return response.status(502).json({ error: 'WAHA rejected the session operation.' });
  return response.status(502).json({ error: 'Could not communicate with WAHA.' });
};

const wahaHistoryStartTimestamp = (range: WahaHistoryRange) => range === 'all' ? undefined : Math.floor((Date.now() - ({ '7d': 7, '30d': 30, '90d': 90 }[range] * 24 * 60 * 60 * 1000)) / 1000);
const wahaStatusForAck = (ack?: number): 'sent' | 'delivered' | 'read' | 'failed' => ack === -1 ? 'failed' : ack === 3 || ack === 4 ? 'read' : ack === 2 ? 'delivered' : 'sent';
const retryHistoryOperation = async <T>(operation: () => Promise<T>, attempts = 2): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try { return await operation(); }
    catch (error) { lastError = error; if (attempt + 1 < attempts) await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1))); }
  }
  throw lastError;
};

type WahaHistoryProfiles = {
  names: Map<string, string>;
  avatarUrls: Map<string, Promise<string | undefined>>;
  syncedContacts: Set<number>;
};

type WahaLiveProfiles = {
  names: Map<string, string>;
  avatarUrls: Map<string, Promise<string | undefined>>;
  expiresAt: number;
  loading?: Promise<void>;
};

const wahaLiveProfiles = new Map<string, WahaLiveProfiles>();
const wahaChatProfileCacheMs = 10 * 60 * 1000;

const profileCacheForWahaSession = (session: string) => {
  let profiles = wahaLiveProfiles.get(session);
  if (!profiles) {
    profiles = { names: new Map(), avatarUrls: new Map(), expiresAt: 0 };
    wahaLiveProfiles.set(session, profiles);
  }
  return profiles;
};

const refreshWahaChatProfiles = async (session: string, profiles: WahaLiveProfiles) => {
  if (profiles.expiresAt > Date.now()) return;
  if (!profiles.loading) {
    profiles.loading = (async () => {
      const names = new Map<string, string>();
      // WAHA does not include profile names in every realtime webhook. Fetch
      // the chat index in pages and cache it rather than making one request
      // per incoming message.
      for (let offset = 0; ; offset += 500) {
        const chats = await wahaTransport.listChats(session, { limit: 500, offset });
        for (const chat of chats) if (chat.name) names.set(chat.id, chat.name);
        if (chats.length < 500) break;
      }
      profiles.names = names;
      profiles.expiresAt = Date.now() + wahaChatProfileCacheMs;
    })().catch(error => {
      // Names and photos enrich a conversation but cannot prevent messages
      // from being delivered when WAHA's chat index is temporarily unavailable.
      console.warn('[waha] chat profile lookup failed', { session, error: error instanceof Error ? error.message : 'unknown' });
      profiles.expiresAt = Date.now() + 60_000;
    }).finally(() => { profiles.loading = undefined; });
  }
  await profiles.loading;
};

const profileForLiveWahaMessage = async (message: IncomingWahaMessage): Promise<IncomingWahaMessage> => {
  const profiles = profileCacheForWahaSession(message.session);
  const needsName = message.chatType === 'group' ? !message.groupName : !message.contactName;
  if (needsName) await refreshWahaChatProfiles(message.session, profiles);
  const phone = message.phoneNumber?.replace(/\D/g, '');
  const nameCandidates = [message.chatId, message.remoteJid, phone && `${phone}@c.us`, phone && `${phone}@s.whatsapp.net`].filter((value): value is string => Boolean(value));
  const name = nameCandidates.map(candidate => profiles.names.get(candidate)).find((value): value is string => Boolean(value));
  let avatarUrl = message.avatarUrl;
  if (!avatarUrl) {
    const avatarKey = nameCandidates.find(candidate => profiles.names.has(candidate)) || message.chatId;
    let pending = profiles.avatarUrls.get(avatarKey);
    if (!pending) {
      pending = wahaTransport.getChatAvatarUrl(message.session, avatarKey).catch(() => undefined);
      profiles.avatarUrls.set(avatarKey, pending);
    }
    avatarUrl = await pending;
  }
  return {
    ...message,
    ...(name && message.chatType === 'group' ? { name, groupName: name } : {}),
    ...(name && message.chatType === 'private' ? { name, contactName: name } : {}),
    ...(avatarUrl ? { avatarUrl } : {}),
  };
};

const historyProfileFor = async (session: string, message: IncomingWahaMessage, profiles: WahaHistoryProfiles): Promise<IncomingWahaMessage> => {
  let phoneNumber = message.phoneNumber;
  if (!phoneNumber && message.lid) {
    try {
      const phone = await wahaTransport.resolveLid(session, message.lid);
      if (phone) phoneNumber = `+${phone}`;
    } catch { /* A LID is still a valid stable identity when WAHA cannot resolve it. */ }
  }
  const phone = phoneNumber?.replace(/\D/g, '');
  const candidates = [message.chatId, phone && `${phone}@c.us`, phone && `${phone}@s.whatsapp.net`].filter((value): value is string => Boolean(value));
  const contactName = candidates.map(candidate => profiles.names.get(candidate)).find((value): value is string => Boolean(value)) || message.contactName;
  const avatarKey = candidates.find(candidate => profiles.names.has(candidate)) || message.chatId;
  let avatarUrl: string | undefined;
  try {
    let pending = profiles.avatarUrls.get(avatarKey);
    if (!pending) {
      pending = wahaTransport.getChatAvatarUrl(session, avatarKey).catch(() => undefined);
      profiles.avatarUrls.set(avatarKey, pending);
    }
    avatarUrl = await pending;
  } catch { /* Profile pictures are optional and must never block history. */ }
  return {
    ...message,
    ...(phoneNumber ? { phoneNumber, sourceId: `whatsapp:${phone}` } : {}),
    ...(contactName ? { name: contactName, contactName } : {}),
    ...(avatarUrl ? { avatarUrl } : {}),
  };
};

const importWahaHistoricalMessage = async (job: WahaHistoryJob, raw: unknown, conversations: Set<number>, profiles: WahaHistoryProfiles) => {
  const parsed = parseWahaHistoryMessage(job.sessionName, raw);
  const message = parsed && await historyProfileFor(job.sessionName, parsed, profiles);
  await wahaHistory.addMetrics(job.accountId, job.inboxId, { processed: 1 });
  if (!message || (!message.content && !message.media)) {
    await wahaHistory.addMetrics(job.accountId, job.inboxId, { skipped: 1 });
    return;
  }
  const key = externalMessageId('waha', message.externalId);
  // Resolve/update the contact before the duplicate fast-path. A retry must
  // enrich names and avatars on conversations imported by an older bridge,
  // while still never creating a second message.
  const inbox = await wahaInboxForWebhook(job.sessionName);
  const { contact, conversation } = await conversationForWahaIdentity(inbox, message, profiles.syncedContacts);
  const historyConversationId = conversation.internal_id || conversation.id;
  conversations.add(historyConversationId);
  if (message.chatType === 'group') await chatwootBridge.saveEvolutionGroup(contact.id, message.remoteJid, message.name, { participants: message.participantJid ? [{ jid: message.participantJid, name: message.participantName }] : undefined });
  let existingMessage: Awaited<ReturnType<typeof chatwootBridge.messageTargetBySourceId>> | undefined;
  try { existingMessage = await chatwootBridge.messageTargetBySourceId(key); } catch { /* The historical message does not exist yet. */ }
  // The first import may have inserted the text shell while WAHA was still
  // fetching its file. Use a separate lock for this one safe media backfill.
  const needsMediaBackfill = Boolean(message.media && existingMessage && !existingMessage.attachments_count);
  const dedupKey = needsMediaBackfill ? `${key}:history-media` : key;
  if (await dedup.hasOrLock(dedupKey)) {
    await wahaHistory.addMetrics(job.accountId, job.inboxId, { duplicates: 1 });
    return;
  }
  try {
    if (existingMessage && !needsMediaBackfill) {
      await dedup.commit(dedupKey);
      await wahaHistory.addMetrics(job.accountId, job.inboxId, { duplicates: 1 });
      return;
    }
    let media: Awaited<ReturnType<typeof wahaTransport.downloadMedia>> | undefined;
    let mediaUnavailable = false;
    if (message.media) {
      try {
        // The list API is called with downloadMedia=false. Fetch each file
        // separately under bounded worker concurrency so old chats cannot
        // exhaust RAM or flood WAHA.
        const hydrated = parseWahaHistoryMessage(job.sessionName, await retryHistoryOperation(() => wahaTransport.getHistoryMessage(job.sessionName, message.externalId)));
        if (!hydrated?.media) throw new Error('WAHA não disponibilizou a mídia histórica.');
        media = await wahaTransport.downloadMedia(hydrated.media);
      } catch (error) {
        mediaUnavailable = true;
        await wahaHistory.addMetrics(job.accountId, job.inboxId, { mediaFailed: 1 });
        console.warn('[waha] historical media unavailable', { trackId: job.trackId, inboxId: job.inboxId, messageId: message.externalId.slice(-12), error: error instanceof Error ? error.message : 'unknown' });
      }
    }
    const result = await retryHistoryOperation(() => chatwootBridge.importHistoricalWhatsAppMessage(historyConversationId, {
      sourceId: key, threadId: message.chatId, timestamp: Math.floor(new Date(message.timestamp).getTime() / 1000),
      content: message.content, transport: 'waha', direction: message.fromMe ? 'outgoing' : 'incoming', remoteJid: message.remoteJid,
      quotedMessageId: message.quotedMessageId, status: wahaStatusForAck(message.ack), mediaType: message.media?.kind,
      mediaUnavailable, media, context: { chatType: message.chatType, participantJid: message.participantJid, participantName: message.participantName, isForwarded: message.isForwarded, forwardingScore: message.forwardingScore },
    }));
    if (needsMediaBackfill && !media) {
      // Keep this retryable: WAHA may make a historical attachment available
      // later, while the message itself remains safely deduplicated.
      dedup.release(dedupKey);
    } else await dedup.commit(dedupKey);
    await wahaHistory.addMetrics(job.accountId, job.inboxId, result.created
      ? { imported: 1, ...(media ? { mediaImported: 1 } : {}) }
      : { duplicates: 1, ...(media ? { mediaImported: 1 } : {}) });
  } catch (error) {
    dedup.release(dedupKey);
    await wahaHistory.addMetrics(job.accountId, job.inboxId, { failed: 1 });
    console.error('[waha] historical message import failed', { trackId: job.trackId, inboxId: job.inboxId, messageId: message.externalId.slice(-12), error: error instanceof Error ? error.message : 'unknown' });
  }
};

const importWahaHistory = async (job: WahaHistoryJob) => {
  await wahaHistory.update(job.accountId, job.inboxId, { status: 'running', startedAt: new Date().toISOString(), lastError: undefined });
  const conversations = new Set<number>();
  const timestampGte = wahaHistoryStartTimestamp(job.requestedRange);
  const profiles: WahaHistoryProfiles = { names: new Map(), avatarUrls: new Map(), syncedContacts: new Set() };
  let offset = 0;
  try {
    await chatwootBridge.withAccount(job.accountId, async () => {
    // History messages do not consistently contain push names (and GOWS uses
    // `from` for both directions). Read the session chat index once so the
    // import can retain the actual WhatsApp contact/group name.
    for (let chatOffset = 0; ; chatOffset += 500) {
      const chats = await retryHistoryOperation(() => wahaTransport.listChats(job.sessionName, { limit: 500, offset: chatOffset }));
      for (const chat of chats) if (chat.name) profiles.names.set(chat.id, chat.name);
      if (chats.length < 500) break;
    }
    for (;;) {
      const current = await wahaHistory.get(job.accountId, job.inboxId, job.id);
      if (!current || current.status === 'cancelled') return;
      const page = await retryHistoryOperation(() => wahaTransport.listHistoryMessages(job.sessionName, { limit: config.wahaHistoryPageSize, offset, timestampGte }));
      if (!page.length) break;
      // WAHA does not promise sort direction. Oldest first maximizes the
      // chance that a quoted target is present when its reply is inserted.
      page.sort((left, right) => {
        const leftTime = typeof (left as Record<string, unknown>)?.timestamp === 'number' ? (left as Record<string, number>).timestamp : 0;
        const rightTime = typeof (right as Record<string, unknown>)?.timestamp === 'number' ? (right as Record<string, number>).timestamp : 0;
        return leftTime - rightTime;
      });
      await parallelForEach(page, config.wahaHistoryMessageConcurrency, item => importWahaHistoricalMessage(job, item, conversations, profiles));
      // WAHA documents offset pagination in units of the requested LIMIT,
      // including a final short page.
      offset += config.wahaHistoryPageSize;
    }
    await parallelForEach([...conversations], config.wahaHistoryMessageConcurrency, conversationId => chatwootBridge.resolveHistoricalReplies(conversationId));
    await wahaHistory.update(job.accountId, job.inboxId, { status: 'completed', finishedAt: new Date().toISOString(), conversations: conversations.size });
    });
  } catch (error) {
    await wahaHistory.update(job.accountId, job.inboxId, { status: 'failed', finishedAt: new Date().toISOString(), conversations: conversations.size, lastError: error instanceof Error ? error.message.slice(0, 300) : 'Falha desconhecida na importação WAHA.' });
    console.error('[waha] history import failed', { trackId: job.trackId, inboxId: job.inboxId, error: error instanceof Error ? error.message : 'unknown' });
  }
};

const startWahaHistoryImport = async (job: WahaHistoryJob) => {
  const running = wahaHistoryImports.get(job.inboxId);
  if (running) throw new Error('Uma importação de histórico já está em andamento para esta inbox.');
  const lease = await bridgeRedis.acquireLease(`waha-history-import:${job.accountId}:${job.inboxId}`, 6 * 60 * 60);
  if (!lease) throw new Error('Uma importação de histórico já está em andamento para esta inbox.');
  const task = importWahaHistory(job).finally(async () => {
    await bridgeRedis.releaseLease(`waha-history-import:${job.accountId}:${job.inboxId}`, lease);
    wahaHistoryImports.delete(job.inboxId);
  });
  wahaHistoryImports.set(job.inboxId, task);
};

// WAHA is reached only through these authenticated bridge endpoints. This
// keeps its API key and private Docker address out of the Vite application.
app.get('/providers/waha/health', async (request, response) => {
  if (!(await requireBridgeAdministrator(request, response))) return;
  try { return response.json({ ok: true, result: await wahaTransport.health() }); }
  catch (error) { return wahaErrorResponse(response, error); }
});

app.get('/providers/waha/sessions', async (request, response) => {
  if (!(await requireBridgeAdministrator(request, response))) return;
  const context = await wahaContext(request, response, request.query as Record<string, unknown>); if (!context) return;
  try {
    await adoptLegacyWahaOwnership(context.accountId, context.inboxId);
    const owned = await wahaSessions.list(context.accountId, context.inboxId);
    const sessions = await Promise.all(owned.map(async ownership => {
      try { const session = await wahaTransport.getSession(ownership.sessionName); await wahaSessions.update(ownership.sessionName, { status: session.status, engine: session.engine, phone: session.me?.id }); return session; }
      catch (error) { if (error instanceof WahaApiError && error.status === 404) return null; throw error; }
    }));
    return response.json({ sessions: sessions.filter((item): item is NonNullable<typeof item> => Boolean(item)) });
  }
  catch (error) { return wahaErrorResponse(response, error); }
});

app.post('/providers/waha/sessions', async (request, response) => {
  if (!(await enforceRateLimit(request, response, 'waha-session-configuration', 20, 60))) return;
  if (!(await requireBridgeAdministrator(request, response))) return;
  const { sessionName, engine, start } = request.body as { sessionName?: unknown; engine?: unknown; start?: unknown };
  const context = await wahaContext(request, response, request.body as Record<string, unknown>); if (!context) return;
  const generatedName = typeof sessionName === 'string' && validWahaSessionName(sessionName) ? sessionName : `waha_${randomUUID().replace(/-/g, '').slice(0, 24)}`;
  if ((sessionName !== undefined && !validWahaSessionName(sessionName)) || (engine !== undefined && (typeof engine !== 'string' || !/^[A-Z0-9_-]{2,40}$/.test(engine)))) return response.status(400).json({ error: 'Invalid WAHA session request.' });
  try {
    await adoptLegacyWahaOwnership(context.accountId, context.inboxId);
    // Ownership is durable, while WAHA sessions can be removed manually during
    // recovery. Reconcile stale ownership records before deciding that an inbox
    // still has a connection.
    const ownedSessions = await wahaSessions.list(context.accountId, context.inboxId);
    for (const ownership of ownedSessions) {
      try { await wahaTransport.getSession(ownership.sessionName); }
      catch (error) {
        if (error instanceof WahaApiError && error.status === 404) await wahaSessions.remove(context.accountId, context.inboxId, ownership.sessionName);
        else throw error;
      }
    }
    if ((await wahaSessions.list(context.accountId, context.inboxId)).length) return response.status(409).json({ error: 'Esta caixa já possui uma conexão WAHA. Exclua a conexão atual antes de criar outra.' });
    await wahaSessions.reserve({ ...context, sessionName: generatedName, ...(typeof engine === 'string' ? { engine } : {}) });
    let created;
    try { created = await wahaTransport.createSession({ name: generatedName, ...(typeof engine === 'string' ? { engine } : {}) }); }
    catch (error) { await wahaSessions.remove(context.accountId, context.inboxId, generatedName); throw error; }
    const session = start === false ? created : await wahaTransport.startSession(generatedName);
    await wahaSessions.update(generatedName, { status: session.status, engine: session.engine, phone: session.me?.id });
    await configureWahaInbox(context.accountId, context.inboxId, generatedName, session.connectionStatus);
    return response.status(201).json({ session });
  } catch (error) { return wahaOwnershipResponse(response, error) || wahaErrorResponse(response, error); }
});

app.get('/providers/waha/sessions/:sessionName', async (request, response) => {
  if (!(await requireBridgeAdministrator(request, response))) return;
  if (!validWahaSessionName(request.params.sessionName)) return response.status(400).json({ error: 'Invalid WAHA session name.' }); const context = await wahaContext(request, response, request.query as Record<string, unknown>); if (!context) return;
  try { await wahaSessions.assertOwned(context.accountId, context.inboxId, request.params.sessionName); const session = await wahaTransport.getSession(request.params.sessionName); await saveConnectionStatus(context.accountId, context.inboxId, 'waha', session.connectionStatus); return response.json({ session }); }
  catch (error) { return wahaOwnershipResponse(response, error) || wahaErrorResponse(response, error); }
});

app.post('/providers/waha/sessions/:sessionName/start', async (request, response) => {
  if (!(await requireBridgeAdministrator(request, response))) return;
  if (!validWahaSessionName(request.params.sessionName)) return response.status(400).json({ error: 'Invalid WAHA session name.' }); const context = await wahaContext(request, response, request.body as Record<string, unknown>); if (!context) return;
  try { await wahaSessions.assertOwned(context.accountId, context.inboxId, request.params.sessionName); const session = await wahaTransport.startSession(request.params.sessionName); await wahaSessions.update(session.name, { status: session.status, engine: session.engine, phone: session.me?.id }); await saveConnectionStatus(context.accountId, context.inboxId, 'waha', session.connectionStatus); return response.json({ session }); }
  catch (error) { return wahaOwnershipResponse(response, error) || wahaErrorResponse(response, error); }
});

app.post('/providers/waha/sessions/:sessionName/restart', async (request, response) => {
  if (!(await requireBridgeAdministrator(request, response))) return;
  if (!validWahaSessionName(request.params.sessionName)) return response.status(400).json({ error: 'Invalid WAHA session name.' }); const context = await wahaContext(request, response, request.body as Record<string, unknown>); if (!context) return;
  try { await wahaSessions.assertOwned(context.accountId, context.inboxId, request.params.sessionName); const session = await wahaTransport.restartSession(request.params.sessionName); await wahaSessions.update(session.name, { status: session.status, engine: session.engine, phone: session.me?.id }); await saveConnectionStatus(context.accountId, context.inboxId, 'waha', session.connectionStatus); return response.json({ session }); }
  catch (error) { return wahaOwnershipResponse(response, error) || wahaErrorResponse(response, error); }
});

app.post('/providers/waha/sessions/:sessionName/logout', async (request, response) => {
  if (!(await requireBridgeAdministrator(request, response))) return;
  if (!validWahaSessionName(request.params.sessionName)) return response.status(400).json({ error: 'Invalid WAHA session name.' }); const context = await wahaContext(request, response, request.body as Record<string, unknown>); if (!context) return;
  try { await wahaSessions.assertOwned(context.accountId, context.inboxId, request.params.sessionName); await wahaTransport.logoutSession(request.params.sessionName); await wahaSessions.update(request.params.sessionName, { status: 'STOPPED' }); await saveConnectionStatus(context.accountId, context.inboxId, 'waha', 'disconnected'); return response.status(204).end(); }
  catch (error) { return wahaOwnershipResponse(response, error) || wahaErrorResponse(response, error); }
});

app.delete('/providers/waha/sessions/:sessionName', async (request, response) => {
  if (!(await requireBridgeAdministrator(request, response))) return;
  if (!validWahaSessionName(request.params.sessionName)) return response.status(400).json({ error: 'Invalid WAHA session name.' });
  const context = await wahaContext(request, response, request.body as Record<string, unknown>); if (!context) return;
  try {
    await wahaSessions.assertOwned(context.accountId, context.inboxId, request.params.sessionName);
    await wahaTransport.deleteSession(request.params.sessionName);
    await wahaSessions.remove(context.accountId, context.inboxId, request.params.sessionName);
    await clearWahaInbox(context.accountId, context.inboxId);
    return response.status(204).end();
  } catch (error) { return wahaOwnershipResponse(response, error) || wahaErrorResponse(response, error); }
});

// Deleting an inbox through the WhatsApp UI must also remove its WAHA device
// session. This prevents an orphaned phone from staying connected after the
// Chatwoot inbox no longer exists.
app.delete('/providers/waha/inboxes/:inboxId', async (request, response) => {
  if (!(await requireBridgeAdministrator(request, response))) return;
  const inboxId = Number(request.params.inboxId);
  const context = await wahaContext(request, response, request.body as Record<string, unknown>); if (!context || context.inboxId !== inboxId) return;
  try {
    const inbox = await chatwootBridge.withAccount(context.accountId, () => chatwootBridge.findApiInboxById(inboxId));
    const sessionName = inbox.additionalAttributes.waha_session_name;
    if (validWahaSessionName(sessionName)) {
      const ownership = await wahaSessions.get(sessionName);
      if (ownership && ownership.accountId === context.accountId && ownership.inboxId === context.inboxId) {
        try { await wahaTransport.deleteSession(sessionName); }
        catch (error) { if (!(error instanceof WahaApiError && error.status === 404)) throw error; }
        await wahaSessions.remove(context.accountId, context.inboxId, sessionName);
      }
    }
    await chatwootBridge.withAccount(context.accountId, () => chatwootBridge.deleteInbox(inboxId));
    return response.status(204).end();
  } catch (error) { return wahaOwnershipResponse(response, error) || wahaErrorResponse(response, error); }
});

app.get('/providers/waha/sessions/:sessionName/qr', async (request, response) => {
  if (!(await requireBridgeAdministrator(request, response))) return;
  if (!validWahaSessionName(request.params.sessionName)) return response.status(400).json({ error: 'Invalid WAHA session name.' }); const context = await wahaContext(request, response, request.query as Record<string, unknown>); if (!context) return;
  try {
    await wahaSessions.assertOwned(context.accountId, context.inboxId, request.params.sessionName);
    // GOWS invalidates an unscanned QR after its short pairing window and
    // reports FAILED. "Mostrar QR Code" is an explicit reconnect action, so
    // renew that session before asking the QR endpoint (which only accepts
    // SCAN_QR_CODE). This avoids surfacing a misleading 502 to the operator.
    let session = await wahaTransport.getSession(request.params.sessionName);
    // A QR is short lived. Renew it for every explicit QR request while the
    // device is not connected, including SCAN_QR_CODE/STARTING, so the
    // operator never receives an already-expired pairing code.
    if (session.status !== 'WORKING') {
      session = await wahaTransport.restartSession(request.params.sessionName);
    }
    await wahaSessions.update(request.params.sessionName, { status: session.status, engine: session.engine, phone: session.me?.id });
    return response.json(await wahaTransport.getQrCode(request.params.sessionName));
  }
  catch (error) { return wahaOwnershipResponse(response, error) || wahaErrorResponse(response, error); }
});

// Existing sessions can only be associated when the durable ownership record
// already proves they belong to this exact account/inbox. Orphan WAHA sessions
// are intentionally invisible to tenants.
app.post('/providers/waha/sessions/:sessionName/associate', async (request, response) => {
  if (!(await enforceRateLimit(request, response, 'waha-session-configuration', 20, 60))) return;
  if (!(await requireBridgeAdministrator(request, response))) return;
  if (!validWahaSessionName(request.params.sessionName)) return response.status(400).json({ error: 'Invalid WAHA session name.' });
  const context = await wahaContext(request, response, request.body as Record<string, unknown>); if (!context) return;
  try {
    const ownership = await wahaSessions.assertOwned(context.accountId, context.inboxId, request.params.sessionName);
    await configureWahaInbox(context.accountId, context.inboxId, ownership.sessionName, ownership.status);
    return response.status(200).json({ ok: true });
  } catch (error) { return wahaOwnershipResponse(response, error) || wahaErrorResponse(response, error); }
});

const getWahaHistoryImport = async (request: express.Request, response: express.Response) => {
  if (!(await requireBridgeAdministrator(request, response))) return;
  const inboxId = Number(request.params.inboxId);
  const context = await wahaContext(request, response, request.query as Record<string, unknown>); if (!context || context.inboxId !== inboxId) return;
  try {
    const job = await wahaHistory.get(context.accountId, context.inboxId, request.params.jobId);
    // No previous import is a normal initial state, not an application error.
    if (!job && !request.params.jobId) return response.json({ job: null, running: false });
    if (!job) return response.status(404).json({ error: 'Importação de histórico não encontrada.' });
    return response.json({ job, running: wahaHistoryImports.has(context.inboxId) });
  } catch (error) { return response.status(502).json({ error: error instanceof Error ? error.message : 'Não foi possível consultar a importação WAHA.' }); }
};

// Keep these routes separate: Express 5 no longer accepts the old optional
// path parameter syntax reliably, which made the initial history lookup 404.
app.get('/providers/waha/inboxes/:inboxId/history/import', getWahaHistoryImport);
app.get('/providers/waha/inboxes/:inboxId/history/import/:jobId', getWahaHistoryImport);

app.post('/providers/waha/inboxes/:inboxId/history/import', async (request, response) => {
  if (!(await enforceRateLimit(request, response, 'waha-history-import', 5, 60))) return;
  if (!(await requireBridgeAdministrator(request, response))) return;
  const inboxId = Number(request.params.inboxId);
  const context = await wahaContext(request, response, request.body as Record<string, unknown>); if (!context || context.inboxId !== inboxId) return;
  const range = (request.body as { range?: unknown }).range;
  if (!['7d', '30d', '90d', 'all'].includes(String(range))) return response.status(400).json({ error: 'Período de histórico inválido.' });
  let createdJob: WahaHistoryJob | undefined;
  try {
    const inbox = await chatwootBridge.withAccount(context.accountId, () => chatwootBridge.findApiInboxById(context.inboxId));
    const sessionName = inbox.additionalAttributes.waha_session_name;
    if (!validWahaSessionName(sessionName)) return response.status(422).json({ error: 'Esta inbox não possui uma sessão WAHA associada.' });
    await wahaSessions.assertOwned(context.accountId, context.inboxId, sessionName);
    const session = await wahaTransport.getSession(sessionName);
    if (session.status !== 'WORKING') return response.status(422).json({ error: 'O histórico só pode ser importado quando a sessão WAHA estiver conectada.' });
    const job: WahaHistoryJob = {
      id: randomUUID(), accountId: context.accountId, inboxId: context.inboxId, sessionName, requestedRange: range as WahaHistoryRange,
      trackId: createTrackId(), status: 'pending', processed: 0, imported: 0, duplicates: 0, skipped: 0, failed: 0,
      mediaImported: 0, mediaFailed: 0, conversations: 0,
    };
    createdJob = await wahaHistory.create(job);
    await startWahaHistoryImport(job);
    return response.status(202).json({ job: await wahaHistory.get(context.accountId, context.inboxId, job.id) });
  } catch (error) {
    if (createdJob) await wahaHistory.update(createdJob.accountId, createdJob.inboxId, { status: 'failed', finishedAt: new Date().toISOString(), lastError: error instanceof Error ? error.message.slice(0, 300) : 'Não foi possível iniciar a importação.' });
    if (error instanceof WahaSessionOwnershipError) return response.status(403).json({ error: 'A sessão WAHA não está disponível para esta inbox.' });
    if (error instanceof Error && error.message.includes('andamento')) return response.status(409).json({ error: error.message });
    return wahaErrorResponse(response, error);
  }
});

app.post('/providers/waha/inboxes/:inboxId/history/import/:jobId/cancel', async (request, response) => {
  if (!(await requireBridgeAdministrator(request, response))) return;
  const inboxId = Number(request.params.inboxId);
  const context = await wahaContext(request, response, request.body as Record<string, unknown>); if (!context || context.inboxId !== inboxId) return;
  try {
    const job = await wahaHistory.get(context.accountId, context.inboxId, request.params.jobId);
    if (!job) return response.status(404).json({ error: 'Importação de histórico não encontrada.' });
    await wahaSessions.assertOwned(context.accountId, context.inboxId, job.sessionName);
    if (job.status === 'pending' || job.status === 'running') {
      const cancelled = await wahaHistory.update(context.accountId, context.inboxId, { status: 'cancelled', finishedAt: new Date().toISOString() });
      return response.json({ job: cancelled });
    }
    return response.json({ job });
  } catch (error) {
    if (error instanceof WahaSessionOwnershipError) return response.status(403).json({ error: 'A sessão WAHA não está disponível para esta inbox.' });
    return response.status(502).json({ error: 'Não foi possível cancelar a importação WAHA.' });
  }
});

app.get('/meta/history/:inboxId', async (request, response) => {
  if (!(await requireBridgeAdministrator(request, response))) return;
  const inboxId = Number(request.params.inboxId);
  if (!Number.isInteger(inboxId) || inboxId < 1) return response.status(400).json({ error: 'Invalid inbox ID' });
  try {
    await chatwootBridge.findWhatsAppInboxById(inboxId);
    return response.json({ ...(await metaHistory.summary(inboxId)), running: historyImports.has(inboxId) });
  } catch {
    return response.status(404).json({ error: 'WhatsApp inbox not found' });
  }
});

app.post('/meta/history/:inboxId/import', async (request, response) => {
  if (!(await enforceRateLimit(request, response, 'history-import', 5, 60))) return;
  if (!(await requireBridgeAdministrator(request, response))) return;
  const inboxId = Number(request.params.inboxId);
  if (!Number.isInteger(inboxId) || inboxId < 1) return response.status(400).json({ error: 'Invalid inbox ID' });
  try {
    await chatwootBridge.findWhatsAppInboxById(inboxId);
    if ((request.body as { retryFailed?: unknown })?.retryFailed === true) await metaHistory.retryFailed(inboxId);
    void startMetaHistoryImport(inboxId);
    return response.status(202).json({ ...(await metaHistory.summary(inboxId)), running: true });
  } catch (error) {
    console.error('[meta-cloud] history import could not start', { inboxId, error: error instanceof Error ? error.message : 'unknown error' });
    return response.status(422).json({ error: 'Could not start history import' });
  }
});

type EvolutionIdentityEvent = Pick<IncomingEvolutionMessage | IncomingEvolutionReaction, 'instance' | 'sourceId' | 'phoneNumber' | 'lid' | 'name' | 'chatType' | 'participantJid' | 'participantName'> & Partial<Pick<IncomingEvolutionMessage, 'remoteJid' | 'contactName'>>;

const conversationForEvolutionIdentity = async (event: EvolutionIdentityEvent) => {
  const inbox = await chatwootBridge.findInbox(event.instance);
  if (event.chatType === 'group') {
    if (!event.remoteJid?.endsWith('@g.us')) throw new Error('Evento de grupo sem identificador válido.');
    const contact = await chatwootBridge.createOrFindContact(inbox.identifier, { sourceId: event.sourceId, name: event.name });
    await chatwootBridge.saveEvolutionGroup(contact.id, event.remoteJid, event.name, { participants: event.participantJid ? [{ jid: event.participantJid, name: event.participantName }] : undefined });
    const conversation = await chatwootBridge.findOrCreateConversation(inbox.identifier, contact.source_id, contact.id, inbox.id);
    return { inbox, contact, conversation };
  }
  // Identity mappings are scoped to the Chatwoot inbox. An Evolution instance
  // can be disconnected and later attached to another inbox; reusing the old
  // instance-wide mapping would create another ContactInbox/thread there.
  const identityKeys = [event.phoneNumber && `${inbox.id}:phone:${normalizeBrazilianPhone(event.phoneNumber).replace(/\D/g, '')}`, event.lid && `${inbox.id}:lid:${event.lid}`].filter((key): key is string => Boolean(key));
  // The current inbox is the source of truth. It also covers contacts created
  // manually before their first WhatsApp message.
  const existingSource = await chatwootBridge.findContactSourceByPhone(inbox.id, event.phoneNumber) || await identities.find(identityKeys);
  const contact = await chatwootBridge.createOrFindContact(inbox.identifier, { ...event, sourceId: existingSource || event.sourceId });
  // Creation is idempotent in Chatwoot and does not refresh an existing
  // contact's display name. Keep a name supplied by WhatsApp, but never
  // replace a manually chosen name with the phone/LID fallback.
  if (event.contactName) await chatwootBridge.updatePublicContact(inbox.identifier, contact.source_id, { name: event.contactName });
  await chatwootBridge.saveEvolutionIdentity(contact.id, event.phoneNumber, event.lid);
  await identities.save(identityKeys, contact.source_id);
  const conversation = await chatwootBridge.findOrCreateConversation(inbox.identifier, contact.source_id, contact.id, inbox.id);
  return { inbox, contact, conversation };
};

const conversationForMetaIdentity = async (event: IncomingMetaMessage) => {
  const inbox = await chatwootBridge.findMetaInboxByPhoneNumberId(event.phoneNumberId);
  // Contact source is intentionally normalized by phone, just like the
  // Evolution lookup. This makes a hybrid inbox reuse its same contact and
  // single conversation instead of creating a Meta-specific identity.
  const existingSource = await chatwootBridge.findContactSourceByPhone(inbox.id, event.phoneNumber);
  const contact = await chatwootBridge.createOrFindContact(inbox.identifier, { sourceId: existingSource || event.sourceId, name: event.name, phoneNumber: event.phoneNumber });
  if (event.contactName) await chatwootBridge.updatePublicContact(inbox.identifier, contact.source_id, { name: event.contactName });
  const conversation = await chatwootBridge.findOrCreateConversation(inbox.identifier, contact.source_id, contact.id, inbox.id);
  return { inbox, contact, conversation };
};

const conversationForWahaIdentity = async (inbox: { id: number; identifier: string }, event: IncomingWahaMessage, profileSynced?: Set<number>) => {
  const syncProfile = async (contact: { id: number; source_id: string }) => {
    if ((!event.contactName && !event.avatarUrl) || profileSynced?.has(contact.id)) return;
    await chatwootBridge.updatePublicContact(inbox.identifier, contact.source_id, { name: event.contactName, avatarUrl: event.avatarUrl });
    profileSynced?.add(contact.id);
  };
  if (event.chatType === 'group') {
    const identityKeys = [`${inbox.id}:group:${event.remoteJid}`];
    const sourceId = await identities.find(identityKeys) || event.sourceId;
    const contact = await chatwootBridge.createOrFindContact(inbox.identifier, { sourceId, name: event.name, avatarUrl: event.avatarUrl });
    await identities.save(identityKeys, contact.source_id);
    await syncProfile(contact);
    const conversation = await chatwootBridge.findOrCreateConversation(inbox.identifier, contact.source_id, contact.id, inbox.id);
    return { contact, conversation };
  }
  // GOWS can emit a private chat as @lid. Resolve it through WAHA's official
  // LID API before looking up the Chatwoot contact, otherwise the same person
  // gets a second ContactInbox/conversation solely due to the identifier form.
  let phoneNumber = event.phoneNumber;
  if (!phoneNumber && event.lid) {
    try {
      const phone = await wahaTransport.resolveLid(event.session, event.lid);
      if (phone) phoneNumber = `+${phone}`;
    } catch (error) {
      console.warn('[waha] LID resolution unavailable', { session: event.session, lid: event.lid.slice(-8), error: error instanceof Error ? error.message : 'unknown' });
    }
  }
  phoneNumber = phoneNumber ? normalizeBrazilianPhone(phoneNumber) : phoneNumber;
  const identityKeys = [phoneNumber && `${inbox.id}:phone:${phoneNumber.replace(/\D/g, '')}`, event.lid && `${inbox.id}:lid:${event.lid}`].filter((key): key is string => Boolean(key));
  const existingSource = await chatwootBridge.findContactSourceByPhone(inbox.id, phoneNumber) || await identities.find(identityKeys);
  const contact = await chatwootBridge.createOrFindContact(inbox.identifier, {
    sourceId: existingSource || event.sourceId,
    name: event.name,
    ...(phoneNumber ? { phoneNumber } : {}),
    ...(event.avatarUrl ? { avatarUrl: event.avatarUrl } : {}),
  });
  await syncProfile(contact);
  await chatwootBridge.saveWahaIdentity(contact.id, phoneNumber, event.lid);
  await identities.save(identityKeys, contact.source_id);
  const conversation = await chatwootBridge.findOrCreateConversation(inbox.identifier, contact.source_id, contact.id, inbox.id);
  return { contact, conversation };
};

const parallelForEach = async <T>(items: T[], concurrency: number, handler: (item: T) => Promise<void>) => {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) await handler(item);
  }));
};

const importMetaHistory = async (inboxId: number) => {
  const inbox = await chatwootBridge.findWhatsAppInboxById(inboxId);
  if (!inbox.configuration.transports.includes('meta_cloud')) throw new Error('A inbox não possui Meta Cloud configurada.');
  const credentials = await metaConfigs.get(inboxId);
  if (!credentials) throw new Error('A inbox Meta não possui credenciais server-side.');
  await chatwootBridge.updateInboxAdditionalAttributes(inboxId, { meta_history_status: 'importing', meta_history_import_started_at: new Date().toISOString() });
  let imported = 0;
  let failed = 0;
  for (;;) {
    const claimed = await metaHistory.claim(inboxId, config.historyImportBatchSize);
    if (!claimed.length) break;
    await parallelForEach(claimed, config.historyMediaConcurrency, async (message) => {
      try {
        if ((message.direction !== 'incoming' && message.direction !== 'outgoing') || !message.timestamp) throw new Error('Evento histórico sem direção ou timestamp utilizável.');
        const contactNumber = message.direction === 'incoming' ? message.from : message.to;
        if (!contactNumber) throw new Error('Evento histórico sem identidade do contato.');
        const event: IncomingMetaMessage = {
          transport: 'meta_cloud', phoneNumberId: credentials.phoneNumberId, messageId: message.messageId,
          sourceId: `whatsapp:${contactNumber}`, phoneNumber: `+${contactNumber}`, name: `+${contactNumber}`,
          content: message.content, timestamp: message.timestamp,
        };
        const { conversation } = await conversationForMetaIdentity(event);
        let media: Awaited<ReturnType<typeof metaCloud.downloadMedia>> | undefined;
        let mediaUnavailable = false;
        if (message.media) {
          try { media = await metaCloud.downloadMedia(credentials, message.media); }
          catch (error) {
            mediaUnavailable = true;
            console.warn('[meta-cloud] historical media unavailable', { inboxId, sourceId: message.sourceId, category: error instanceof MetaCloudError ? error.category : 'unknown' });
          }
        }
        await chatwootBridge.importHistoricalMetaMessage(conversation.id, {
          message, direction: message.direction, remoteJid: `${contactNumber}@s.whatsapp.net`,
          status: message.historyStatus === 'read' || message.historyStatus === 'delivered' || message.historyStatus === 'failed' ? message.historyStatus : 'sent',
          media, mediaUnavailable,
        });
        await metaHistory.complete(inboxId, message.sourceId);
        imported += 1;
      } catch (error) {
        failed += 1;
        await metaHistory.fail(inboxId, message.sourceId, error instanceof Error ? error.message : 'Unknown history import error');
        console.error('[meta-cloud] historical message import failed', { inboxId, sourceId: message.sourceId, error: error instanceof Error ? error.message : 'unknown error' });
      }
    });
  }
  const summary = await metaHistory.summary(inboxId);
  await chatwootBridge.updateInboxAdditionalAttributes(inboxId, {
    meta_history_status: summary.failed ? 'failed' : 'synced', meta_history_imported_count: summary.imported,
    meta_history_failed_count: summary.failed, meta_history_import_finished_at: new Date().toISOString(),
  });
  console.info('[meta-cloud] history import completed', { inboxId, imported, failed, totalImported: summary.imported });
};

const startMetaHistoryImport = (inboxId: number) => {
  const running = historyImports.get(inboxId);
  if (running) return running;
  const task = (async () => {
    const lease = await bridgeRedis.acquireLease(`meta-history-import:${inboxId}`, 6 * 60 * 60);
    if (!lease) return;
    try {
      await importMetaHistory(inboxId);
    } finally {
      await bridgeRedis.releaseLease(`meta-history-import:${inboxId}`, lease);
    }
  })().catch(async error => {
    console.error('[meta-cloud] history import terminated', { inboxId, error: error instanceof Error ? error.message : 'unknown error' });
    const summary = await metaHistory.summary(inboxId);
    await chatwootBridge.updateInboxAdditionalAttributes(inboxId, { meta_history_status: 'failed', meta_history_failed_count: summary.failed });
  }).finally(() => historyImports.delete(inboxId));
  historyImports.set(inboxId, task);
  return task;
};

const validMetaSignature = (request: express.Request & { rawBody?: string }) => {
  // App secret is optional only for the existing local-development setup. A
  // production Meta app must define META_APP_SECRET, then unsigned callbacks
  // are rejected before parsing.
  if (!config.metaAppSecret) return process.env.NODE_ENV !== 'production';
  const signature = request.header('x-hub-signature-256');
  if (!signature?.startsWith('sha256=') || !request.rawBody) return false;
  const received = signature.slice('sha256='.length);
  const expected = createHmac('sha256', config.metaAppSecret).update(request.rawBody).digest('hex');
  return received.length === expected.length && timingSafeEqual(Buffer.from(received), Buffer.from(expected));
};

app.get('/webhooks/meta', (request, response) => {
  const mode = request.query['hub.mode'];
  const token = request.query['hub.verify_token'];
  const challenge = request.query['hub.challenge'];
  if (mode !== 'subscribe' || token !== config.metaWebhookVerifyToken || typeof challenge !== 'string') return response.sendStatus(403);
  return response.status(200).send(challenge);
});

app.post('/webhooks/meta', async (request, response) => {
  if (!validMetaSignature(request)) return response.status(401).json({ error: 'Invalid Meta signature' });
  const { messages, statuses, reactions, history, businessAppEchoes, accountUpdates } = parseMetaWebhook(request.body);
  try {
    for (const update of accountUpdates) {
      try {
        const inbox = await chatwootBridge.findMetaInboxByWabaId(update.wabaId);
        await chatwootBridge.updateInboxAdditionalAttributes(inbox.id, update.state === 'offboarded'
          ? { ...connectionStatusPatch('meta_cloud', 'disconnected'), meta_business_app_status: 'offboarded', meta_reconnect_required: true }
          : { ...connectionStatusPatch('meta_cloud', 'connected'), meta_business_app_status: 'active', meta_reconnect_required: false });
        console.info('[meta-cloud] coexistence account state updated', { inboxId: inbox.id, state: update.state });
      } catch (error) {
        console.info('[meta-cloud] coexistence account update ignored', { wabaId: update.wabaId, state: update.state, error: error instanceof Error ? error.message : 'unknown error' });
      }
    }
    for (const batch of history) {
      try {
        const inbox = await chatwootBridge.findMetaInboxByPhoneNumberId(batch.phoneNumberId);
        const state = batch.declined
          ? { meta_history_available: true, meta_history_authorized: false, meta_history_status: 'not_available' }
          : { meta_history_available: true, meta_history_authorized: true, meta_history_status: batch.progress === 100 ? 'ready' : 'receiving', ...(batch.phase !== null ? { meta_history_phase: batch.phase } : {}), ...(batch.chunkOrder !== null ? { meta_history_chunk_order: batch.chunkOrder } : {}), ...(batch.progress !== null ? { meta_history_progress: batch.progress } : {}) };
        await chatwootBridge.updateInboxAdditionalAttributes(inbox.id, state);
        const staged = batch.declined ? { added: 0 } : await metaHistory.stage(inbox.id, batch);
        // Do not log thread content, names, numbers or media IDs here.
        console.info('[meta-cloud] history batch staged', { inboxId: inbox.id, messages: staged.added, progress: batch.progress, declined: batch.declined });
      } catch (error) {
        console.error('[meta-cloud] history batch failed', { phoneNumberId: batch.phoneNumberId, error: error instanceof Error ? error.message : 'unknown error' });
        throw error;
      }
    }
    for (const status of statuses) {
      // Require a configured inbox for the Phone Number ID even though the
      // status mutation itself searches Chatwoot globally by namespaced ID.
      try {
        await chatwootBridge.findMetaInboxByPhoneNumberId(status.phoneNumberId);
        await chatwootBridge.updateWhatsAppMessageStatus(externalMessageId('meta_cloud', status.messageId), status.status, status.error);
      } catch (error) {
        // Statuses may legitimately arrive before an accepted-send response is
        // persisted or after message retention. They must not reject the whole
        // webhook batch or cause an endless retry loop.
        console.info('[meta-cloud] status ignored', { phoneNumberId: status.phoneNumberId, messageId: status.messageId, status: status.status, error: error instanceof Error ? error.message : 'unknown error' });
      }
    }
    for (const reaction of reactions) {
      const dedupId = `meta-reaction:${reaction.eventId}`;
      if (await dedup.hasOrLock(dedupId)) continue;
      try {
        await chatwootBridge.findMetaInboxByPhoneNumberId(reaction.phoneNumberId);
        await chatwootBridge.updateWhatsAppReactionBySourceId(externalMessageId('meta_cloud', reaction.targetMessageId), {
          senderId: `contact:${reaction.senderId}`, emoji: reaction.emoji, transport: 'meta_cloud', origin: 'contact', eventId: reaction.eventId,
        });
        await dedup.commit(dedupId);
        bridgeMetrics.increment('whatsapp_reactions_received_total', { transport: 'meta_cloud' });
      } catch (error) {
        dedup.release(dedupId);
        console.info('[meta-cloud] reaction ignored', { phoneNumberId: reaction.phoneNumberId, eventId: reaction.eventId, error: error instanceof Error ? error.message : 'unknown error' });
      }
    }
    for (const event of messages) {
      const dedupId = externalMessageId('meta_cloud', event.messageId);
      if (await dedup.hasOrLock(dedupId)) continue;
      try {
        const { inbox, contact, conversation } = await conversationForMetaIdentity(event);
        const credentials = await metaConfigs.get(inbox.id);
        if (!credentials) throw new Error(`A inbox Meta ${inbox.id} não possui credenciais server-side.`);
        const media = event.media ? await metaCloud.downloadMedia(credentials, event.media) : undefined;
        if (media) {
          await chatwootBridge.createIncomingTransportMediaMessage(conversation.id, 'meta_cloud', event.content, event.messageId, media, event.quotedMessageId, event.phoneNumber.replace(/^\+/, ''));
        } else {
          await chatwootBridge.createIncomingTransportMessage(inbox.identifier, contact.source_id, conversation.id, 'meta_cloud', event.content, event.messageId, event.quotedMessageId, event.phoneNumber.replace(/^\+/, ''));
        }
        await dedup.commit(dedupId);
        bridgeMetrics.increment('whatsapp_messages_received_total', { transport: 'meta_cloud', media: Boolean(event.media) });
        console.info('[meta-cloud] incoming message created', { inboxId: inbox.id, conversationId: conversation.id, messageId: event.messageId, media: Boolean(event.media) });
      } catch (error) {
        dedup.release(dedupId);
        console.error('[meta-cloud] incoming message failed', { phoneNumberId: event.phoneNumberId, messageId: event.messageId, error: error instanceof Error ? error.message : 'unknown error' });
        throw error;
      }
    }
    for (const event of businessAppEchoes) {
      const dedupId = externalMessageId('meta_cloud', event.messageId);
      if (await dedup.hasOrLock(dedupId)) continue;
      try {
        const { inbox, contact, conversation } = await conversationForMetaIdentity(event);
        const credentials = await metaConfigs.get(inbox.id);
        if (!credentials) throw new Error(`A inbox Meta ${inbox.id} não possui credenciais server-side.`);
        const media = event.media ? await metaCloud.downloadMedia(credentials, event.media) : undefined;
        if (media) await chatwootBridge.createBusinessAppEchoMediaMessage(conversation.id, event.content, event.messageId, media, event.quotedMessageId, event.phoneNumber.replace(/^\+/, ''));
        else await chatwootBridge.createBusinessAppEchoMessage(conversation.id, event.content, event.messageId, event.quotedMessageId, event.phoneNumber.replace(/^\+/, ''));
        await dedup.commit(dedupId);
        console.info('[meta-cloud] WhatsApp Business App echo created', { inboxId: inbox.id, conversationId: conversation.id, messageId: event.messageId, media: Boolean(event.media) });
      } catch (error) {
        dedup.release(dedupId);
        console.error('[meta-cloud] WhatsApp Business App echo failed', { phoneNumberId: event.phoneNumberId, messageId: event.messageId, error: error instanceof Error ? error.message : 'unknown error' });
        throw error;
      }
    }
    return response.status(200).json({ ok: true });
  } catch (error) {
    console.error('[meta-cloud] webhook processing failed', { error: error instanceof Error ? error.message : 'unknown error' });
    return response.status(502).json({ error: 'Could not process Meta webhook' });
  }
});

const wahaInboxForWebhook = async (sessionName: string) => {
  let ownership = await wahaSessions.get(sessionName);
  if (!ownership) {
    // Legacy adoption is available only when a one-account fallback was
    // explicitly configured. New sessions always have durable ownership.
    if (!config.chatwootDefaultAccountId) throw new WahaSessionOwnershipError('not_found');
    const inbox = await chatwootBridge.withAccount(config.chatwootDefaultAccountId, () => chatwootBridge.findWahaInbox(sessionName));
    ownership = await adoptLegacyWahaOwnership(config.chatwootDefaultAccountId, inbox.id);
  }
  if (!ownership) throw new WahaSessionOwnershipError('not_found');
  const inbox = await chatwootBridge.withAccount(ownership.accountId, () => chatwootBridge.findWahaInbox(sessionName));
  if (inbox.id !== ownership.inboxId) throw new WahaSessionOwnershipError('forbidden');
  return { ...inbox, accountId: ownership.accountId };
};

app.post('/webhooks/waha', (request, response) => {
  if (!config.wahaWebhookSecret) return response.status(503).json({ error: 'WAHA webhook is not configured.' });
  const hmac = request.header('x-webhook-hmac');
  const expected = (request as express.Request & { rawBody?: string }).rawBody
    ? createHmac('sha512', config.wahaWebhookSecret).update((request as express.Request & { rawBody?: string }).rawBody!).digest('hex')
    : '';
  if (!hmac || hmac.length !== expected.length || !timingSafeEqual(Buffer.from(hmac), Buffer.from(expected))) return response.status(401).json({ error: 'Unauthorized' });
  const event = parseWahaWebhook(request.body);
  void (async () => {
    if (event.event === 'session.status' && typeof event.session === 'string') {
      try {
        const inbox = await wahaInboxForWebhook(event.session);
        const payload = request.body && typeof request.body === 'object' ? request.body as Record<string, unknown> : {};
        const data = payload.payload && typeof payload.payload === 'object' ? payload.payload as Record<string, unknown> : payload.data && typeof payload.data === 'object' ? payload.data as Record<string, unknown> : {};
        const rawStatus = String(data.status || data.state || '').toUpperCase();
        const status: ConnectionStatus = rawStatus === 'WORKING' ? 'connected' : rawStatus === 'STARTING' || rawStatus === 'SCAN_QR_CODE' ? 'connecting' : rawStatus === 'STOPPED' ? 'disconnected' : 'error';
        await wahaSessions.update(event.session, { status: rawStatus || 'FAILED' });
        await saveConnectionStatus(inbox.accountId, inbox.id, 'waha', status);
      } catch (error) { console.warn('[waha] session status ignored', { session: event.session, error: error instanceof Error ? error.message : 'unknown' }); }
      return;
    }
    const groupLifecycle = parseIncomingWahaGroupLifecycle(request.body);
    if (groupLifecycle) {
      const key = `waha-group:${groupLifecycle.session}:${groupLifecycle.event}:${groupLifecycle.externalId || groupLifecycle.timestamp}`;
      if (await dedup.hasOrLock(key)) return;
      try {
        const inbox = await wahaInboxForWebhook(groupLifecycle.session);
        await chatwootBridge.withAccount(inbox.accountId, async () => {
          const identityKeys = [`${inbox.id}:group:${groupLifecycle.groupId}`];
          const sourceId = await identities.find(identityKeys) || wahaGroupSourceId(groupLifecycle.groupId);
          const contact = await chatwootBridge.createOrFindContact(inbox.identifier, { sourceId, name: groupLifecycle.subject || groupLifecycle.groupId });
          await identities.save(identityKeys, contact.source_id);
          await chatwootBridge.saveEvolutionGroup(contact.id, groupLifecycle.groupId, groupLifecycle.subject || groupLifecycle.groupId, { avatarUrl: groupLifecycle.avatarUrl, description: groupLifecycle.description, participants: groupLifecycle.participants, participantAction: groupLifecycle.participantAction });
          await chatwootBridge.findOrCreateConversation(inbox.identifier, contact.source_id, contact.id, inbox.id);
        });
        await dedup.commit(key);
      } catch (error) { dedup.release(key); console.error('[waha] group lifecycle processing failed', { trackId: groupLifecycle.trackId, event: groupLifecycle.event, error: error instanceof Error ? error.message : 'unknown' }); }
      return;
    }
    const parsedMessage = parseIncomingWahaMessage(request.body);
    const message = parsedMessage && await profileForLiveWahaMessage(parsedMessage);
    if (message) {
      console.info('[waha] message normalized', {
        trackId: message.trackId,
        session: message.session,
        messageId: message.externalId,
        chatType: message.chatType,
        fromMe: message.fromMe,
        hasContent: Boolean(message.content),
        hasMedia: Boolean(message.media),
        mediaKind: message.media?.kind,
        hasMediaUrl: Boolean(message.media?.url),
        hasMediaData: Boolean(message.media?.data),
      });
      const key = externalMessageId('waha', message.externalId);
      if (await dedup.hasOrLock(key)) return;
      try {
        const inbox = await wahaInboxForWebhook(message.session);
        if (message.fromMe && consumePendingWahaOutgoing(message.session, message)) {
          await dedup.commit(key);
          console.info('[waha] platform echo ignored', { session: message.session, messageId: message.externalId });
          return;
        }
        let conversationId: number | undefined;
        await chatwootBridge.withAccount(inbox.accountId, async () => {
          const { contact, conversation } = await conversationForWahaIdentity(inbox, message);
          conversationId = conversation.id;
          if (message.chatType === 'group') await chatwootBridge.saveEvolutionGroup(contact.id, message.remoteJid, message.name, { participants: message.participantJid ? [{ jid: message.participantJid, name: message.participantName }] : undefined });
          // The public API message endpoint does not infer a Chatwoot internal
          // reply id from provider metadata reliably. Resolve the namespaced
          // WAHA key first and send both the internal and external identity.
          const inReplyTo = await replyTargetId(conversation.id, 'waha', message.quotedMessageId);
          const context = { chatType: message.chatType, participantJid: message.participantJid, participantName: message.participantName, isForwarded: message.isForwarded, forwardingScore: message.forwardingScore };
          if (message.media) {
            const media = await wahaTransport.downloadMedia(message.media);
            if (message.fromMe) await chatwootBridge.createMobileOutgoingTransportMediaMessage(conversation.id, 'waha', message.content, message.externalId, media, message.quotedMessageId, message.remoteJid, inReplyTo, context);
            else await chatwootBridge.createIncomingTransportMediaMessage(conversation.id, 'waha', message.content, message.externalId, media, message.quotedMessageId, message.remoteJid, inReplyTo, context);
          } else if (message.fromMe) await chatwootBridge.createMobileOutgoingTransportMessage(conversation.id, 'waha', message.content, message.externalId, message.quotedMessageId, message.remoteJid, inReplyTo, context);
          else await chatwootBridge.createIncomingTransportMessage(inbox.identifier, contact.source_id, conversation.id, 'waha', message.content, message.externalId, message.quotedMessageId, message.remoteJid, inReplyTo, context);
        });
        await dedup.commit(key); bridgeMetrics.increment('whatsapp_messages_received_total', { transport: 'waha', media: Boolean(message.media) });
        console.info('[waha] message created', { trackId: message.trackId, messageId: message.externalId, conversationId, media: Boolean(message.media) });
      } catch (error) { dedup.release(key); console.error('[waha] message processing failed', { trackId: message.trackId, event: message.event, error: error instanceof Error ? error.message : 'unknown' }); }
      return;
    }
    if (event.event === 'message' || event.event === 'message.any') {
      console.warn('[waha] message ignored by parser', { trackId: event.trackId, session: event.session, event: event.event, externalId: event.externalId });
    }
    const reaction = parseIncomingWahaReaction(request.body);
    if (reaction) {
      let routedInbox;
      try { routedInbox = await wahaInboxForWebhook(reaction.session); } catch { return; }
      const key = `waha-reaction:${reaction.session}:${reaction.targetMessageId}:${reaction.senderId}:${reaction.emoji}`;
      if (await dedup.hasOrLock(key)) return;
      try { await chatwootBridge.withAccount(routedInbox.accountId, () => chatwootBridge.updateWhatsAppReactionBySourceId(externalMessageId('waha', reaction.targetMessageId), { senderId: reaction.senderId, emoji: reaction.emoji, transport: 'waha', origin: reaction.fromMe ? 'mobile' : 'contact', eventId: reaction.trackId })); await dedup.commit(key); }
      catch { dedup.release(key); }
      return;
    }
    const mutation = parseIncomingWahaMutation(request.body);
    if (mutation) {
      let routedInbox;
      try { routedInbox = await wahaInboxForWebhook(mutation.session); } catch { return; }
      const key = `waha-${mutation.event}:${mutation.targetMessageId}`; if (await dedup.hasOrLock(key)) return;
      try { await chatwootBridge.withAccount(routedInbox.accountId, async () => { if (mutation.event === 'message.edited' && mutation.content) await chatwootBridge.editWhatsAppMessageBySourceId(externalMessageId('waha', mutation.targetMessageId), mutation.content); if (mutation.event === 'message.revoked') await chatwootBridge.revokeWhatsAppMessageBySourceId(externalMessageId('waha', mutation.targetMessageId)); }); await dedup.commit(key); } catch { dedup.release(key); }
    }
    if (event.event === 'message.ack' || event.event === 'message.ack.group') {
      const root = request.body as Record<string, unknown>; const payload = root.payload && typeof root.payload === 'object' ? root.payload as Record<string, unknown> : {};
      const rawId = typeof payload.messageId === 'string' ? payload.messageId : typeof payload.id === 'string' ? payload.id : null;
      const id = rawId ? normalizeWahaMessageId(rawId) : null;
      const ack = typeof payload.ack === 'number' ? payload.ack : null;
      const status = ack === -1 ? 'failed' : ack === 3 || ack === 4 ? 'read' : ack === 2 ? 'delivered' : ack === 0 || ack === 1 ? 'sent' : null;
      if (id && status) {
        // WAHA can deliver ACK before the outbound Chatwoot message has been
        // associated with its provider ID. That is an expected race, not a
        // fatal webhook error. A later ACK/retry will update it normally.
        try {
          const routedInbox = await wahaInboxForWebhook(event.session);
          await chatwootBridge.withAccount(routedInbox.accountId, () => chatwootBridge.updateWhatsAppMessageStatus(externalMessageId('waha', id), status));
          console.info('[waha] ACK applied', { messageId: id.slice(-12), ack, status });
        }
        catch (error) {
          // Keep ACK compatibility with messages stored before canonical WAHA
          // IDs were introduced (they used the full true_/false_ value).
          if (rawId !== id) {
            try {
              await chatwootBridge.withAccount((await wahaInboxForWebhook(event.session)).accountId, () => chatwootBridge.updateWhatsAppMessageStatus(externalMessageId('waha', rawId), status));
              console.info('[waha] ACK applied to legacy ID', { messageId: id.slice(-12), ack, status });
              return;
            }
            catch { /* log the original lookup error below */ }
          }
          console.warn('[waha] ACK target not available yet', { messageId: id.slice(-12), status, error: error instanceof Error ? error.message : 'unknown' });
        }
      }
    }
  })();
  console.info('[waha] webhook received', { trackId: event.trackId, event: event.event, session: event.session, externalId: event.externalId?.slice(-12) });
  bridgeMetrics.increment('whatsapp_webhooks_received_total', { transport: 'waha', category: event.category });
  return response.status(202).json({ ok: true, trackId: event.trackId });
});

app.post('/webhooks/evolution', async (request, response) => {
  const providedSecret = request.header('x-bridge-secret') || request.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (providedSecret !== config.webhookSecret) return response.status(401).json({ error: 'Unauthorized' });
  const groupUpdates = parseIncomingEvolutionGroupLifecycle(request.body);
  if (groupUpdates.length) {
    try {
      for (const update of groupUpdates) {
        const dedupId = `${update.instance}:group:${update.eventId}`;
        if (await dedup.hasOrLock(dedupId)) continue;
        const inbox = await chatwootBridge.findInbox(update.instance);
        const sourceId = evolutionGroupSourceId(update.groupJid);
        const contact = await chatwootBridge.createOrFindContact(inbox.identifier, { sourceId, name: update.subject || update.groupJid });
        await chatwootBridge.saveEvolutionGroup(contact.id, update.groupJid, update.subject || update.groupJid, update);
        await chatwootBridge.findOrCreateConversation(inbox.identifier, contact.source_id, contact.id, inbox.id);
        await dedup.commit(dedupId);
      }
      return response.status(200).json({ ok: true });
    } catch (error) {
      console.error('[evolution-bridge] group lifecycle processing failed', { error: error instanceof Error ? error.message : 'unknown error' });
      return response.status(502).json({ error: 'Could not update WhatsApp group metadata' });
    }
  }
  const edited = parseIncomingEvolutionEdit(request.body);
  if (edited) {
    const dedupId = `${edited.instance}:edit:${edited.targetMessageId}:${createHmac('sha256', config.webhookSecret).update(edited.content).digest('hex').slice(0, 16)}`;
    if (await dedup.hasOrLock(dedupId)) return response.status(200).json({ duplicate: true });
    try {
      await chatwootBridge.editWhatsAppMessageBySourceId(externalMessageId('evolution', edited.targetMessageId), edited.content);
      await dedup.commit(dedupId);
      bridgeMetrics.increment('whatsapp_messages_edited_total', { transport: 'evolution' });
      return response.status(200).json({ ok: true });
    } catch (error) {
      dedup.release(dedupId);
      console.error('[evolution-bridge] edit processing failed', { instance: edited.instance, messageId: edited.targetMessageId, error: error instanceof Error ? error.message : 'unknown error' });
      return response.status(502).json({ error: 'Could not update edited WhatsApp message' });
    }
  }
  const revoked = parseIncomingEvolutionRevoke(request.body);
  if (revoked) {
    const dedupId = `${revoked.instance}:revoke:${revoked.targetMessageId}`;
    if (await dedup.hasOrLock(dedupId)) return response.status(200).json({ duplicate: true });
    try {
      await chatwootBridge.revokeWhatsAppMessageBySourceId(externalMessageId('evolution', revoked.targetMessageId));
      await dedup.commit(dedupId);
      bridgeMetrics.increment('whatsapp_messages_revoked_total', { transport: 'evolution' });
      return response.status(200).json({ ok: true });
    } catch (error) {
      dedup.release(dedupId);
      console.error('[evolution-bridge] revoke processing failed', { instance: revoked.instance, messageId: revoked.targetMessageId, error: error instanceof Error ? error.message : 'unknown error' });
      return response.status(502).json({ error: 'Could not update revoked WhatsApp message' });
    }
  }
  const reaction = parseIncomingEvolutionReaction(request.body);
  if (reaction) {
    const dedupId = `${reaction.instance}:reaction:${reaction.eventId}`;
    if (await dedup.hasOrLock(dedupId)) return response.status(200).json({ duplicate: true });
    try {
      const { conversation } = await conversationForEvolutionIdentity(reaction);
      await chatwootBridge.updateWhatsAppReaction(conversation.id, externalMessageId('evolution', reaction.targetMessageId), {
        senderId: reaction.senderId,
        emoji: reaction.emoji,
        transport: 'evolution',
        origin: reaction.fromMe ? 'mobile' : 'contact',
        eventId: reaction.eventId,
      });
      await dedup.commit(dedupId);
      console.info('[evolution-bridge] reaction updated', { instance: reaction.instance, conversationId: conversation.id, targetMessageId: reaction.targetMessageId, fromMe: reaction.fromMe });
      return response.status(200).json({ ok: true });
    } catch (error) {
      dedup.release(dedupId);
      console.error('[evolution-bridge] reaction processing failed', { instance: reaction.instance, eventId: reaction.eventId, targetMessageId: reaction.targetMessageId, error: error instanceof Error ? error.message : 'unknown error' });
      return response.status(502).json({ error: 'Could not update WhatsApp reaction' });
    }
  }
  const event = parseIncomingEvolutionMessage(request.body);
  if (!event) return response.status(202).json({ ignored: true });
  const dedupId = `${event.instance}:${event.messageId}`;
  if (await dedup.hasOrLock(dedupId)) return response.status(200).json({ duplicate: true });
  try {
    console.info('[evolution-bridge] event received', { instance: event.instance, number: event.phoneNumber, messageId: event.messageId });
    const { inbox, contact, conversation } = await conversationForEvolutionIdentity(event);
    console.info('[evolution-bridge] inbox found', { instance: event.instance, inboxId: inbox.id });
    console.info('[evolution-bridge] contact found or created', { sourceId: contact.source_id });
    console.info('[evolution-bridge] conversation found or created', { conversationId: conversation.id });
    const inReplyTo = await replyTargetId(conversation.id, 'evolution', event.quotedMessageId);
    const downloadedMedia = event.media ? await evolutionBridge.downloadMedia(event.instance, event.media) : undefined;
    if (event.fromMe && downloadedMedia) {
      await chatwootBridge.createMobileOutgoingMediaMessage(conversation.id, event.content, event.messageId, downloadedMedia, event.quotedMessageId, event.remoteJid, event, inReplyTo);
    } else if (event.fromMe) {
      await chatwootBridge.createMobileOutgoingMessage(conversation.id, event.content, event.messageId, event.quotedMessageId, event.remoteJid, event, inReplyTo);
    } else if (downloadedMedia) {
      await chatwootBridge.createIncomingMediaMessage(conversation.id, event.content, event.messageId, downloadedMedia, event.quotedMessageId, event.remoteJid, event, inReplyTo);
    } else {
      await chatwootBridge.createIncomingMessage(inbox.identifier, contact.source_id, conversation.id, event.content, event.messageId, event.quotedMessageId, event.remoteJid, event, inReplyTo);
    }
    await dedup.commit(dedupId);
    bridgeMetrics.increment('whatsapp_messages_received_total', { transport: 'evolution', media: Boolean(event.media) });
    console.info('[evolution-bridge] mobile message created', { conversationId: conversation.id, messageId: event.messageId, fromMe: event.fromMe });
    return response.status(201).json({ ok: true });
  } catch (error) {
    dedup.release(dedupId);
    console.error('[evolution-bridge] processing failed', { instance: event.instance, messageId: event.messageId, error: error instanceof Error ? error.message : 'unknown error' });
    return response.status(502).json({ error: 'Could not deliver message to Chatwoot' });
  }
});

app.post('/operations/messages/:operation', async (request, response) => {
  const operation = request.params.operation;
  if (operation !== 'edit' && operation !== 'revoke') return response.status(404).json({ error: 'Unknown WhatsApp message operation' });
  if (!(await enforceRateLimit(request, response, `message-${operation}`, 60, 60))) return;
  if (!(await requireBridgeUser(request, response))) return;
  const body = request.body as Record<string, unknown>;
  const { accountId, inboxId, sourceId, remoteJid, targetFromMe, participantJid, content } = body;
  if (!Number.isInteger(accountId) || !Number.isInteger(inboxId) || typeof sourceId !== 'string' || typeof remoteJid !== 'string' || typeof targetFromMe !== 'boolean' || (participantJid !== undefined && typeof participantJid !== 'string' && participantJid !== null) || (operation === 'edit' && (typeof content !== 'string' || !content.trim()))) return response.status(400).json({ error: 'Invalid WhatsApp message operation' });
  const external = parseExternalMessageId(sourceId);
  const transport = resolveMessageOperationTransport({ sourceId, contentAttributes: { whatsapp_transport: external?.provider } });
  if (!external || (transport !== 'evolution' && transport !== 'waha') || external.provider !== transport || !targetFromMe || remoteJid === 'status@broadcast') return response.status(422).json({ error: 'This message cannot be changed remotely.', category: 'operation_unsupported' });
  try {
    return await chatwootBridge.withAccount(accountId as number, async () => {
    const inbox = await chatwootBridge.findWhatsAppInboxById(inboxId as number);
    if (transport === 'waha') {
      if (!inbox.configuration.transports.includes('waha') || !inbox.configuration.wahaSessionName) return response.status(409).json({ error: 'WAHA is not available for this inbox.', category: 'transport_unavailable' });
      await adoptLegacyWahaOwnership(accountId as number, inbox.id);
      await wahaSessions.assertOwned(accountId as number, inbox.id, inbox.configuration.wahaSessionName);
      if (operation === 'edit') await wahaTransport.editMessage(inbox.configuration.wahaSessionName, remoteJid, external.id, content as string);
      else await wahaTransport.revokeMessage(inbox.configuration.wahaSessionName, remoteJid, external.id);
      const updated = operation === 'edit' ? await chatwootBridge.editWhatsAppMessageBySourceId(sourceId, content as string) : await chatwootBridge.revokeWhatsAppMessageBySourceId(sourceId);
      return response.json(updated);
    }
    if (!inbox.configuration.transports.includes('evolution') || !inbox.configuration.evolutionInstanceName) return response.status(409).json({ error: 'Evolution is not available for this inbox.', category: 'transport_unavailable' });
    const target = { remoteJid, messageId: external.id, fromMe: true, ...(typeof participantJid === 'string' ? { participant: participantJid } : {}) };
    if (operation === 'edit') {
      await evolutionBridge.editMessage(inbox.configuration.evolutionInstanceName, target, content as string);
      const updated = await chatwootBridge.editWhatsAppMessageBySourceId(sourceId, content as string);
      bridgeMetrics.increment('whatsapp_messages_edited_total', { transport: 'evolution', origin: 'platform' });
      return response.json(updated);
    }
    await evolutionBridge.revokeMessage(inbox.configuration.evolutionInstanceName, target);
    const updated = await chatwootBridge.revokeWhatsAppMessageBySourceId(sourceId);
    bridgeMetrics.increment('whatsapp_messages_revoked_total', { transport: 'evolution', origin: 'platform' });
    return response.json(updated);
    });
  } catch (error) {
    console.error('[evolution-bridge] remote message operation failed', { operation, inboxId, sourceId, error: error instanceof Error ? error.message : 'unknown error' });
    return response.status(502).json({ error: operation === 'edit' ? 'Could not edit WhatsApp message' : 'Could not revoke WhatsApp message' });
  }
});

app.post('/operations/reactions', async (request, response) => {
  if (!(await enforceRateLimit(request, response, 'reactions', 120, 60))) return;
  if (!(await requireBridgeUser(request, response))) return;
  const body = request.body as Record<string, unknown>;
  const accountId = body.accountId;
  const inboxId = body.inboxId;
  const conversationId = body.conversationId;
  const sourceId = body.sourceId;
  const remoteJid = body.remoteJid;
  const targetFromMe = body.targetFromMe;
  const participantJid = body.participantJid;
  const emoji = body.emoji;
  const declaredTransport = body.transport;
  if (!Number.isInteger(accountId) || !Number.isInteger(inboxId) || !Number.isInteger(conversationId) || typeof sourceId !== 'string' || typeof remoteJid !== 'string' || typeof targetFromMe !== 'boolean' || typeof emoji !== 'string' || (participantJid !== undefined && typeof participantJid !== 'string' && participantJid !== null) || (declaredTransport !== 'evolution' && declaredTransport !== 'waha' && declaredTransport !== 'meta_cloud')) {
    return response.status(400).json({ error: 'Invalid reaction operation' });
  }
  const external = parseExternalMessageId(sourceId);
  const transport = resolveMessageOperationTransport({ sourceId, contentAttributes: { whatsapp_transport: declaredTransport } });
  if (!external || !transport || external.provider !== transport || remoteJid === 'status@broadcast') return response.status(400).json({ error: 'Unsupported reaction target' });
  try {
    return await chatwootBridge.withAccount(accountId as number, async () => {
    const inbox = await chatwootBridge.findWhatsAppInboxById(inboxId as number);
    if (!inbox.configuration.transports.includes(transport)) return response.status(409).json({ error: 'The message transport is no longer configured for this inbox' });
    const metaConfig = transport === 'meta_cloud' ? await metaConfigs.get(inbox.id) : null;
    if (transport === 'waha') {
      if (!inbox.configuration.wahaSessionName) return response.status(409).json({ error: 'WAHA is not available for this inbox.' });
      await adoptLegacyWahaOwnership(accountId as number, inbox.id);
      await wahaSessions.assertOwned(accountId as number, inbox.id, inbox.configuration.wahaSessionName);
    }
    await reactionTransport.send({
      transport,
      evolutionInstanceName: inbox.configuration.evolutionInstanceName,
      wahaSessionName: inbox.configuration.wahaSessionName,
      metaConfig,
      target: { remoteJid, messageId: external.id, fromMe: targetFromMe, ...(typeof participantJid === 'string' ? { participant: participantJid } : {}), emoji },
    });
    await chatwootBridge.updateWhatsAppReaction(conversationId as number, sourceId, {
      senderId: 'self', emoji, transport, origin: 'platform',
    });
    bridgeMetrics.increment('whatsapp_reactions_sent_total', { transport });
    return response.status(200).json({ ok: true });
    });
  } catch (error) {
    if (error instanceof UnsupportedReactionTransportError) return response.status(422).json({ error: `Reactions are not available for ${error.message.includes('waha') ? 'WAHA' : 'Meta Cloud'} yet` });
    console.error('[evolution-bridge] outgoing reaction failed', { inboxId, conversationId, sourceId, error: error instanceof Error ? error.message : 'unknown error' });
    return response.status(502).json({ error: 'Could not send WhatsApp reaction' });
  }
});

const validChatwootSignature = async (request: express.Request & { rawBody?: string }) => {
  const signature = request.header('x-chatwoot-signature');
  const timestamp = request.header('x-chatwoot-timestamp');
  if (!signature?.startsWith('sha256=') || !timestamp || !request.rawBody) return false;
  const received = signature.slice('sha256='.length);
  const account = request.body && typeof request.body === 'object' ? (request.body as { account?: { id?: unknown } }).account : undefined;
  const accountId = account && Number.isInteger(account.id) ? Number(account.id) : config.chatwootDefaultAccountId;
  if (!accountId) return false;
  const inboxes = await chatwootBridge.withAccount(accountId, () => chatwootBridge.listApiInboxes());
  return inboxes.some(inbox => {
    if (!inbox.secret) return false;
    const expected = createHmac('sha256', inbox.secret).update(`${timestamp}.${request.rawBody}`).digest('hex');
    return expected.length === received.length && timingSafeEqual(Buffer.from(expected), Buffer.from(received));
  });
};

app.post('/webhooks/chatwoot', async (request, response) => {
  try {
    if (!(await validChatwootSignature(request))) return response.status(401).json({ error: 'Invalid Chatwoot signature' });
    const event = parseOutgoingChatwootMessage(request.body);
    if (!event) return response.status(202).json({ ignored: true });
    return chatwootBridge.withAccount(event.accountId, async () => {
    const dedupId = `chatwoot-outgoing:${event.accountId}:${event.messageId}`;
    if (await dedup.hasOrLock(dedupId)) {
      console.info('[evolution-bridge] outgoing duplicate ignored', { messageId: event.messageId });
      return response.status(200).json({ duplicate: true });
    }
    try {
      console.info('[evolution-bridge] outgoing webhook received', { messageId: event.messageId, inboxId: event.inboxId });
      const routedInbox = await chatwootBridge.findWhatsAppInboxById(event.inboxId);
      const transport = resolveOutgoingTransport({ configuration: routedInbox.configuration, chatType: event.chatType });
      if (!transport) return response.status(422).json({ error: 'No configured transport supports this WhatsApp operation', category: 'transport_unavailable' });
      if (transport === 'meta_cloud') {
        const rawInbox = await chatwootBridge.findApiInboxById(event.inboxId);
        if (rawInbox.additionalAttributes.meta_connection_status === 'disconnected' || rawInbox.additionalAttributes.meta_connection_status === 'error') return response.status(409).json({ error: 'Meta Cloud is disconnected.', category: 'transport_unavailable' });
        const credentials = await metaConfigs.get(routedInbox.id);
        if (!credentials) {
          await saveConnectionStatus(event.accountId, routedInbox.id, 'meta_cloud', 'disconnected');
          return response.status(409).json({ error: 'Meta Cloud requires reconnection.', category: 'transport_unavailable' });
        }
        const quoted = parseExternalMessageId(event.quotedExternalId);
        // A Meta reply can only quote another wamid. Never manufacture a
        // cross-transport reference from an Evolution external ID.
        const quotedMessageId = quoted?.provider === 'meta_cloud' ? quoted.id : undefined;
        const sentMessages = [];
        if (event.attachments.length) {
          for (const [index, attachment] of event.attachments.entries()) {
            const sent = await metaCloud.sendMedia(credentials, event.number, attachment, index === 0 ? event.content : '', quotedMessageId);
            sentMessages.push(sent);
          }
        } else {
          sentMessages.push(await metaCloud.sendText(credentials, event.number, event.content, quotedMessageId));
        }
        const sentMessage = sentMessages[0];
        if (!sentMessage) throw new Error('A Meta não retornou wamid para a mensagem enviada.');
        await chatwootBridge.updateWhatsAppMessageTransport(event.conversationId, event.messageId, {
          sourceId: externalMessageId('meta_cloud', sentMessage.messageId), transport: 'meta_cloud', remoteJid: event.number, fromMe: true,
        });
        await Promise.all(sentMessages.map(sent => dedup.commit(externalMessageId('meta_cloud', sent.messageId))));
        await saveConnectionStatus(event.accountId, routedInbox.id, 'meta_cloud', 'connected');
        await dedup.commit(dedupId);
        console.info('[meta-cloud] outgoing message accepted', { inboxId: event.inboxId, messageId: event.messageId, wamid: sentMessage.messageId });
        return response.status(200).json({ ok: true });
      }
      if (transport === 'waha') {
        const session = routedInbox.configuration.wahaSessionName;
        if (!session) throw new Error('A inbox WAHA não possui sessão configurada.');
        await adoptLegacyWahaOwnership(event.accountId, routedInbox.id);
        await wahaSessions.assertOwned(event.accountId, routedInbox.id, session);
        const status = await wahaTransport.getSession(session);
        await saveConnectionStatus(event.accountId, routedInbox.id, 'waha', status.connectionStatus);
        if (status.connectionStatus !== 'connected') return response.status(409).json({ error: 'WAHA session is not WORKING.', category: 'transport_unavailable' });
        const quoted = parseExternalMessageId(event.quotedExternalId);
        const replyTo = quoted?.provider === 'waha' ? quoted.id : undefined;
        const trackId = createTrackId();
        const pendingKeys: string[] = [];
        const sentMessages = [];
        try {
          if (event.attachments.length) {
            for (const [index, attachment] of event.attachments.entries()) {
              const caption = index === 0 ? event.content : '';
              pendingKeys.push(queueWahaOutgoing(session, event.number, caption, true));
              sentMessages.push(await wahaTransport.sendMedia(session, event.number, attachment, caption, replyTo));
            }
          } else {
            pendingKeys.push(queueWahaOutgoing(session, event.number, event.content, false));
            sentMessages.push(await wahaTransport.sendText(session, event.number, event.content, replyTo));
          }
        } catch (error) {
          pendingKeys.forEach(key => pendingWahaOutgoing.delete(key));
          throw error;
        }
        const sentMessage = sentMessages[0];
        if (!sentMessage) throw new Error('WAHA não retornou o ID da mensagem enviada.');
        const providerMessageId = normalizeWahaMessageId(sentMessage.messageId);
        await chatwootBridge.updateWhatsAppMessageTransport(event.conversationId, event.messageId, { sourceId: externalMessageId('waha', providerMessageId), transport: 'waha', remoteJid: sentMessage.chatId || event.number, fromMe: true });
        pendingKeys.forEach(key => pendingWahaOutgoing.delete(key));
        await Promise.all(sentMessages.map(sent => dedup.commit(externalMessageId('waha', normalizeWahaMessageId(sent.messageId)))));
        await dedup.commit(dedupId);
        console.info('[waha] outgoing message accepted', { trackId, inboxId: event.inboxId, messageId: event.messageId });
        return response.status(200).json({ ok: true, trackId });
      }
      const inbox = await chatwootBridge.findEvolutionInboxById(event.inboxId);
      let evolutionStatus: ConnectionStatus;
      try { evolutionStatus = evolutionConnectionStatus(await evolutionBridge.getConnection(inbox.instance)); }
      catch { evolutionStatus = 'error'; }
      await saveConnectionStatus(event.accountId, inbox.id, 'evolution', evolutionStatus);
      if (evolutionStatus !== 'connected') return response.status(409).json({ error: 'Evolution instance is disconnected.', category: 'transport_unavailable' });
      console.info('[evolution-bridge] outgoing send started', { messageId: event.messageId, instance: inbox.instance, number: event.number });
      let quoted: { messageId: string; remoteJid?: string; fromMe?: boolean; participant?: string } | undefined;
      if (event.quotedMessageId) {
        quoted = { messageId: event.quotedMessageId };
        // A direct reply works with the historic minimal key. Group replies
        // additionally require the original participant and full group key.
        // Resolve it from the persisted target only when it is Evolution.
        if (event.chatType === 'group' && event.quotedExternalId?.startsWith('evolution:')) {
          try {
            const target = await chatwootBridge.messageTargetBySourceId(event.quotedExternalId);
            const attributes = target.content_attributes;
            quoted = {
              messageId: event.quotedMessageId,
              ...(typeof attributes.whatsapp_remote_jid === 'string' ? { remoteJid: attributes.whatsapp_remote_jid } : { remoteJid: event.number }),
              ...(typeof attributes.whatsapp_from_me === 'boolean' ? { fromMe: attributes.whatsapp_from_me } : {}),
              ...(typeof attributes.whatsapp_participant_jid === 'string' ? { participant: attributes.whatsapp_participant_jid } : {}),
            };
          } catch (error) {
            // The quoted message can be absent locally (e.g. outside the
            // retained history). Send normally rather than failing the group
            // message; its quoted external identity remains persisted.
            console.warn('[evolution-bridge] group reply target unavailable', { messageId: event.messageId, error: error instanceof Error ? error.message : 'unknown error' });
          }
        }
      }
      const sentMessages = [];
      if (event.attachments.length) {
        for (const [index, attachment] of event.attachments.entries()) {
          const sent = await evolutionBridge.sendMedia(inbox.instance, event.number, attachment, index === 0 ? event.content : '', quoted);
          // A single Chatwoot message may carry several files. Its primary
          // WhatsApp key is the first sent item; each later transport can grow
          // into a separate operation model if multi-file mutations are added.
          if (sent) sentMessages.push(sent);
        }
      } else {
        const sent = await evolutionBridge.sendText(inbox.instance, event.number, event.content, quoted);
        if (sent) sentMessages.push(sent);
      }
      const sentMessage = sentMessages[0];
      if (sentMessage) {
        await chatwootBridge.updateWhatsAppMessageTransport(event.conversationId, event.messageId, {
          sourceId: externalMessageId('evolution', sentMessage.messageId), transport: 'evolution', remoteJid: sentMessage.remoteJid, fromMe: sentMessage.fromMe,
        });
        // The server can echo this same message via messages.upsert. The
        // original Chatwoot bubble above already owns its external identity,
        // so consume that echo instead of creating a second outgoing bubble.
        await Promise.all(sentMessages.map(sent => dedup.commit(`${inbox.instance}:${sent.messageId}`)));
      }
      await dedup.commit(dedupId);
      console.info('[evolution-bridge] outgoing send confirmed', { messageId: event.messageId, instance: inbox.instance });
      return response.status(200).json({ ok: true });
    } catch (error) {
      dedup.release(dedupId);
      console.error('[evolution-bridge] outgoing send failed', { messageId: event.messageId, inboxId: event.inboxId, error: error instanceof Error ? error.message : 'unknown error' });
      if (error instanceof MetaCloudError) {
        if (['authentication', 'permission', 'number'].includes(error.category)) {
          await saveConnectionStatus(event.accountId, event.inboxId, 'meta_cloud', 'error').catch(() => undefined);
          return response.status(409).json({ error: 'Meta Cloud is unavailable.', category: 'transport_unavailable' });
        }
        return response.status(422).json({ error: 'Meta Cloud could not send this message', category: error.category });
      }
      return response.status(502).json({ error: 'Could not send message through Evolution' });
    }
    });
  } catch (error) {
    console.error('[evolution-bridge] outgoing webhook validation failed', { error: error instanceof Error ? error.message : 'unknown error' });
    return response.status(502).json({ error: 'Could not validate Chatwoot webhook' });
  }
});
app.listen(config.port, () => console.info(`[evolution-bridge] listening on :${config.port}`));
