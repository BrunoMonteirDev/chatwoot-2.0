export const participantIdentity = (jid?: string | null, phone?: string | null) => jid || phone?.replace(/\D/g, '') || 'unknown-participant';
export const participantPhone = (jid?: string | null, phone?: string | null) => {
  const digits = phone?.replace(/\D/g, '') || jid?.match(/^(\d{8,15})@/)?.[1];
  if (!digits) return '';
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    const local = digits.slice(4);
    return `+55 ${digits.slice(2, 4)} ${local.length === 9 ? `${local.slice(0, 5)}-${local.slice(5)}` : `${local.slice(0, 4)}-${local.slice(4)}`}`;
  }
  return `+${digits}`;
};
// A LID is a provider implementation detail, never a label for an agent.
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
