import { normalizeBrazilianPhone } from '../phone.ts';

export type EvolutionMediaKind = 'image' | 'audio' | 'video' | 'document';

export interface IncomingEvolutionMedia {
  kind: EvolutionMediaKind;
  mimetype: string | null;
  fileName: string | null;
  duration: number | null;
  fileLength: number | null;
  // The download API requires the original Evolution message, including its
  // key, mediaKey and encrypted-media metadata. It never leaves the bridge.
  message: Record<string, unknown>;
}

export interface IncomingEvolutionMessage { instance: string; messageId: string; sourceId: string; remoteJid: string; phoneNumber?: string; lid?: string; fromMe: boolean; name: string; contactName?: string; content: string; chatType?: 'private' | 'group'; participantJid?: string; participantName?: string; media?: IncomingEvolutionMedia; quotedMessageId?: string; }

export interface IncomingEvolutionReaction {
  instance: string;
  eventId: string;
  targetMessageId: string;
  targetFromMe: boolean;
  sourceId: string;
  remoteJid: string;
  phoneNumber?: string;
  lid?: string;
  fromMe: boolean;
  name: string;
  contactName?: string;
  chatType?: 'private' | 'group';
  participantJid?: string;
  participantName?: string;
  senderId: string;
  emoji: string;
}

export interface IncomingEvolutionEdit {
  instance: string;
  eventId: string;
  targetMessageId: string;
  remoteJid: string;
  fromMe: boolean;
  participant?: string;
  content: string;
}

export interface IncomingEvolutionRevoke {
  instance: string;
  eventId: string;
  targetMessageId: string;
  remoteJid: string;
  fromMe: boolean;
  participant?: string;
}

export interface EvolutionGroupParticipant {
  jid: string;
  phoneNumber?: string;
  name?: string;
  avatarUrl?: string;
  admin?: string | null;
}

export interface IncomingEvolutionGroupLifecycle {
  instance: string;
  eventId: string;
  groupJid: string;
  subject?: string;
  avatarUrl?: string;
  participants?: EvolutionGroupParticipant[];
  participantAction?: 'add' | 'remove' | 'promote' | 'demote';
}

type RecordValue = Record<string, unknown>;
type EvolutionIdentity = {
  fromMe: boolean;
  sourceId: string;
  name: string;
  contactName?: string;
  phoneNumber?: string;
  lid?: string;
  chatType?: 'private' | 'group';
  participantJid?: string;
  participantName?: string;
};
const record = (value: unknown): RecordValue => value && typeof value === 'object' ? value as RecordValue : {};
const text = (...values: unknown[]) => values.find((value): value is string => typeof value === 'string' && value.trim().length > 0)?.trim() || null;
const number = (...values: unknown[]) => {
  const value = values.find(candidate => (typeof candidate === 'number' && Number.isFinite(candidate)) || (typeof candidate === 'string' && /^\d+$/.test(candidate)));
  return typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : null;
};

// Chatwoot's public conversation route treats a literal dot in a dynamic
// segment as a format extension. Store the group JID in a reversible,
// path-safe source id; the original JID remains in contact attributes.
export const evolutionGroupSourceId = (groupJid: string) => `whatsapp:group:${encodeURIComponent(groupJid).replace(/\./g, '%2E')}`;

const mediaFor = (data: RecordValue, image: RecordValue, audio: RecordValue, video: RecordValue, document: RecordValue): IncomingEvolutionMedia | undefined => {
  const candidate = [
    ['image', image], ['audio', audio], ['video', video], ['document', document],
  ] as const;
  const found = candidate.find(([, value]) => Object.keys(value).length > 0);
  if (!found) return undefined;
  const [kind, value] = found;
  return {
    kind,
    mimetype: text(value.mimetype),
    fileName: text(value.fileName, value.file_name),
    duration: number(value.seconds, value.duration),
    fileLength: number(value.fileLength, value.file_length),
    message: data,
  };
};

