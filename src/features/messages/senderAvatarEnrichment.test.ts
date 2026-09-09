import { describe, expect, it, vi } from 'vitest';
import type { ContactProfile, ConversationMessage } from '../../domain/currentUser';
import { missingSenderContactIds, resolveMissingSenderContacts } from './senderAvatarEnrichment';

const message = (overrides: Partial<ConversationMessage> = {}): ConversationMessage => ({
  id: 1, conversationId: 1, kind: 'incoming', contentType: 'text', content: 'oi', createdAt: 1,
  updatedAt: null, status: 'sent', senderId: 91, senderName: 'Ricardo', senderEmail: null,
  senderAvatarUrl: null, origin: null, attachments: [], contentAttributes: {}, ...overrides,
});
const contact = (id: number): ContactProfile => ({
  id, name: `Contato ${id}`, avatarUrl: `${id}.jpg`, phoneNumber: null, email: null, identifier: null,
  companyName: null, city: null, country: null, blocked: false, lastActivityAt: null, createdAt: null,
  additionalAttributes: {}, customAttributes: {},
});

describe('sender avatar enrichment', () => {
  it('não resolve Contact quando a mensagem já tem thumbnail', async () => {
    const resolve = vi.fn();
    expect(await resolveMissingSenderContacts([message({ senderAvatarUrl: 'ready.jpg' })], () => null, resolve)).toEqual([]);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('usa Contact cacheado sem request', async () => {
    const resolve = vi.fn();
    expect(await resolveMissingSenderContacts([message()], () => contact(91), resolve)).toEqual([contact(91)]);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('deduplica vinte mensagens do mesmo Contact em uma resolução', async () => {
    const resolve = vi.fn(async (id: number) => contact(id));
    const messages = Array.from({ length: 20 }, (_, index) => message({ id: index + 1 }));
    await resolveMissingSenderContacts(messages, () => null, resolve);
    expect(resolve).toHaveBeenCalledOnce();
    expect(resolve).toHaveBeenCalledWith(91);
  });

  it('deduplica múltiplos participantes por participant_contact_id', () => {
    const messages = [
      message({ id: 1, senderId: 800, contentAttributes: { whatsapp_participant_contact_id: 91 } }),
      message({ id: 2, senderId: 800, contentAttributes: { whatsapp_participant_contact_id: 91 } }),
      message({ id: 3, senderId: 800, contentAttributes: { whatsapp_participant_contact_id: 92 } }),
    ];
    expect(missingSenderContactIds(messages)).toEqual([91, 92]);
  });
});
