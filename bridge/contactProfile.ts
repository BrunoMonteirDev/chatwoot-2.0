import { normalizeBrazilianPhone } from '../phone.js';

export type ContactProfileSyncPlan = { name: boolean; avatar: boolean };

const digits = (value: string | null | undefined) => value?.replace(/\D/g, '') || '';
const canonicalPhoneDigits = (value: string | null | undefined) => {
  const raw = digits(value);
  const withCountryCode = /^(?:[1-9]\d{9}|[1-9]\d{10})$/.test(raw) ? `55${raw}` : raw;
  return digits(normalizeBrazilianPhone(withCountryCode));
};
const equivalentBrazilianPhones = (first: string, second: string) => {
  if (first === second) return true;
  if (first.startsWith('55') && second.startsWith('55') && first.replace(/9/g, '') === second.replace(/9/g, '')) return true;
  const withoutOneNine = (value: string) => [...value].flatMap((digit, index) => digit === '9' ? [value.slice(0, index) + value.slice(index + 1)] : []);
  return withoutOneNine(first).includes(second) || withoutOneNine(second).includes(first);
};

export const isPhoneDefaultName = (name: string | null | undefined, phoneNumber: string | null | undefined) => {
  const nameDigits = canonicalPhoneDigits(name);
  const phoneDigits = canonicalPhoneDigits(phoneNumber);
  if (!nameDigits || !phoneDigits) return false;
  return equivalentBrazilianPhones(nameDigits, phoneDigits);
};

export const contactProfileSyncPlan = (
  contact: { name?: string | null; avatarUrl?: string | null; phoneNumber?: string | null },
  force = false,
): ContactProfileSyncPlan => ({
  name: force || !contact.name?.trim() || isPhoneDefaultName(contact.name, contact.phoneNumber),
  avatar: force || !contact.avatarUrl,
});
