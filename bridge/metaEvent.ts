import { normalizeBrazilianPhone } from '../phone.js';

export type MetaMediaKind = 'image' | 'audio' | 'video' | 'document';

export interface IncomingMetaMedia {
  kind: MetaMediaKind;
  mediaId: string;
  mimetype: string | null;
  fileName: string | null;
}

export interface IncomingMetaMessage {
  transport: 'meta_cloud';
  phoneNumberId: string;
  messageId: string;
  sourceId: string;
  phoneNumber: string;
  name: string;
  contactName?: string;
  content: string;
  media?: IncomingMetaMedia;
  quotedMessageId?: string;
  timestamp: number | null;
}

export interface MetaMessageStatus {
  phoneNumberId: string;
  messageId: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  error: string | null;
}

export interface IncomingMetaReaction {
  phoneNumberId: string;
  eventId: string;
  targetMessageId: string;
  senderId: string;
  emoji: string;
}

export interface MetaHistoryMessage {
  messageId: string;
  sourceId: string;
  threadId: string;
  from: string;
  to: string | null;
  direction: 'incoming' | 'outgoing' | 'unknown';
  timestamp: number | null;
  type: string;
  content: string;
  media?: IncomingMetaMedia;
  quotedMessageId?: string;
  historyStatus: string | null;
}

export interface MetaHistoryBatch {
  phoneNumberId: string;
  phase: number | null;
  chunkOrder: number | null;
  progress: number | null;
  messages: MetaHistoryMessage[];
  declined: boolean;
}

export interface MetaBusinessAppEcho extends IncomingMetaMessage { origin: 'business_app'; }
export interface MetaCoexistenceAccountUpdate { wabaId: string; state: 'offboarded' | 'connected'; }

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue => value && typeof value === 'object' ? value as RecordValue : {};
const text = (...values: unknown[]) => values.find((value): value is string => typeof value === 'string' && value.trim().length > 0)?.trim() || null;
const timestamp = (value: unknown) => typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : typeof value === 'number' && Number.isFinite(value) ? value : null;
const integer = (value: unknown) => typeof value === 'number' && Number.isInteger(value) ? value : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : null;

const mediaFor = (message: RecordValue): IncomingMetaMedia | undefined => {
  const candidate = (['image', 'audio', 'video', 'document'] as const)
    .map((kind) => [kind, record(message[kind])] as const)
    .find(([, value]) => typeof value.id === 'string');
  if (!candidate) return undefined;
  const [kind, value] = candidate;
  return { kind, mediaId: value.id as string, mimetype: text(value.mime_type), fileName: text(value.filename) };
};

const contentFor = (message: RecordValue, type: string | null) => type === 'text' ? text(record(message.text).body) || '' : text(record(message.image).caption, record(message.video).caption, record(message.document).caption) || '';

