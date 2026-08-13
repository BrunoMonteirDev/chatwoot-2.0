import express from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { chatwootBridge } from './chatwoot.js';
import { config } from './config.js';
import { PersistentDedupStore } from './dedupStore.js';
import { parseIncomingEvolutionMessage } from './evolutionEvent.js';
import { IdentityStore } from './identityStore.js';
import { parseOutgoingChatwootMessage } from './chatwootEvent.js';
import { evolutionBridge } from './evolution.js';

const app = express();
const dedup = new PersistentDedupStore(config.dedupFile);
const identities = new IdentityStore(config.identityFile);
app.use(express.json({ limit: '2mb', verify: (request, _response, buffer) => { (request as express.Request & { rawBody?: string }).rawBody = buffer.toString('utf8'); } }));
app.get('/health', (_request, response) => response.json({ ok: true }));
app.post('/webhooks/evolution', async (request, response) => {
  const providedSecret = request.header('x-bridge-secret') || request.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (providedSecret !== config.webhookSecret) return response.status(401).json({ error: 'Unauthorized' });
  const event = parseIncomingEvolutionMessage(request.body);
  if (!event) return response.status(202).json({ ignored: true });
  const dedupId = `${event.instance}:${event.messageId}`;
  if (await dedup.hasOrLock(dedupId)) return response.status(200).json({ duplicate: true });
  try {
    console.info('[evolution-bridge] event received', { instance: event.instance, number: event.phoneNumber, messageId: event.messageId });
    const inbox = await chatwootBridge.findInbox(event.instance);
    console.info('[evolution-bridge] inbox found', { instance: event.instance, inboxId: inbox.id });
    const identityKeys = [event.phoneNumber && `${event.instance}:phone:${event.phoneNumber.replace(/\D/g, '')}`, event.lid && `${event.instance}:lid:${event.lid}`].filter((key): key is string => Boolean(key));
    const storedSource = await identities.find(identityKeys);
    const existingSource = storedSource || await chatwootBridge.findContactSourceByPhone(inbox.id, event.phoneNumber);
    const contact = await chatwootBridge.createOrFindContact(inbox.identifier, { ...event, sourceId: existingSource || event.sourceId });
    await chatwootBridge.saveEvolutionIdentity(contact.id, event.phoneNumber, event.lid);
    await identities.save(identityKeys, contact.source_id);
    console.info('[evolution-bridge] contact found or created', { sourceId: contact.source_id });
    const conversation = await chatwootBridge.findOrCreateConversation(inbox.identifier, contact.source_id);
    console.info('[evolution-bridge] conversation found or created', { conversationId: conversation.id });
    if (event.fromMe) {
      await chatwootBridge.createMobileOutgoingMessage(conversation.id, event.content, event.messageId);
    } else {
      await chatwootBridge.createIncomingMessage(inbox.identifier, contact.source_id, conversation.id, event.content, dedupId);
    }
    await dedup.commit(dedupId);
    console.info('[evolution-bridge] mobile message created', { conversationId: conversation.id, messageId: event.messageId, fromMe: event.fromMe });
    return response.status(201).json({ ok: true });
  } catch (error) {
    dedup.release(dedupId);
    console.error('[evolution-bridge] processing failed', { instance: event.instance, messageId: event.messageId, error: error instanceof Error ? error.message : 'unknown error' });
    return response.status(502).json({ error: 'Could not deliver message to Chatwoot' });
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
      const inbox = await chatwootBridge.findEvolutionInboxById(event.inboxId);
      console.info('[evolution-bridge] outgoing send started', { messageId: event.messageId, instance: inbox.instance, number: event.number });
      if (event.attachments.length) {
        for (const [index, attachment] of event.attachments.entries()) {
          await evolutionBridge.sendMedia(inbox.instance, event.number, attachment, index === 0 ? event.content : '');
        }
      } else {
        await evolutionBridge.sendText(inbox.instance, event.number, event.content);
      }
      await dedup.commit(dedupId);
      console.info('[evolution-bridge] outgoing send confirmed', { messageId: event.messageId, instance: inbox.instance });
      return response.status(200).json({ ok: true });
    } catch (error) {
      dedup.release(dedupId);
      console.error('[evolution-bridge] outgoing send failed', { messageId: event.messageId, inboxId: event.inboxId, error: error instanceof Error ? error.message : 'unknown error' });
      return response.status(502).json({ error: 'Could not send message through Evolution' });
    }
  } catch (error) {
    console.error('[evolution-bridge] outgoing webhook validation failed', { error: error instanceof Error ? error.message : 'unknown error' });
    return response.status(502).json({ error: 'Could not validate Chatwoot webhook' });
  }
});
app.listen(config.port, () => console.info(`[evolution-bridge] listening on :${config.port}`));
