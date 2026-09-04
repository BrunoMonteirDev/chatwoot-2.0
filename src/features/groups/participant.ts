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
  if (displayName && displayPhone) return `${displayName} · ${displayPhone}`;
  if (displayName) return displayName;
  if (displayPhone) return displayPhone;
  return 'Participante';
};
export const participantColor = (identity: string) => {
  let hash = 0; for (let i = 0; i < identity.length; i += 1) hash = ((hash << 5) - hash + identity.charCodeAt(i)) | 0;
  return ['#e67c73', '#d98ee8', '#7aa5e8', '#59b8a7', '#d6a653', '#d9769b', '#7fb069'][Math.abs(hash) % 7];
};
