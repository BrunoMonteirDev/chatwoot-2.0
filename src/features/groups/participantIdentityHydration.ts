import type { ContactProfile, ConversationMessage } from '../../domain/currentUser';
import { authenticatedBridgeHeaders } from '../../integrations/bridge/auth';
import { BridgeApiError } from '../../integrations/chatwoot/errors';
import { cacheContactProfiles } from '../contacts/useContactDetails';
import { participantIdentityKeys, validParticipantName } from './participant';
import type { GroupParticipant } from './metadata';
import { bridgePublicUrl } from '../../config/runtime';

export interface GroupParticipantIdentityQuery {
  contactId?: number;
  aliases: string[];
}

const stringAttribute = (message: ConversationMessage, key: string) => typeof message.contentAttributes[key] === 'string'
  ? String(message.contentAttributes[key]).trim()
  : '';
const positiveInteger = (value: unknown) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : undefined;
};
const isGroupIncoming = (message: ConversationMessage) => message.kind === 'incoming'
  && (stringAttribute(message, 'whatsapp_remote_jid').endsWith('@g.us') || message.contentAttributes.whatsapp_chat_type === 'group');
const queryKey = (query: GroupParticipantIdentityQuery) => `${query.contactId || ''}:${query.aliases.slice().sort().join('|')}`;

export const visibleGroupParticipantIdentityQueries = (messages: ConversationMessage[], groupName?: string | null) => {
  const queries = new Map<string, GroupParticipantIdentityQuery>();
  messages.forEach(message => {
    if (!isGroupIncoming(message)) return;
    const hasValidName = Boolean(validParticipantName(message.senderName, groupName));
    if (hasValidName && message.senderPhoneNumber && message.senderAvatarUrl) return;
    const participantContactId = positiveInteger(message.contentAttributes.whatsapp_participant_contact_id);
    const aliases = [...new Set([
      'whatsapp_participant_jid',
      'whatsapp_participant_phone',
      'whatsapp_participant_lid',
      'participant',
      'participantAlt',
      'senderAlt',
    ].map(key => stringAttribute(message, key)).filter(Boolean))];
    // sender_id is included as a candidate, but the server only accepts it when
    // it matches a persisted participant. A group Contact sender therefore can
    // never be promoted to message author.
    const contactId = participantContactId || positiveInteger(message.senderId);
    if (!contactId && !aliases.length) return;
    const query = { ...(contactId ? { contactId } : {}), aliases };
    const stableKey = aliases[0] || `contact:${contactId}`;
    const previous = queries.get(stableKey);
    queries.set(stableKey, previous
      ? { contactId: previous.contactId || query.contactId, aliases: [...new Set([...previous.aliases, ...query.aliases])] }
      : query);
  });
  return [...queries.values()];
};

const participantMatches = (participant: GroupParticipant, query: GroupParticipantIdentityQuery) => {
  if (query.contactId && participant.contactId === query.contactId) return true;
  const keys = new Set(participantIdentityKeys(participant).map(value => value.toLowerCase()));
  return query.aliases.some(alias => keys.has(alias.toLowerCase()) || keys.has(alias.replace(/@lid$/i, '').toLowerCase()));
};

const asContactProfile = (participant: GroupParticipant): ContactProfile | null => participant.contactId ? {
  id: participant.contactId,
  name: participant.displayName || participant.name || participant.phoneNumber || participant.phone || '',
  avatarUrl: participant.avatarUrl || null,
  phoneNumber: participant.phoneNumber || participant.phone || null,
  email: null,
  identifier: null,
  companyName: null,
  city: null,
  country: null,
  blocked: false,
  lastActivityAt: null,
  createdAt: null,
  additionalAttributes: {},
  customAttributes: {},
} : null;

export class GroupParticipantIdentityClient {
  private readonly identities = new Map<string, GroupParticipant[]>();
  private readonly inFlight = new Map<string, Promise<GroupParticipant[]>>();

  private scope(accountId: number, conversationId: number) { return `${accountId}:${conversationId}`; }

  async resolve(accountId: number, inboxId: number, conversationId: number, queries: GroupParticipantIdentityQuery[]) {
    if (!queries.length) return [];
    const scope = this.scope(accountId, conversationId);
    const cached = this.identities.get(scope) || [];
    const resolved = queries.flatMap(query => cached.find(participant => participantMatches(participant, query)) || []);
    const missing = queries.filter(query => !resolved.some(participant => participantMatches(participant, query)));
    if (!missing.length) return [...new Set(resolved)];
    const requestKey = `${scope}:${missing.map(queryKey).sort().join(',')}`;
    let pending = this.inFlight.get(requestKey);
    if (!pending) {
      pending = this.request(accountId, inboxId, conversationId, missing).then(participants => {
        const current = this.identities.get(scope) || [];
        const merged = [...current];
        participants.forEach(participant => {
          const index = merged.findIndex(candidate => participantIdentityKeys(candidate).some(key => participantIdentityKeys(participant).includes(key)));
          if (index < 0) merged.push(participant);
          else merged[index] = { ...merged[index], ...Object.fromEntries(Object.entries(participant).filter(([, value]) => value !== '' && value !== null && value !== undefined)) } as GroupParticipant;
        });
        this.identities.set(scope, merged);
        const contacts = participants.map(asContactProfile).filter((contact): contact is ContactProfile => Boolean(contact));
        cacheContactProfiles(accountId, contacts);
        return participants;
      }).finally(() => this.inFlight.delete(requestKey));
      this.inFlight.set(requestKey, pending);
    }
    return [...resolved, ...await pending];
  }

  clear() { this.identities.clear(); this.inFlight.clear(); }

  private async request(accountId: number, inboxId: number, conversationId: number, identifiers: GroupParticipantIdentityQuery[]) {
    const bridgeUrl = bridgePublicUrl();
    if (!bridgeUrl) throw new BridgeApiError(503, null, 'O endereço seguro do bridge não está configurado.');
    const response = await fetch(`${bridgeUrl}/groups/participant-identities`, {
      method: 'POST',
      headers: { ...authenticatedBridgeHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId, inboxId, conversationId, identifiers }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new BridgeApiError(response.status, body, 'Não foi possível resolver participantes persistidos.');
    return body && typeof body === 'object' && Array.isArray((body as { participants?: unknown }).participants)
      ? (body as { participants: GroupParticipant[] }).participants
      : [];
  }
}

export const groupParticipantIdentityClient = new GroupParticipantIdentityClient();

export const hydrateVisibleGroupParticipantIdentities = (
  accountId: number,
  inboxId: number,
  conversationId: number,
  messages: ConversationMessage[],
  groupName?: string | null,
) => groupParticipantIdentityClient.resolve(accountId, inboxId, conversationId, visibleGroupParticipantIdentityQueries(messages, groupName));
