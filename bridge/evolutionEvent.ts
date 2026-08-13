export interface IncomingEvolutionMessage { instance: string; messageId: string; sourceId: string; phoneNumber?: string; lid?: string; fromMe: boolean; name: string; content: string; }

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue => value && typeof value === 'object' ? value as RecordValue : {};
const text = (...values: unknown[]) => values.find((value): value is string => typeof value === 'string' && value.trim().length > 0)?.trim() || null;

export const parseIncomingEvolutionMessage = (payload: unknown): IncomingEvolutionMessage | null => {
  const root = record(payload);
  if (root.event !== 'messages.upsert') return null;
  const data = record(Array.isArray(root.data) ? root.data[0] : root.data);
  const key = record(data.key);
  const remoteJid = text(key.remoteJid, data.remoteJid);
  if (!remoteJid || remoteJid.endsWith('@g.us') || remoteJid === 'status@broadcast') return null;
  const message = record(data.message);
  const extended = record(message.extendedTextMessage);
  const image = record(message.imageMessage);
  const content = text(message.conversation, extended.text, image.caption);
  const id = text(key.id, data.id);
  const instance = text(root.instance, data.instance);
  if (!instance || !id || !content) return null;
  const fromMe = key.fromMe === true;
  const jidNumber = remoteJid.endsWith('@s.whatsapp.net') ? remoteJid.replace(/@.+$/, '').replace(/\D/g, '') : '';
  const senderPn = text(key.senderPn, data.senderPn, key.participantPn)?.replace(/@.+$/, '').replace(/\D/g, '') || '';
  // In a message sent from the linked phone, senderPn is our own WhatsApp
  // number. The remote JID is the recipient and must be used to locate the
  // existing Chatwoot contact/conversation.
  const phone = (fromMe ? [jidNumber, senderPn] : [senderPn, jidNumber]).find(value => /^\d{8,15}$/.test(value));
  const lid = remoteJid.endsWith('@lid') ? remoteJid.replace(/@.+$/, '') : undefined;
  // WhatsApp can send a LID as remoteJid, while senderPn carries the actual
  // telephone number. Keep the phone as the canonical source whenever it is
  // present, and retain the LID as an alias in the bridge/contact metadata.
  if (!phone && !lid) return null;
  const sourceId = phone ? `whatsapp:${phone}` : `whatsapp:lid:${lid}`;
  return { instance, messageId: id, sourceId, fromMe, ...(phone ? { phoneNumber: `+${phone}` } : {}), ...(lid ? { lid } : {}), name: text(data.pushName, data.verifiedBizName, data.notifyName) || phone || lid!, content };
};
