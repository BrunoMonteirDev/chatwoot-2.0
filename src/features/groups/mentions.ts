export interface GroupParticipantIdentity {
  providerId: string;
  lid?: string;
  phoneJid?: string;
  phone?: string;
  displayName?: string;
  avatarUrl?: string;
  contactId?: number;
}

export interface MentionSelection {
  providerId: string;
  phoneJid?: string;
  token: string;
}

export const participantMentionLabel = (identity: GroupParticipantIdentity) => (
  identity.displayName?.trim() || identity.phone || 'Participante'
);

// WAHA's sendText contract accepts a real phone JID as its mention target.
// Keep the provider id as selection identity, but never manufacture a phone
// JID from a LID or from the rendered label.
export const mentionTargetFor = (identity: GroupParticipantIdentity) => (
  identity.phoneJid && /^\d{8,15}@(c\.us|s\.whatsapp\.net)$/.test(identity.phoneJid)
    ? identity.phoneJid
    : /^\d{8,15}@(c\.us|s\.whatsapp\.net)$/.test(identity.providerId)
      ? identity.providerId
      : undefined
);

export const pruneMentionSelections = (text: string, selections: MentionSelection[]) => {
  const available = new Map<string, number>();
  selections.forEach(({ token }) => {
    const count = text.split(token).length - 1;
    available.set(token, count);
  });
  return selections.filter((selection) => {
    const remaining = available.get(selection.token) || 0;
    if (remaining < 1) return false;
    available.set(selection.token, remaining - 1);
    return true;
  });
};

export const uniqueMentionTargets = (selections: MentionSelection[]) => [...new Set(
  selections.map((selection) => selection.phoneJid || selection.providerId).filter((target) => target === 'all' || /^\d{8,15}@(c\.us|s\.whatsapp\.net)$/.test(target))
)];

export const mentionReplacements = (selections: MentionSelection[]) => selections.flatMap((selection) => {
  const target = selection.phoneJid || selection.providerId;
  const phone = target.match(/^(\d{8,15})@(c\.us|s\.whatsapp\.net)$/)?.[1];
  return phone ? [{ token: selection.token, text: `@${phone}` }] : [];
});
