const brazilianMobileWithAdditionalNine = /^55([1-9]\d)9(\d{8})$/;

/**
 * Uses the Brazilian mobile format without the additional ninth digit as the
 * canonical identity. Other countries and unexpected formats stay untouched.
 */
export const normalizeBrazilianPhone = (value: string): string => {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');
  const match = brazilianMobileWithAdditionalNine.exec(digits);
  if (!match) return value;

  const normalized = `55${match[1]}${match[2]}`;
  return trimmed.startsWith('+') ? `+${normalized}` : normalized;
};
