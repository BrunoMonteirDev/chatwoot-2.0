export type GroupParticipantIdentity = {
  providerId: string;
  lid?: string;
  phoneJid?: string;
  phone?: string;
  displayName?: string;
  avatarUrl?: string;
  contactId?: number;
};

export type ParticipantScope = { accountId: number; inboxId: number; session: string };

const phoneFromJid = (jid?: string) => jid?.match(/^(\d{8,15})@(c\.us|s\.whatsapp\.net)$/)?.[1];
export const resolveGroupParticipantIdentity = (input: Record<string, unknown>): GroupParticipantIdentity => {
  const providerId = String(input.participantAlt || input.senderAlt || input.participant || input.sender || input.from || 'unknown');
  const candidates = [input.participantAlt, input.senderAlt, input.participant, input.sender, input.from].filter((value): value is string => typeof value === 'string');
  const phoneJid = candidates.find(value => /^(\d{8,15})@(c\.us|s\.whatsapp\.net)$/.test(value));
  const lidJid = candidates.find(value => value.endsWith('@lid'));
  const phone = phoneFromJid(phoneJid) || (typeof input.phone === 'string' ? input.phone.replace(/\D/g, '') : undefined);
  const displayName = [input.name, input.pushName, input.notifyName].find((value): value is string => typeof value === 'string' && value.trim().length > 0);
  const avatarUrl = [input.avatarUrl, input.profilePictureUrl, input.imgUrl].find((value): value is string => typeof value === 'string' && value.trim().length > 0);
  return { providerId, ...(lidJid ? { lid: lidJid.replace(/@lid$/, '') } : {}), ...(phoneJid ? { phoneJid } : {}), ...(phone ? { phone: `+${phone}` } : {}), ...(displayName ? { displayName } : {}), ...(avatarUrl ? { avatarUrl } : {}) };
};

export class GroupParticipantIdentityCache {
  private values = new Map<string, GroupParticipantIdentity>();
  private key(scope: ParticipantScope, lid: string) { return `${scope.accountId}:${scope.inboxId}:${scope.session}:${lid}`; }
  get(scope: ParticipantScope, lid: string) { return this.values.get(this.key(scope, lid)); }
  set(scope: ParticipantScope, identity: GroupParticipantIdentity) { if (identity.lid) this.values.set(this.key(scope, identity.lid), identity); }
}
