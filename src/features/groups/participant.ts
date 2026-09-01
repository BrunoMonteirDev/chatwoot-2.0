export const participantIdentity = (jid?: string | null, phone?: string | null) => jid || phone?.replace(/\D/g, '') || 'unknown-participant';
export const participantPhone = (jid?: string | null, phone?: string | null) => {
  const digits = phone?.replace(/\D/g, '') || jid?.match(/^(\d{8,15})@/)?.[1];
  return digits ? `+${digits}` : jid?.endsWith('@lid') ? 'Número não disponível' : 'Número não disponível';
};
export const participantLabel = (name?: string | null, jid?: string | null, phone?: string | null) => `${name?.trim() || (jid?.endsWith('@lid') ? 'Participante' : 'Sem nome')} · ${participantPhone(jid, phone)}`;
export const participantColor = (identity: string) => {
  let hash = 0; for (let i = 0; i < identity.length; i += 1) hash = ((hash << 5) - hash + identity.charCodeAt(i)) | 0;
  return ['#e67c73', '#d98ee8', '#7aa5e8', '#59b8a7', '#d6a653', '#d9769b', '#7fb069'][Math.abs(hash) % 7];
};
