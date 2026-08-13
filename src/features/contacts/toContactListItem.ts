import type { ContactProfile } from '../../domain/currentUser';
import type { Chat } from '../../types';

const asIso = (timestamp: number | null): string | undefined => timestamp ? new Date(timestamp * 1000).toISOString() : undefined;

export const toContactListItem = (contact: ContactProfile): Chat => ({
  id: String(contact.id),
  name: contact.name,
  avatar: contact.avatarUrl || contact.name.slice(0, 2).toUpperCase(),
  avatarType: contact.avatarUrl ? 'image' : 'initials',
  avatarBg: '#00a884',
  phone: contact.phoneNumber || undefined,
  about: contact.phoneNumber || undefined,
  email: contact.email || undefined,
  identifier: contact.identifier || undefined,
  company: contact.companyName || undefined,
  description: typeof contact.additionalAttributes.description === 'string' ? contact.additionalAttributes.description : undefined,
  city: contact.city || undefined,
  countryName: contact.country || undefined,
  isBlocked: contact.blocked,
  createdAt: asIso(contact.createdAt),
  lastActivityAt: asIso(contact.lastActivityAt),
  time: contact.lastActivityAt ? new Date(contact.lastActivityAt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
  lastMessage: '',
  messages: [],
});
