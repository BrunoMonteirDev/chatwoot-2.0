import type { ContactProfile, ConversationMessage, ConversationSummary } from '../../domain/currentUser';
import type { MessageHistoryPage } from '../../integrations/chatwoot/messages';
import { indexGroupParticipants, participantPhone, validParticipantName } from '../groups/participant';
import type { GroupParticipant } from '../groups/metadata';
import { messageHistoryPersistence, type MessageHistoryPersistence, type PersistedMessageHistory } from './MessageHistoryPersistence';

export const MESSAGE_HISTORY_TTL_MS = 30_000;
export const MESSAGE_HISTORY_MAX_CONVERSATIONS = 12;

const senderScore = (message: ConversationMessage) => {
  const participantContactId = Number(message.contentAttributes.whatsapp_participant_contact_id);
  const participantPhone = typeof message.contentAttributes.whatsapp_participant_phone === 'string'
    ? message.contentAttributes.whatsapp_participant_phone.replace(/\D/g, '') : '';
  const senderPhone = message.senderPhoneNumber?.replace(/\D/g, '') || '';
  return (message.senderId ? 4 : 0) + (message.senderName?.trim() ? 2 : 0)
    + (senderPhone ? 4 : 0) + (message.senderAvatarUrl ? 1 : 0)
    + (message.senderId && message.senderId === participantContactId ? 100 : 0)
    + (participantPhone && senderPhone === participantPhone ? 20 : 0);
};

export const preserveRichSender = (current: ConversationMessage, incoming: ConversationMessage): ConversationMessage => {
  const attachments = incoming.attachments.map(attachment => {
    const previous = current.attachments.find(candidate => candidate.id === attachment.id || candidate.url === attachment.url);
    return previous ? { ...attachment, width: attachment.width || previous.width, height: attachment.height || previous.height } : attachment;
  });
  if (senderScore(incoming) > senderScore(current)) return { ...incoming, attachments };
  return { ...incoming, attachments, senderId: current.senderId, senderName: current.senderName, senderPhoneNumber: current.senderPhoneNumber, senderEmail: current.senderEmail, senderAvatarUrl: current.senderAvatarUrl };
};

export const mergeMessage = (current: ConversationMessage[], incoming: ConversationMessage): ConversationMessage[] => {
  const index = current.findIndex((message) => message.id === incoming.id
    || Boolean(incoming.sourceId && message.sourceId === incoming.sourceId)
    || Boolean(incoming.echoId && message.echoId === incoming.echoId));
  if (index >= 0) {
    if (current[index].updatedAt && incoming.updatedAt && current[index].updatedAt > incoming.updatedAt) return current;
    const next = [...current];
    next[index] = preserveRichSender(current[index], incoming);
    return next.sort((a, b) => a.createdAt - b.createdAt || a.id - b.id);
  }
  return [...current, incoming].sort((a, b) => a.createdAt - b.createdAt || a.id - b.id);
};

export const enrichGroupParticipantMessages = (messages: ConversationMessage[], participants: GroupParticipant[], groupName?: string | null) => {
  const identities = indexGroupParticipants(participants);
  return messages.map(message => {
    if (message.kind !== 'incoming' || typeof message.contentAttributes.whatsapp_remote_jid !== 'string' || !message.contentAttributes.whatsapp_remote_jid.endsWith('@g.us')) return message;
    const jid = typeof message.contentAttributes.whatsapp_participant_jid === 'string' ? message.contentAttributes.whatsapp_participant_jid : undefined;
    const phone = typeof message.contentAttributes.whatsapp_participant_phone === 'string' ? message.contentAttributes.whatsapp_participant_phone : undefined;
    const participantContactId = Number(message.contentAttributes.whatsapp_participant_contact_id);
    const participant = (participantContactId && identities[`contact:${participantContactId}`]) || (message.senderId && identities[`contact:${message.senderId}`]) || (jid && identities[jid]) || (phone && (identities[phone] || identities[phone.replace(/\D/g, '')]));
    if (!participant) return message;
    const resolvedPhone = participantPhone(participant.phoneJid || participant.jid, participant.phoneNumber || participant.phone) || message.senderPhoneNumber || phone;
    const resolvedName = validParticipantName(participant.displayName || participant.name, groupName) || validParticipantName(message.senderName, groupName) || resolvedPhone;
    const candidate: ConversationMessage = {
      ...message,
      ...(participant.contactId ? { senderId: participant.contactId } : {}),
      ...(resolvedName ? { senderName: resolvedName } : {}),
      ...(resolvedPhone ? { senderPhoneNumber: resolvedPhone } : {}),
      ...(participant.avatarUrl ? { senderAvatarUrl: participant.avatarUrl } : {}),
      contentAttributes: {
        ...message.contentAttributes,
        ...(participant.displayName || participant.name ? { whatsapp_participant_name: participant.displayName || participant.name } : {}),
        ...(resolvedPhone ? { whatsapp_participant_phone: resolvedPhone } : {}),
        ...(participant.contactId ? { whatsapp_participant_contact_id: participant.contactId } : {}),
      },
    };
    return preserveRichSender(message, candidate);
  });
};

