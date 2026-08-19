import express from 'express';
import multer from 'multer';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { chatwootBridge } from './chatwoot.js';
import { config } from './config.js';
import { PersistentDedupStore } from './dedupStore.js';
import { parseIncomingEvolutionEdit, parseIncomingEvolutionGroupLifecycle, parseIncomingEvolutionMessage, parseIncomingEvolutionReaction, parseIncomingEvolutionRevoke, type IncomingEvolutionMessage, type IncomingEvolutionReaction } from './evolutionEvent.js';
import { IdentityStore } from './identityStore.js';
import { parseOutgoingChatwootMessage } from './chatwootEvent.js';
import { evolutionBridge } from './evolution.js';
import { metaCloud, MetaCloudError } from './meta.js';
import { MetaConfigStore } from './metaConfigStore.js';
import { MetaEmbeddedSignupSessionStore, type MetaOnboardingMode } from './metaEmbeddedSignupStore.js';
import { MetaHistoryStore } from './metaHistoryStore.js';
import { parseMetaWebhook, type IncomingMetaMessage } from './metaEvent.js';
import { externalMessageId, parseExternalMessageId, resolveMessageOperationTransport, resolveOutgoingTransport } from './providers.js';
import { reactionTransport, UnsupportedReactionTransportError } from './reactionTransport.js';
import { bridgeCors, requireChatwootSession } from './auth.js';
import { bridgeRedis } from './redis.js';
import { bridgeMetrics } from './metrics.js';
import { enforceRateLimit } from './rateLimit.js';

