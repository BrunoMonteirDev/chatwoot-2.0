// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatArea } from './ChatArea';
import { groupMetadataClient, type GroupMetadata } from '../features/groups/metadata';
import type { ContactProfile, ConversationSummary } from '../domain/currentUser';
import type { Chat } from '../types';

const get = vi.spyOn(groupMetadataClient, 'get');
let container: HTMLDivElement;
let root: Root;
const conversation: ConversationSummary = { id: 81, inboxId: 5, channelType: 'Channel::Api', contactName: 'Equipe', contactId: 65, contactAvatarUrl: null, lastMessage: 'Olá', lastMessageByCurrentUser: false, lastActivityAt: 1, updatedAt: 1, unreadCount: 0, status: 'open', priority: null, assigneeId: null, assigneeName: null, participantIds: [], teamId: null, teamName: null, labels: [], isGroup: false };
const chat = (messages: Chat['messages'] = []): Chat => ({ id: '81', name: 'Equipe', avatar: '', lastMessage: 'Olá', time: '', messages, isGroup: false });
const render = async (value: Chat, selected: ConversationSummary = conversation, contact?: ContactProfile | null) => act(async () => { root.render(<ChatArea chat={value} conversation={selected} contact={contact} accountId={1} onSendMessage={() => undefined} onImageClick={() => undefined} onSearchInChat={() => undefined} />); });
const profile = (id: number, name: string, avatarUrl: string, groupJid?: string): ContactProfile => ({ id, name, avatarUrl, phoneNumber: null, email: null, identifier: null, companyName: null, city: null, country: null, blocked: false, lastActivityAt: null, createdAt: null, additionalAttributes: groupJid ? { whatsapp_chat_type: 'group', whatsapp_group_jid: groupJid, whatsapp_group_participants: [{ jid: `${id}@lid` }], whatsapp_group_avatar_url: avatarUrl } : {}, customAttributes: {} });
const groupSelection = (id: number, name: string, avatar: string): [Chat, ConversationSummary, ContactProfile] => [{ ...chat([{ id: String(id), sender: 'them', senderName: name, senderIdentity: `${id}@lid`, text: name, time: '10:00', whatsappTransport: 'waha', whatsappRemoteJid: `${id}@g.us` }]), id: String(id), name, avatar, avatarType: 'image', isGroup: true }, { ...conversation, id, contactId: id, contactName: name, contactAvatarUrl: avatar, isGroup: true }, profile(id, name, avatar, `${id}@g.us`)];
const privateSelection = (id: number, name: string, avatar: string): [Chat, ConversationSummary, ContactProfile] => [{ ...chat(), id: String(id), name, avatar, avatarType: 'image', isGroup: false }, { ...conversation, id, contactId: id, contactName: name, contactAvatarUrl: avatar, isGroup: false }, profile(id, name, avatar)];