export interface CachedMessageHistory {
  messages: ConversationMessage[];
  hasOlderMessages: boolean;
  updatedAt: number;
  scrollTop: number;
  conversation?: ConversationSummary;
}

type Entry = CachedMessageHistory & { key: string };
type Fetcher = (signal: AbortSignal) => Promise<MessageHistoryPage>;

/** In-memory, account-scoped message pages. Intentionally has no persistence. */
export class MessageHistoryCache {
  private entries = new Map<string, Entry>();
  private inFlight = new Map<string, { controller: AbortController; promise: Promise<MessageHistoryPage> }>();
  private hydrateInFlight = new Map<string, Promise<(CachedMessageHistory & { isFresh: boolean }) | null>>();
  private generation = 0;
  private participants = new Map<string, GroupParticipant[]>();
  constructor(private readonly maxEntries = MESSAGE_HISTORY_MAX_CONVERSATIONS, private readonly ttlMs = MESSAGE_HISTORY_TTL_MS, private readonly now = () => Date.now(), private readonly persistence?: MessageHistoryPersistence) {}

  key(accountId: number, conversationId: number) { return `${accountId}:${conversationId}`; }

  get(accountId: number, conversationId: number): (CachedMessageHistory & { isFresh: boolean }) | null {
    const key = this.key(accountId, conversationId);
    const entry = this.entries.get(key);
    if (!entry) return null;
    this.entries.delete(key); // Map insertion order is our LRU list.
    this.entries.set(key, entry);
    return { messages: entry.messages, hasOlderMessages: entry.hasOlderMessages, updatedAt: entry.updatedAt, scrollTop: entry.scrollTop, conversation: entry.conversation, isFresh: this.now() - entry.updatedAt < this.ttlMs };
  }

  has(accountId: number, conversationId: number) { return this.entries.has(this.key(accountId, conversationId)); }

  set(accountId: number, conversationId: number, page: MessageHistoryPage, options: { prepend?: boolean; preserveExisting?: boolean; conversation?: ConversationSummary } = {}) {
    const key = this.key(accountId, conversationId);
    const previous = this.entries.get(key);
    const base = options.prepend || options.preserveExisting ? previous?.messages || [] : [];
    const participantMetadata = this.participants.get(key);
    const incoming = participantMetadata ? enrichGroupParticipantMessages(page.messages, participantMetadata, options.conversation?.contactName || previous?.conversation?.contactName) : page.messages;
    const messages = incoming.reduce(mergeMessage, base);
    const entry: Entry = { key, messages, hasOlderMessages: options.prepend ? page.hasOlderMessages : (previous?.hasOlderMessages || page.hasOlderMessages), updatedAt: this.now(), scrollTop: previous?.scrollTop || 0, conversation: options.conversation || previous?.conversation };
    this.entries.delete(key);
    this.entries.set(key, entry);
    while (this.entries.size > this.maxEntries) this.entries.delete(this.entries.keys().next().value!);
    this.persist(this.persistence?.put(this.persisted(accountId, conversationId, entry)));
    return entry;
  }

  async hydrate(accountId: number, conversationId: number) {
    const memory = this.get(accountId, conversationId);
    if (memory) return memory;
    const key = this.key(accountId, conversationId);
    let pending = this.hydrateInFlight.get(key);
    if (!pending) {
      pending = this.persistence?.get(accountId, conversationId).catch(() => null).then((stored) => {
        const installedWhileReading = this.entries.get(key);
        if (installedWhileReading) return { ...installedWhileReading, isFresh: this.now() - installedWhileReading.updatedAt < this.ttlMs };
        if (!stored) return null;
        const entry: Entry = { key, messages: stored.messages, hasOlderMessages: stored.hasOlderMessages, updatedAt: stored.updatedAt, scrollTop: stored.scrollTop, conversation: stored.conversation };
        this.install(entry);
        return { ...entry, isFresh: this.now() - entry.updatedAt < this.ttlMs };
      }).finally(() => this.hydrateInFlight.delete(key)) || Promise.resolve(null);
      this.hydrateInFlight.set(key, pending);
    }
    return pending;
  }