const app = express();
const templateHeaderUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxMediaBytes, files: 1 } });
const dedup = new PersistentDedupStore(config.dedupFile);
const identities = new IdentityStore(config.identityFile);
const metaConfigs = new MetaConfigStore(config.metaConfigFile);
const metaEmbeddedSignupSessions = new MetaEmbeddedSignupSessionStore(config.metaEmbeddedSignupSessionTtlMs);
const metaHistory = new MetaHistoryStore(config.metaHistoryFile);
const historyImports = new Map<number, Promise<void>>();
app.use(express.json({ limit: '2mb', verify: (request, _response, buffer) => { (request as express.Request & { rawBody?: string }).rawBody = buffer.toString('utf8'); } }));
app.use(bridgeCors);
app.get('/health', (_request, response) => response.json({ ok: true, redis: bridgeRedis.enabled ? 'configured' : 'local-development', metrics: bridgeMetrics.snapshot() }));
app.get('/ready', async (_request, response) => {
  try {
    const [chatwoot, redis] = await Promise.all([
      fetch(`${config.chatwootBaseUrl}/api/v1/accounts/${config.chatwootAccountId}/inboxes`, { headers: { api_access_token: config.chatwootApiAccessToken } }),
      bridgeRedis.ping(),
    ]);
    if (!chatwoot.ok || !redis) throw new Error('dependency unavailable');
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
  if (!Number.isInteger(body.accountId) || body.accountId !== config.chatwootAccountId || (inboxId !== null && !Number.isInteger(inboxId)) || (inboxId === null && (typeof body.inboxName !== 'string' || !body.inboxName.trim()))) return response.status(400).json({ error: 'Invalid Embedded Signup request.' });
  try {
    if (inboxId !== null) await chatwootBridge.findWhatsAppInboxById(inboxId as number);
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
    const credentials = await metaConfigs.get(inbox.id);
    if (!credentials) return response.status(422).json({ error: 'Meta Cloud requires reconnection.' });
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

type EvolutionIdentityEvent = Pick<IncomingEvolutionMessage | IncomingEvolutionReaction, 'instance' | 'sourceId' | 'phoneNumber' | 'lid' | 'name' | 'chatType' | 'participantJid' | 'participantName'> & Partial<Pick<IncomingEvolutionMessage, 'remoteJid'>>;

const conversationForEvolutionIdentity = async (event: EvolutionIdentityEvent) => {
  const inbox = await chatwootBridge.findInbox(event.instance);
  if (event.chatType === 'group') {
    if (!event.remoteJid?.endsWith('@g.us')) throw new Error('Evento de grupo sem identificador válido.');
    const contact = await chatwootBridge.createOrFindContact(inbox.identifier, { sourceId: event.sourceId, name: event.name });
    await chatwootBridge.saveEvolutionGroup(contact.id, event.remoteJid, event.name, { participants: event.participantJid ? [{ jid: event.participantJid, name: event.participantName }] : undefined });
    const conversation = await chatwootBridge.findOrCreateConversation(inbox.identifier, contact.source_id);
    return { inbox, contact, conversation };
  }
  const identityKeys = [event.phoneNumber && `${event.instance}:phone:${event.phoneNumber.replace(/\D/g, '')}`, event.lid && `${event.instance}:lid:${event.lid}`].filter((key): key is string => Boolean(key));
  const storedSource = await identities.find(identityKeys);
  const existingSource = storedSource || await chatwootBridge.findContactSourceByPhone(inbox.id, event.phoneNumber);
  const contact = await chatwootBridge.createOrFindContact(inbox.identifier, { ...event, sourceId: existingSource || event.sourceId });
  await chatwootBridge.saveEvolutionIdentity(contact.id, event.phoneNumber, event.lid);
  await identities.save(identityKeys, contact.source_id);
  const conversation = await chatwootBridge.findOrCreateConversation(inbox.identifier, contact.source_id);
  return { inbox, contact, conversation };
};

const conversationForMetaIdentity = async (event: IncomingMetaMessage) => {
  const inbox = await chatwootBridge.findMetaInboxByPhoneNumberId(event.phoneNumberId);
  // Contact source is intentionally normalized by phone, just like the
  // Evolution lookup. This makes a hybrid inbox reuse its same contact and
  // single conversation instead of creating a Meta-specific identity.
  const existingSource = await chatwootBridge.findContactSourceByPhone(inbox.id, event.phoneNumber);
  const contact = await chatwootBridge.createOrFindContact(inbox.identifier, { sourceId: existingSource || event.sourceId, name: event.name, phoneNumber: event.phoneNumber });
  const conversation = await chatwootBridge.findOrCreateConversation(inbox.identifier, contact.source_id);
  return { inbox, contact, conversation };
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
          ? { meta_connection_status: 'disconnected', meta_business_app_status: 'offboarded', meta_reconnect_required: true }
          : { meta_connection_status: 'connected', meta_business_app_status: 'active', meta_reconnect_required: false });
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
        const sourceId = `whatsapp:group:${update.groupJid}`;
        const contact = await chatwootBridge.createOrFindContact(inbox.identifier, { sourceId, name: update.subject || update.groupJid });
        await chatwootBridge.saveEvolutionGroup(contact.id, update.groupJid, update.subject || update.groupJid, update);
        await chatwootBridge.findOrCreateConversation(inbox.identifier, contact.source_id);
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
    const downloadedMedia = event.media ? await evolutionBridge.downloadMedia(event.instance, event.media) : undefined;
    if (event.fromMe && downloadedMedia) {
      await chatwootBridge.createMobileOutgoingMediaMessage(conversation.id, event.content, event.messageId, downloadedMedia, event.quotedMessageId, event.remoteJid, event);
    } else if (event.fromMe) {
      await chatwootBridge.createMobileOutgoingMessage(conversation.id, event.content, event.messageId, event.quotedMessageId, event.remoteJid, event);
    } else if (downloadedMedia) {
      await chatwootBridge.createIncomingMediaMessage(conversation.id, event.content, event.messageId, downloadedMedia, event.quotedMessageId, event.remoteJid, event);
    } else {
      await chatwootBridge.createIncomingMessage(inbox.identifier, contact.source_id, conversation.id, event.content, event.messageId, event.quotedMessageId, event.remoteJid, event);
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
  const { inboxId, sourceId, remoteJid, targetFromMe, participantJid, content } = body;
  if (!Number.isInteger(inboxId) || typeof sourceId !== 'string' || typeof remoteJid !== 'string' || typeof targetFromMe !== 'boolean' || (participantJid !== undefined && typeof participantJid !== 'string' && participantJid !== null) || (operation === 'edit' && (typeof content !== 'string' || !content.trim()))) return response.status(400).json({ error: 'Invalid WhatsApp message operation' });
  const external = parseExternalMessageId(sourceId);
  const transport = resolveMessageOperationTransport({ sourceId, contentAttributes: { whatsapp_transport: external?.provider } });
  if (!external || transport !== 'evolution' || external.provider !== 'evolution' || !targetFromMe || remoteJid === 'status@broadcast') return response.status(422).json({ error: 'This message cannot be changed remotely.', category: 'operation_unsupported' });
  try {
    const inbox = await chatwootBridge.findWhatsAppInboxById(inboxId as number);
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
  } catch (error) {
    console.error('[evolution-bridge] remote message operation failed', { operation, inboxId, sourceId, error: error instanceof Error ? error.message : 'unknown error' });
    return response.status(502).json({ error: operation === 'edit' ? 'Could not edit WhatsApp message' : 'Could not revoke WhatsApp message' });
  }
});

app.post('/operations/reactions', async (request, response) => {
  if (!(await enforceRateLimit(request, response, 'reactions', 120, 60))) return;
  if (!(await requireBridgeUser(request, response))) return;
  const body = request.body as Record<string, unknown>;
  const inboxId = body.inboxId;
  const conversationId = body.conversationId;
  const sourceId = body.sourceId;
  const remoteJid = body.remoteJid;
  const targetFromMe = body.targetFromMe;
  const participantJid = body.participantJid;
  const emoji = body.emoji;
  const declaredTransport = body.transport;
  if (!Number.isInteger(inboxId) || !Number.isInteger(conversationId) || typeof sourceId !== 'string' || typeof remoteJid !== 'string' || typeof targetFromMe !== 'boolean' || typeof emoji !== 'string' || (participantJid !== undefined && typeof participantJid !== 'string' && participantJid !== null) || (declaredTransport !== 'evolution' && declaredTransport !== 'meta_cloud')) {
    return response.status(400).json({ error: 'Invalid reaction operation' });
  }
  const external = parseExternalMessageId(sourceId);
  const transport = resolveMessageOperationTransport({ sourceId, contentAttributes: { whatsapp_transport: declaredTransport } });
  if (!external || !transport || external.provider !== transport || remoteJid === 'status@broadcast') return response.status(400).json({ error: 'Unsupported reaction target' });
  try {
    const inbox = await chatwootBridge.findWhatsAppInboxById(inboxId as number);
    if (!inbox.configuration.transports.includes(transport)) return response.status(409).json({ error: 'The message transport is no longer configured for this inbox' });
    const metaConfig = transport === 'meta_cloud' ? await metaConfigs.get(inbox.id) : null;
    await reactionTransport.send({
      transport,
      evolutionInstanceName: inbox.configuration.evolutionInstanceName,
      metaConfig,
      target: { remoteJid, messageId: external.id, fromMe: targetFromMe, ...(typeof participantJid === 'string' ? { participant: participantJid } : {}), emoji },
    });
    await chatwootBridge.updateWhatsAppReaction(conversationId as number, sourceId, {
      senderId: 'self', emoji, transport, origin: 'platform',
    });
    bridgeMetrics.increment('whatsapp_reactions_sent_total', { transport });
    return response.status(200).json({ ok: true });
  } catch (error) {
    if (error instanceof UnsupportedReactionTransportError) return response.status(422).json({ error: 'Reactions are not available for Meta Cloud yet' });
    console.error('[evolution-bridge] outgoing reaction failed', { inboxId, conversationId, sourceId, error: error instanceof Error ? error.message : 'unknown error' });
    return response.status(502).json({ error: 'Could not send WhatsApp reaction' });
  }
});

const validChatwootSignature = async (request: express.Request & { rawBody?: string }) => {
  const signature = request.header('x-chatwoot-signature');
  const timestamp = request.header('x-chatwoot-timestamp');
  if (!signature?.startsWith('sha256=') || !timestamp || !request.rawBody) return false;
  const received = signature.slice('sha256='.length);
  const inboxes = await chatwootBridge.listApiInboxes();
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
    const dedupId = `chatwoot-outgoing:${event.messageId}`;
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
        const credentials = await metaConfigs.get(routedInbox.id);
        if (!credentials) throw new Error(`A inbox Meta ${routedInbox.id} não possui credenciais server-side.`);
        const quoted = parseExternalMessageId(event.quotedExternalId);
        // A Meta reply can only quote another wamid. Never manufacture a
        // cross-transport reference from an Evolution external ID.
        const quotedMessageId = quoted?.provider === 'meta_cloud' ? quoted.id : undefined;
        let sentMessage = null;
        if (event.attachments.length) {
          for (const [index, attachment] of event.attachments.entries()) {
            const sent = await metaCloud.sendMedia(credentials, event.number, attachment, index === 0 ? event.content : '', quotedMessageId);
            sentMessage ||= sent;
          }
        } else {
          sentMessage = await metaCloud.sendText(credentials, event.number, event.content, quotedMessageId);
        }
        if (!sentMessage) throw new Error('A Meta não retornou wamid para a mensagem enviada.');
        await chatwootBridge.updateWhatsAppMessageTransport(event.conversationId, event.messageId, {
          sourceId: externalMessageId('meta_cloud', sentMessage.messageId), transport: 'meta_cloud', remoteJid: event.number, fromMe: true,
        });
        await dedup.commit(dedupId);
        console.info('[meta-cloud] outgoing message accepted', { inboxId: event.inboxId, messageId: event.messageId, wamid: sentMessage.messageId });
        return response.status(200).json({ ok: true });
      }
      const inbox = await chatwootBridge.findEvolutionInboxById(event.inboxId);
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
      let sentMessage = null;
      if (event.attachments.length) {
        for (const [index, attachment] of event.attachments.entries()) {
          const sent = await evolutionBridge.sendMedia(inbox.instance, event.number, attachment, index === 0 ? event.content : '', quoted);
          // A single Chatwoot message may carry several files. Its primary
          // WhatsApp key is the first sent item; each later transport can grow
          // into a separate operation model if multi-file mutations are added.
          sentMessage ||= sent;
        }
      } else {
        sentMessage = await evolutionBridge.sendText(inbox.instance, event.number, event.content, quoted);
      }
      if (sentMessage) {
        await chatwootBridge.updateWhatsAppMessageTransport(event.conversationId, event.messageId, {
          sourceId: externalMessageId('evolution', sentMessage.messageId), transport: 'evolution', remoteJid: sentMessage.remoteJid, fromMe: sentMessage.fromMe,
        });
        // The server can echo this same message via messages.upsert. The
        // original Chatwoot bubble above already owns its external identity,
        // so consume that echo instead of creating a second outgoing bubble.
        await dedup.commit(`${inbox.instance}:${sentMessage.messageId}`);
      }
      await dedup.commit(dedupId);
      console.info('[evolution-bridge] outgoing send confirmed', { messageId: event.messageId, instance: inbox.instance });
      return response.status(200).json({ ok: true });
    } catch (error) {
      dedup.release(dedupId);
      console.error('[evolution-bridge] outgoing send failed', { messageId: event.messageId, inboxId: event.inboxId, error: error instanceof Error ? error.message : 'unknown error' });
      if (error instanceof MetaCloudError) return response.status(422).json({ error: 'Meta Cloud could not send this message', category: error.category });
      return response.status(502).json({ error: 'Could not send message through Evolution' });
    }
  } catch (error) {
    console.error('[evolution-bridge] outgoing webhook validation failed', { error: error instanceof Error ? error.message : 'unknown error' });
    return response.status(502).json({ error: 'Could not validate Chatwoot webhook' });
  }
});
app.listen(config.port, () => console.info(`[evolution-bridge] listening on :${config.port}`));