export const parseMetaWebhook = (payload: unknown): { messages: IncomingMetaMessage[]; statuses: MetaMessageStatus[]; reactions: IncomingMetaReaction[]; history: MetaHistoryBatch[]; businessAppEchoes: MetaBusinessAppEcho[]; accountUpdates: MetaCoexistenceAccountUpdate[] } => {
  const root = record(payload);
  if (root.object !== 'whatsapp_business_account' || !Array.isArray(root.entry)) return { messages: [], statuses: [], reactions: [], history: [], businessAppEchoes: [], accountUpdates: [] };
  const messages: IncomingMetaMessage[] = [];
  const statuses: MetaMessageStatus[] = [];
  const reactions: IncomingMetaReaction[] = [];
  const history: MetaHistoryBatch[] = [];
  const businessAppEchoes: MetaBusinessAppEcho[] = [];
  const accountUpdates: MetaCoexistenceAccountUpdate[] = [];
  for (const entry of root.entry) {
    for (const change of Array.isArray(record(entry).changes) ? record(entry).changes as unknown[] : []) {
      const value = record(record(change).value);
      const field = record(change).field;
      if (field === 'account_update') {
        const event = text(value.event);
        const wabaId = text(record(entry).id);
        if (wabaId && event === 'ACCOUNT_OFFBOARDED') accountUpdates.push({ wabaId, state: 'offboarded' });
        if (wabaId && event === 'ACCOUNT_RECONNECTED') accountUpdates.push({ wabaId, state: 'connected' });
        continue;
      }
      const phoneNumberId = text(record(value.metadata).phone_number_id);
      if (!phoneNumberId) continue;
      if (field === 'history') {
        for (const item of Array.isArray(value.history) ? value.history : []) {
          const batch = record(item); const metadata = record(batch.metadata);
          const errors = Array.isArray(batch.errors) ? batch.errors : [];
          const displayNumber = text(record(value.metadata).display_phone_number)?.replace(/\D/g, '') || '';
          const staged: MetaHistoryMessage[] = [];
          for (const threadValue of Array.isArray(batch.threads) ? batch.threads : []) {
            const thread = record(threadValue); const threadId = text(thread.id);
            if (!threadId) continue;
            for (const messageValue of Array.isArray(thread.messages) ? thread.messages : []) {
              const message = record(messageValue); const messageId = text(message.id); const from = text(message.from)?.replace(/\D/g, ''); const type = text(message.type);
              if (!messageId || !from || !type) continue;
              const to = text(message.to)?.replace(/\D/g, '') || null;
              const quotedMessageId = text(record(message.context).id);
              staged.push({ messageId, sourceId: `meta:${messageId}`, threadId, from, to, direction: displayNumber && from === displayNumber ? 'outgoing' : displayNumber ? 'incoming' : 'unknown', timestamp: timestamp(message.timestamp), type, content: contentFor(message, type), ...(mediaFor(message) ? { media: mediaFor(message) } : {}), ...(quotedMessageId ? { quotedMessageId } : {}), historyStatus: text(record(message.history_context).status) });
            }
          }
          history.push({ phoneNumberId, phase: integer(metadata.phase), chunkOrder: integer(metadata.chunk_order), progress: integer(metadata.progress), messages: staged, declined: errors.length > 0 });
        }
        continue;
      }
      if (field === 'smb_message_echoes') {
        for (const item of Array.isArray(value.message_echoes) ? value.message_echoes : []) {
          const message = record(item); const messageId = text(message.id); const to = text(message.to)?.replace(/\D/g, ''); const normalizedTo = to ? normalizeBrazilianPhone(to) : undefined; const type = text(message.type);
          if (!messageId || !normalizedTo || !/^\d{8,15}$/.test(normalizedTo) || !type) continue;
          const media = mediaFor(message); if (type !== 'text' && !media) continue;
          const quotedMessageId = text(record(message.context).id);
          businessAppEchoes.push({ transport: 'meta_cloud', origin: 'business_app', phoneNumberId, messageId, sourceId: `whatsapp:${normalizedTo}`, phoneNumber: `+${normalizedTo}`, name: normalizedTo, content: contentFor(message, type), ...(media ? { media } : {}), ...(quotedMessageId ? { quotedMessageId } : {}), timestamp: timestamp(message.timestamp) });
        }
        continue;
      }
      if (field !== 'messages') continue;
      const contacts = Array.isArray(value.contacts) ? value.contacts.map(record) : [];
      for (const item of Array.isArray(value.messages) ? value.messages : []) {
        const message = record(item);
        const messageId = text(message.id);
        const from = text(message.from)?.replace(/\D/g, '');
        const normalizedFrom = from ? normalizeBrazilianPhone(from) : undefined;
        if (!messageId || !normalizedFrom || !/^\d{8,15}$/.test(normalizedFrom)) continue;
        const contact = contacts.find((candidate) => candidate.wa_id === from) || {};
        const type = text(message.type);
        if (type === 'reaction') {
          const reaction = record(message.reaction);
          const targetMessageId = text(reaction.message_id);
          const emoji = typeof reaction.emoji === 'string' ? reaction.emoji : null;
          if (targetMessageId && emoji !== null) reactions.push({ phoneNumberId, eventId: messageId, targetMessageId, senderId: from, emoji });
          continue;
        }
        const media = mediaFor(message);
        const content = contentFor(message, type);
        if (type !== 'text' && !media) continue;
        const quotedMessageId = text(record(message.context).id);
        const contactName = text(record(contact.profile).name);
        messages.push({
          transport: 'meta_cloud', phoneNumberId, messageId, sourceId: `whatsapp:${normalizedFrom}`, phoneNumber: `+${normalizedFrom}`,
          name: contactName || normalizedFrom, ...(contactName ? { contactName } : {}), content, ...(media ? { media } : {}),
          ...(quotedMessageId ? { quotedMessageId } : {}), timestamp: timestamp(message.timestamp),
        });
      }
      for (const item of Array.isArray(value.statuses) ? value.statuses : []) {
        const status = record(item);
        const messageId = text(status.id);
        const state = text(status.status);
        if (!messageId || (state !== 'sent' && state !== 'delivered' && state !== 'read' && state !== 'failed')) continue;
        const errors = Array.isArray(status.errors) ? record(status.errors[0]) : {};
        statuses.push({ phoneNumberId, messageId, status: state, error: text(record(errors.error_data).details, errors.title, errors.message) });
      }
    }
  }
  return { messages, statuses, reactions, history, businessAppEchoes, accountUpdates };
};