  async conversation(accountId: number, conversationId: number) {
    return (await this.hydrate(accountId, conversationId))?.conversation || null;
  }

  setConversation(accountId: number, conversation: ConversationSummary) {
    const key = this.key(accountId, conversation.id);
    const previous = this.entries.get(key);
    if (!previous) return;
    const entry = { ...previous, conversation };
    this.install(entry);
    this.persist(this.persistence?.put(this.persisted(accountId, conversation.id, entry)));
  }

  upsertIfPresent(accountId: number, message: ConversationMessage) {
    const key = this.key(accountId, message.conversationId);
    const previous = this.entries.get(key);
    if (!previous) return false;
    this.entries.delete(key);
    const participants = this.participants.get(key);
    const enriched = participants ? enrichGroupParticipantMessages([message], participants, previous.conversation?.contactName)[0] : message;
    const entry = { ...previous, messages: mergeMessage(previous.messages, enriched), updatedAt: this.now() };
    this.entries.set(key, entry);
    this.persist(this.persistence?.put(this.persisted(accountId, message.conversationId, entry)));
    return true;
  }

  enrichParticipants(accountId: number, conversationId: number, participants: GroupParticipant[]) {
    const key = this.key(accountId, conversationId);
    const previous = this.entries.get(key);
    if (!previous) return null;
    this.participants.set(key, participants);
    const messages = enrichGroupParticipantMessages(previous.messages, participants, previous.conversation?.contactName);
    const entry = { ...previous, messages };
    this.install(entry);
    this.persist(this.persistence?.put(this.persisted(accountId, conversationId, entry)));
    return messages;
  }

  enrichSenderContacts(accountId: number, conversationId: number, contacts: ContactProfile[]) {
    const key = this.key(accountId, conversationId);
    const previous = this.entries.get(key);
    if (!previous || !contacts.length) return null;
    const byId = new Map(contacts.map(contact => [contact.id, contact]));
    let changed = false;
    const messages = previous.messages.map(message => {
      const participantContactId = Number(message.contentAttributes.whatsapp_participant_contact_id);
      const contact = byId.get(participantContactId || message.senderId || 0);
      if (!contact) return message;
      const next = {
        ...message,
        senderId: contact.id,
        senderName: contact.name || message.senderName,
        senderPhoneNumber: contact.phoneNumber || message.senderPhoneNumber,
        senderEmail: contact.email || message.senderEmail,
        senderAvatarUrl: contact.avatarUrl || message.senderAvatarUrl,
        contentAttributes: { ...message.contentAttributes, whatsapp_participant_contact_id: contact.id },
      };
      if (next.senderName === message.senderName && next.senderPhoneNumber === message.senderPhoneNumber && next.senderEmail === message.senderEmail && next.senderAvatarUrl === message.senderAvatarUrl && next.senderId === message.senderId) return message;
      changed = true;
      return next;
    });
    if (!changed) return previous.messages;
    const entry = { ...previous, messages };
    this.install(entry);
    this.persist(this.persistence?.put(this.persisted(accountId, conversationId, entry)));
    return messages;
  }

