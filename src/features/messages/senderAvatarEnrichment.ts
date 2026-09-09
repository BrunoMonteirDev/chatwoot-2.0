import type { ContactProfile, ConversationMessage } from '../../domain/currentUser';

export const senderContactId = (message: ConversationMessage) => {
  const participantContactId = Number(message.contentAttributes.whatsapp_participant_contact_id);
  return Number.isInteger(participantContactId) && participantContactId > 0 ? participantContactId : message.senderId || null;
};

export const missingSenderContactIds = (messages: ConversationMessage[]) => [...new Set(messages.flatMap(message => {
  if (message.kind !== 'incoming' || message.senderAvatarUrl) return [];
  const contactId = senderContactId(message);
  return contactId ? [contactId] : [];
}))];

export const resolveMissingSenderContacts = async (
  messages: ConversationMessage[],
  cached: (contactId: number) => ContactProfile | null,
  resolve: (contactId: number) => Promise<ContactProfile>,
) => Promise.all(missingSenderContactIds(messages).map(contactId => cached(contactId) || resolve(contactId)));
