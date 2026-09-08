export const participantIdentity = (jid?: string | null, phone?: string | null) => jid || phone?.replace(/\D/g, '') || 'unknown-participant';
export const participantPhone = (jid?: string | null, phone?: string | null) => {
  const digits = phone?.replace(/\D/g, '') || jid?.match(/^(\d{8,15})@(c\.us|s\.whatsapp\.net)$/)?.[1];
  return digits ? `+${digits}` : '';
};
// Never expose a LID while a human-readable name or a resolved number exists.
// It is only a last-resort identity when WhatsApp has not supplied either.
export const participantLabel = (name?: string | null, jid?: string | null, phone?: string | null) => {
  const displayName = name?.trim();
  const displayPhone = participantPhone(jid, phone);
  if (displayName) return displayName;
  if (displayPhone) return displayPhone;
  return jid?.endsWith('@lid') ? 'Participante' : jid?.trim() || 'Participante';
};
type ParticipantIdentity = { jid: string; providerId?: string; lid?: string; phoneJid?: string; phone?: string; phoneNumber?: string };
export const participantIdentityKeys = (participant: ParticipantIdentity) => {
  const values = [participant.jid, participant.providerId, participant.lid, participant.phoneJid, participant.phone, participant.phoneNumber];
  const keys = new Set(values.filter((value): value is string => Boolean(value)));
  values.forEach(value => {
    const digits = value?.replace(/\D/g, '');
    if (!digits) return;
    keys.add(digits); keys.add(`${digits}@c.us`); keys.add(`${digits}@s.whatsapp.net`);
  });
  return Array.from(keys);
};
export const indexGroupParticipants = <T extends ParticipantIdentity>(participants: T[]) => {
  const indexed: Record<string, T> = {};
  participants.forEach(participant => participantIdentityKeys(participant).forEach(key => { indexed[key] = participant; }));
  return indexed;
};
export const participantColor = (identity: string) => {
  let hash = 0; for (let i = 0; i < identity.length; i += 1) hash = ((hash << 5) - hash + identity.charCodeAt(i)) | 0;
  return ['#e67c73', '#d98ee8', '#7aa5e8', '#59b8a7', '#d6a653', '#d9769b', '#7fb069'][Math.abs(hash) % 7];
};