  enrichAttachmentDimensions(accountId: number, conversationId: number, messageId: number, attachmentId: number, width: number, height: number) {
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) return null;
    const key = this.key(accountId, conversationId);
    const previous = this.entries.get(key);
    if (!previous) return null;
    let changed = false;
    const messages = previous.messages.map(message => message.id !== messageId ? message : {
      ...message,
      attachments: message.attachments.map(attachment => {
        if (attachment.id !== attachmentId || (attachment.width === width && attachment.height === height)) return attachment;
        changed = true;
        return { ...attachment, width, height };
      }),
    });
    if (!changed) return previous.messages;
    const entry = { ...previous, messages };
    this.install(entry);
    this.persist(this.persistence?.put(this.persisted(accountId, conversationId, entry)));
    return messages;
  }

  setScroll(accountId: number, conversationId: number, scrollTop: number) {
    const key = this.key(accountId, conversationId);
    const entry = this.entries.get(key);
    if (entry) { entry.scrollTop = scrollTop; this.persist(this.persistence?.put(this.persisted(accountId, conversationId, entry))); }
  }

  removeMessage(accountId: number, conversationId: number, messageId: number) {
    const key = this.key(accountId, conversationId);
    const entry = this.entries.get(key);
    if (entry) { entry.messages = entry.messages.filter((message) => message.id !== messageId); this.persist(this.persistence?.put(this.persisted(accountId, conversationId, entry))); }
  }

  request(accountId: number, conversationId: number, fetcher: Fetcher, signal?: AbortSignal, variant = 'latest'): Promise<MessageHistoryPage> {
    const key = `${this.key(accountId, conversationId)}:${variant}`;
    let shared = this.inFlight.get(key);
    if (!shared) {
      const controller = new AbortController();
      const generation = this.generation;
      const promise = fetcher(controller.signal).then(page => {
        if (generation !== this.generation) throw new DOMException('Aborted', 'AbortError');
        return page;
      }).finally(() => this.inFlight.delete(key));
      shared = { controller, promise };
      this.inFlight.set(key, shared);
    }
    if (!signal) return shared.promise;
    if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
    return Promise.race([shared.promise, new Promise<MessageHistoryPage>((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }))]);
  }

  abort(accountId: number, conversationId: number, variant = 'latest') { this.inFlight.get(`${this.key(accountId, conversationId)}:${variant}`)?.controller.abort(); }
  isLoading(accountId: number, conversationId: number, variant = 'latest') { return this.inFlight.has(`${this.key(accountId, conversationId)}:${variant}`); }
  size() { return this.entries.size; }
  async clear() { this.generation += 1; this.entries.clear(); this.participants.clear(); this.hydrateInFlight.clear(); await this.persistence?.clear().catch(() => undefined); }

  private install(entry: Entry) {
    this.entries.delete(entry.key);
    this.entries.set(entry.key, entry);
    while (this.entries.size > this.maxEntries) this.entries.delete(this.entries.keys().next().value!);
  }

  private persisted(accountId: number, conversationId: number, entry: Entry): PersistedMessageHistory {
    return { key: entry.key, accountId, conversationId, messages: entry.messages, hasOlderMessages: entry.hasOlderMessages, updatedAt: entry.updatedAt, scrollTop: entry.scrollTop, oldestMessageId: entry.messages[0]?.id, conversation: entry.conversation };
  }

  private persist(operation?: Promise<void>) {
    void operation?.catch(error => { if (import.meta.env.DEV) console.warn('[indexeddb] cache write skipped', error); });
  }
}

export const messageHistoryCache = new MessageHistoryCache(MESSAGE_HISTORY_MAX_CONVERSATIONS, MESSAGE_HISTORY_TTL_MS, () => Date.now(), messageHistoryPersistence);

/** Idle-only prefetch queue. Explicit opens never wait for this queue. */
export class MessageHistoryPrefetcher {
  private queue: Array<{ key: string; task: () => Promise<void> }> = [];
  private active = 0;
  private scheduled = false;
  private pending = new Set<string>();
  private latencySamples: number[] = [];
  constructor(private limit = 3, private readonly now = () => performance.now()) {}

  enqueue(key: string, task: () => Promise<void>) {
    if (this.pending.has(key)) return;
    this.pending.add(key);
    this.queue.push({ key, task });
    this.schedule();
  }

  private schedule() {
    if (this.scheduled) return;
    this.scheduled = true;
    const run = () => { this.scheduled = false; this.drain(); };
    const idle = globalThis.requestIdleCallback as undefined | ((callback: () => void) => number);
    if (idle) idle(run); else globalThis.setTimeout(run, 0);
  }

  private drain() {
    while (this.active < this.limit && this.queue.length) {
      const { key, task } = this.queue.shift()!;
      this.active += 1;
      const startedAt = this.now();
      void task().catch(() => undefined).finally(() => { this.recordLatency(this.now() - startedAt); this.active -= 1; this.pending.delete(key); this.drain(); });
    }
  }

  private recordLatency(duration: number) {
    this.latencySamples.push(duration);
    if (this.latencySamples.length > 5) this.latencySamples.shift();
    const average = this.latencySamples.reduce((total, item) => total + item, 0) / this.latencySamples.length;
    this.limit = average > 1_500 ? 1 : average > 750 ? 2 : 3;
  }

  concurrency() { return this.limit; }
}

export const messageHistoryPrefetcher = new MessageHistoryPrefetcher();