// WhatsApp wraps media when disappearing messages or view-once are enabled.
// Evolution preserves that envelope, but the media download endpoint still
// needs the original event `data` (not this unwrapped inner message).
const unwrapMessage = (value: unknown): RecordValue => {
  let message = record(value);
  for (let depth = 0; depth < 4; depth += 1) {
    const wrapped = [message.ephemeralMessage, message.viewOnceMessage, message.viewOnceMessageV2, message.viewOnceMessageV2Extension]
      .map(record)
      .find(candidate => Object.keys(record(candidate.message)).length > 0);
    if (!wrapped) break;
    message = record(wrapped.message);
  }
  return message;
};

const identityFor = (key: RecordValue, data: RecordValue, remoteJid: string): EvolutionIdentity | null => {
  const fromMe = key.fromMe === true;
  const jidNumber = remoteJid.endsWith('@s.whatsapp.net') ? remoteJid.replace(/@.+$/, '').replace(/\D/g, '') : '';
  const senderPn = text(key.senderPn, data.senderPn, key.participantPn)?.replace(/@.+$/, '').replace(/\D/g, '') || '';
  // For a mobile echo, remoteJid is the recipient while senderPn identifies
  // our own account. Contact lookup must remain anchored to the recipient.
  const rawPhone = (fromMe ? [jidNumber, senderPn] : [senderPn, jidNumber]).find(value => /^\d{8,15}$/.test(value));
  const phone = rawPhone ? normalizeBrazilianPhone(rawPhone) : undefined;
  const lid = remoteJid.endsWith('@lid') ? remoteJid.replace(/@.+$/, '') : undefined;
  if (!phone && !lid) return null;
  const contactName = text(data.pushName, data.verifiedBizName, data.notifyName);
  return {
    fromMe,
    ...(phone ? { phoneNumber: `+${phone}` } : {}),
    ...(lid ? { lid } : {}),
    sourceId: phone ? `whatsapp:${phone}` : `whatsapp:lid:${lid}`,
    name: contactName || phone || lid!,
    ...(contactName ? { contactName } : {}),
  };
};

const groupIdentityFor = (key: RecordValue, data: RecordValue, remoteJid: string): EvolutionIdentity => {
  const fromMe = key.fromMe === true;
  const participantJid = text(key.participant, data.participant, key.participantPn, data.participantPn);
  return {
    fromMe,
    sourceId: evolutionGroupSourceId(remoteJid),
    name: text(data.subject, data.groupSubject, data.groupName, data.notifyName) || remoteJid,
    chatType: 'group' as const,
    ...(participantJid ? { participantJid } : {}),
    ...(text(data.pushName, data.notifyName) ? { participantName: text(data.pushName, data.notifyName)! } : {}),
  };
};

export const parseIncomingEvolutionMessage = (payload: unknown): IncomingEvolutionMessage | null => {
  const root = record(payload);
  if (root.event !== 'messages.upsert') return null;
  const data = record(Array.isArray(root.data) ? root.data[0] : root.data);
  const key = record(data.key);
  const remoteJid = text(key.remoteJid, data.remoteJid);
  if (!remoteJid || remoteJid === 'status@broadcast') return null;
  const message = unwrapMessage(data.message);
  const extended = record(message.extendedTextMessage);
  const image = record(message.imageMessage);
  const audio = record(message.audioMessage);
  const video = record(message.videoMessage);
  const document = record(message.documentMessage);
  const media = mediaFor(data, image, audio, video, document);
  const content = text(message.conversation, extended.text, image.caption);
  // Evolution v2 can put the quoted-message context either in the concrete
  // message payload or in a message-level context wrapper. Do not infer a
  // quote from text/body: only a provider message ID is a valid target.
  const contexts = [
    record(extended.contextInfo), record(image.contextInfo), record(audio.contextInfo), record(video.contextInfo), record(document.contextInfo),
    record(message.contextInfo), record(message.messageContextInfo), record(data.contextInfo), record(data.messageContextInfo),
  ];
  const context = text(...contexts.map(value => value.stanzaId), ...contexts.map(value => record(value.quotedMessage).key ? text(record(record(value.quotedMessage).key).id) : null));
  const id = text(key.id, data.id);
  const instance = text(root.instance, data.instance);
  if (!instance || !id || (!content && !media)) return null;
  const identity = remoteJid.endsWith('@g.us') ? groupIdentityFor(key, data, remoteJid) : identityFor(key, data, remoteJid);
  if (!identity) return null;
  return { instance, messageId: id, remoteJid, ...identity, content: content || '', ...(media ? { media } : {}), ...(context ? { quotedMessageId: context } : {}) };
};