describe('ChatArea group metadata loading', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Element.prototype.scrollIntoView = vi.fn();
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    get.mockReset();
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  it('loads metadata once when late message data identifies a real group and reactively resolves its LID author', async () => {
    let resolveMetadata!: (value: { group: GroupMetadata }) => void;
    get.mockReturnValue(new Promise(resolve => { resolveMetadata = resolve; }));
    await render(chat());
    expect(get).not.toHaveBeenCalled();

    const groupChat = chat([{ id: '1', sender: 'them', senderName: 'Participante', senderIdentity: '19696904601705@lid', text: 'Olá', time: '10:00', whatsappTransport: 'waha', whatsappRemoteJid: '123@g.us' }]);
    await render(groupChat);
    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0].slice(0, 4)).toEqual([1, 5, 81, 'waha']);
    expect(container.textContent).toContain('Participante');

    await act(async () => resolveMetadata({ group: { id: '123@g.us', subject: 'Equipe', memberCount: 5, transport: 'waha', canEditDescription: true, participants: [
      { jid: '19696904601705@lid', lid: '19696904601705@lid', phoneJid: '554497755329@c.us', phoneNumber: '554497755329', name: 'Maria' },
      { jid: '2@lid' }, { jid: '3@lid' }, { jid: '4@lid' }, { jid: '5@lid' },
    ] } }));
    expect(container.textContent).toContain('Maria');
    expect(container.textContent).not.toContain('19696904601705@lid');

    await render(groupChat);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('discards metadata from A when it returns after navigating to B', async () => {
    let resolveA!: (value: { group: GroupMetadata }) => void;
    let resolveB!: (value: { group: GroupMetadata }) => void;
    get.mockImplementation((_account, _inbox, id) => new Promise(resolve => { if (id === 81) resolveA = resolve; else resolveB = resolve; }));
    const chatA = chat([{ id: 'a', sender: 'them', senderName: 'Participante', senderIdentity: '1@lid', text: 'A', time: '10:00', whatsappTransport: 'waha', whatsappRemoteJid: 'a@g.us' }]);
    const conversationB = { ...conversation, id: 82, contactName: 'Grupo B' };
    const chatB = { ...chat([{ id: 'b', sender: 'them', senderName: 'Participante', senderIdentity: '2@lid', text: 'B', time: '10:01', whatsappTransport: 'waha', whatsappRemoteJid: 'b@g.us' }]), id: '82', name: 'Grupo B' };

    await render(chatA);
    await render(chatB, conversationB);
    await act(async () => resolveB({ group: { id: 'b@g.us', subject: 'Grupo B', transport: 'waha', canEditDescription: true, participants: [{ jid: '2@lid', displayName: 'Bruna' }] } }));
    expect(container.textContent).toContain('Bruna');
    await act(async () => resolveA({ group: { id: 'a@g.us', subject: 'Grupo A', transport: 'waha', canEditDescription: true, participants: [{ jid: '1@lid', displayName: 'Alice' }] } }));
    expect(container.textContent).toContain('Bruna');
    expect(container.textContent).not.toContain('Alice');
  });

  it('renders B name and avatar on the first render after group A → group B', async () => {
    const [chatA, conversationA, contactA] = groupSelection(81, 'Grupo A', 'a.jpg');
    const [chatB, conversationB, contactB] = groupSelection(82, 'Grupo B', 'b.jpg');
    get.mockImplementation(() => new Promise(() => undefined));
    await render(chatA, conversationA, contactA);
    await render(chatB, conversationB, contactB);
    expect(container.querySelector('h2')?.textContent).toBe('Grupo B');
    expect(container.querySelector<HTMLImageElement>('img[alt="Grupo B"]')?.src).toContain('b.jpg');
    expect(container.textContent).not.toContain('Grupo A');
  });

  it('drops all group visuals immediately on group → private and ignores late group metadata', async () => {
    let resolveA!: (value: { group: GroupMetadata }) => void;
    get.mockImplementation(() => new Promise(resolve => { resolveA = resolve; }));
    const [chatA, conversationA, contactA] = groupSelection(81, 'Grupo A', 'a.jpg');
    const [chatC, conversationC, contactC] = privateSelection(83, 'Contato C', 'c.jpg');
    await render(chatA, conversationA, contactA);
    await render(chatC, conversationC, contactC);
    expect(container.querySelector('h2')?.textContent).toBe('Contato C');
    expect(container.querySelector<HTMLImageElement>('img[alt="Contato C"]')?.src).toContain('c.jpg');
    expect(container.textContent).not.toContain('dados do grupo');
    await act(async () => resolveA({ group: { id: '81@g.us', subject: 'Grupo A atrasado', avatarUrl: 'late-a.jpg', transport: 'waha', canEditDescription: true, participants: [] } }));
    expect(container.querySelector('h2')?.textContent).toBe('Contato C');
  });

  it('uses persisted group B visuals immediately on private → group and accepts only B metadata', async () => {
    let resolveB!: (value: { group: GroupMetadata }) => void;
    get.mockImplementation(() => new Promise(resolve => { resolveB = resolve; }));
    const [chatC, conversationC, contactC] = privateSelection(83, 'Contato C', 'c.jpg');
    const [chatB, conversationB, contactB] = groupSelection(82, 'Grupo B', 'b.jpg');
    await render(chatC, conversationC, contactC);
    await render(chatB, conversationB, contactB);
    expect(container.querySelector('h2')?.textContent).toBe('Grupo B');
    expect(container.querySelector<HTMLImageElement>('img[alt="Grupo B"]')?.src).toContain('b.jpg');
    await act(async () => resolveB({ group: { id: '82@g.us', subject: 'Grupo B atualizado', avatarUrl: 'new-b.jpg', transport: 'waha', canEditDescription: true, participants: [] } }));
    expect(container.querySelector('h2')?.textContent).toBe('Grupo B');
  });

  it('keeps private C after rapid A → B → C when B and A resolve out of order', async () => {
    const resolvers = new Map<number, (value: { group: GroupMetadata }) => void>();
    get.mockImplementation((_account, _inbox, id) => new Promise(resolve => { resolvers.set(id, resolve); }));
    const [chatA, conversationA, contactA] = groupSelection(81, 'Grupo A', 'a.jpg');
    const [chatB, conversationB, contactB] = groupSelection(82, 'Grupo B', 'b.jpg');
    const [chatC, conversationC, contactC] = privateSelection(83, 'Contato C', 'c.jpg');
    await render(chatA, conversationA, contactA);
    await render(chatB, conversationB, contactB);
    await render(chatC, conversationC, contactC);
    await act(async () => resolvers.get(82)?.({ group: { id: '82@g.us', subject: 'B atrasado', transport: 'waha', canEditDescription: true, participants: [] } }));
    await act(async () => resolvers.get(81)?.({ group: { id: '81@g.us', subject: 'A atrasado', transport: 'waha', canEditDescription: true, participants: [] } }));
    expect(container.querySelector('h2')?.textContent).toBe('Contato C');
    expect(container.querySelector<HTMLImageElement>('img[alt="Contato C"]')?.src).toContain('c.jpg');
  });

  it('never loads group metadata for a private conversation', async () => {
    await render(chat([{ id: '1', sender: 'them', senderName: 'Contato', text: 'Olá', time: '10:00', whatsappTransport: 'waha', whatsappRemoteJid: '554499999999@c.us' }]));
    await render(chat([{ id: '2', sender: 'them', senderName: 'Contato', text: 'Outra', time: '10:01', whatsappTransport: 'waha', whatsappRemoteJid: '554499999999@c.us' }]));
    expect(get).not.toHaveBeenCalled();
  });
});