export const parseIncomingEvolutionReaction = (payload: unknown): IncomingEvolutionReaction | null => {
  const root = record(payload);
  if (root.event !== 'messages.upsert') return null;
  const data = record(Array.isArray(root.data) ? root.data[0] : root.data);
  const eventKey = record(data.key);
  const message = record(data.message);
  const reaction = record(message.reactionMessage);
  if (!Object.keys(reaction).length) return null;
  const targetKey = record(reaction.key);
  const remoteJid = text(targetKey.remoteJid, eventKey.remoteJid, data.remoteJid);
  if (!remoteJid || remoteJid === 'status@broadcast') return null;
  const instance = text(root.instance, data.instance);
  const eventId = text(eventKey.id, data.id);
  const targetMessageId = text(targetKey.id);
  // WhatsApp represents removal by an empty `text`, which is distinct from a
  // malformed webhook where reaction text is absent altogether.
  const rawEmoji = reaction.text;
  const emoji = rawEmoji === '' ? '' : text(rawEmoji);
  if (!instance || !eventId || !targetMessageId || emoji === null) return null;
  const identity = remoteJid.endsWith('@g.us') ? groupIdentityFor(eventKey, data, remoteJid) : identityFor(eventKey, data, remoteJid);
  if (!identity) return null;
  const senderNumber = text(eventKey.senderPn, data.senderPn, eventKey.participantPn, targetKey.participant)?.replace(/@.+$/, '').replace(/\D/g, '');
  const senderId = identity.fromMe ? 'self' : identity.chatType === 'group' && identity.participantJid
    ? `participant:${identity.participantJid}`
    : senderNumber && /^\d{8,15}$/.test(senderNumber)
    ? `contact:${senderNumber}`
    : identity.phoneNumber
      ? `contact:${identity.phoneNumber.replace(/\D/g, '')}`
      : `contact:lid:${identity.lid}`;
  return {
    instance,
    eventId,
    targetMessageId,
    targetFromMe: targetKey.fromMe === true,
    remoteJid,
    ...identity,
    senderId,
    emoji,
  };
};

const eventData = (payload: unknown, expected: string | string[]) => {
  const root = record(payload);
  const expectedEvents = Array.isArray(expected) ? expected : [expected];
  if (typeof root.event !== 'string' || !expectedEvents.includes(root.event)) return null;
  const data = record(Array.isArray(root.data) ? root.data[0] : root.data);
  const instance = text(root.instance, data.instance);
  return instance ? { data, instance } : null;
};

const editedText = (value: RecordValue) => {
  const protocol = record(value.editedMessage);
  const message = record(protocol.message);
  return text(
    message.conversation,
    record(message.extendedTextMessage).text,
    protocol.conversation,
    record(protocol.extendedTextMessage).text,
    value.conversation,
    record(value.extendedTextMessage).text,
  );
};

// Evolution v2 has emitted both `messages.edited` and `messages.update`
// across releases/configurations. We only accept an update when it contains
// the original key and edited text, so ordinary delivery updates stay ignored.
export const parseIncomingEvolutionEdit = (payload: unknown): IncomingEvolutionEdit | null => {
  const event = eventData(payload, ['messages.edited', 'messages.update']);
  if (!event) return null;
  const key = record(event.data.key);
  const targetMessageId = text(key.id, event.data.messageId);
  const remoteJid = text(key.remoteJid, event.data.remoteJid);
  const content = editedText(event.data);
  if (!targetMessageId || !remoteJid || !content) return null;
  return {
    instance: event.instance,
    eventId: text(event.data.id, event.data.eventId, targetMessageId) || targetMessageId,
    targetMessageId,
    remoteJid,
    fromMe: key.fromMe === true,
    ...(text(key.participant, event.data.participant) ? { participant: text(key.participant, event.data.participant)! } : {}),
    content,
  };
};

// `messages.delete` has either the key as data itself or inside data.key,
// depending on whether it was emitted by Baileys or Evolution's repository.
export const parseIncomingEvolutionRevoke = (payload: unknown): IncomingEvolutionRevoke | null => {
  const event = eventData(payload, 'messages.delete');
  if (!event) return null;
  const key = Object.keys(record(event.data.key)).length ? record(event.data.key) : event.data;
  const targetMessageId = text(key.id, event.data.messageId, event.data.keyId);
  const remoteJid = text(key.remoteJid, event.data.remoteJid);
  if (!targetMessageId || !remoteJid) return null;
  return {
    instance: event.instance,
    eventId: text(event.data.eventId, event.data.id, targetMessageId) || targetMessageId,
    targetMessageId,
    remoteJid,
    fromMe: key.fromMe === true,
    ...(text(key.participant, event.data.participant) ? { participant: text(key.participant, event.data.participant)! } : {}),
  };
};

const participant = (value: unknown): EvolutionGroupParticipant | null => {
  if (typeof value === 'string') return value ? { jid: value } : null;
  const data = record(value);
  const jid = text(data.id, data.jid, data.participant);
  if (!jid) return null;
  return {
    jid,
    ...(text(data.phoneNumber, data.phone) ? { phoneNumber: text(data.phoneNumber, data.phone)! } : {}),
    ...(text(data.name, data.notifyName, data.pushName) ? { name: text(data.name, data.notifyName, data.pushName)! } : {}),
    ...(text(data.imgUrl, data.avatarUrl) ? { avatarUrl: text(data.imgUrl, data.avatarUrl)! } : {}),
    ...(typeof data.admin === 'string' || data.admin === null ? { admin: data.admin as string | null } : {}),
  };
};

// Evolution v2 forwards Baileys' `groups.upsert`, `groups.update` and
// `group-participants.update` payloads unchanged (the latter adds optional
// participantsData). Parsing stays separate from ordinary messages so a
// metadata update can never create a text bubble.
export const parseIncomingEvolutionGroupLifecycle = (payload: unknown): IncomingEvolutionGroupLifecycle[] => {
  const root = record(payload);
  const eventName = text(root.event);
  if (eventName !== 'groups.upsert' && eventName !== 'groups.update' && eventName !== 'group-participants.update') return [];
  const rootData = Array.isArray(root.data) ? root.data : [root.data];
  const instance = text(root.instance) || '';
  if (!instance) return [];
  return rootData.flatMap((value, index): IncomingEvolutionGroupLifecycle[] => {
    const data = record(value);
    const groupJid = text(data.id, data.remoteJid, data.groupJid);
    if (!groupJid || !groupJid.endsWith('@g.us')) return [];
    const rawParticipants = Array.isArray(data.participantsData) ? data.participantsData : Array.isArray(data.participants) ? data.participants : undefined;
    const participants = rawParticipants?.flatMap(item => {
      const parsed = participant(item);
      return parsed ? [parsed] : [];
    });
    const action = text(data.action);
    return [{
      instance,
      // GroupMetadata has `id` = group JID, not an event id. Keep a stable
      // fingerprint of the actual update so a subject/participant change is
      // not mistaken for a duplicate merely because it targets the same JID.
      eventId: text(data.eventId) || `${eventName}:${groupJid}:${JSON.stringify(data)}`,
      groupJid,
      ...(text(data.subject, data.groupSubject) ? { subject: text(data.subject, data.groupSubject)! } : {}),
      ...(text(data.pictureUrl, data.imgUrl, data.avatarUrl) ? { avatarUrl: text(data.pictureUrl, data.imgUrl, data.avatarUrl)! } : {}),
      ...(participants ? { participants } : {}),
      ...(action === 'add' || action === 'remove' || action === 'promote' || action === 'demote' ? { participantAction: action } : {}),
    }];
  });
};
