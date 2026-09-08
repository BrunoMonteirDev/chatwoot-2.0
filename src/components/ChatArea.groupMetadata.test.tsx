// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatArea } from './ChatArea';
import { groupMetadataClient, type GroupMetadata } from '../features/groups/metadata';
import type { ConversationSummary } from '../domain/currentUser';
import type { Chat } from '../types';

const get = vi.spyOn(groupMetadataClient, 'get');
let container: HTMLDivElement;
let root: Root;
const conversation: ConversationSummary = { id: 81, inboxId: 5, channelType: 'Channel::Api', contactName: 'Equipe', contactId: 65, contactAvatarUrl: null, lastMessage: 'Olá', lastMessageByCurrentUser: false, lastActivityAt: 1, updatedAt: 1, unreadCount: 0, status: 'open', priority: null, assigneeId: null, assigneeName: null, participantIds: [], teamId: null, teamName: null, labels: [], isGroup: false };
const chat = (messages: Chat['messages'] = []): Chat => ({ id: '81', name: 'Equipe', avatar: '', lastMessage: 'Olá', time: '', messages, isGroup: false });
const render = async (value: Chat) => act(async () => { root.render(<ChatArea chat={value} conversation={conversation} accountId={1} onSendMessage={() => undefined} onImageClick={() => undefined} onSearchInChat={() => undefined} />); });

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
    expect(get).toHaveBeenCalledExactlyOnceWith(1, 5, 81, 'waha');
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

  it('never loads group metadata for a private conversation', async () => {
    await render(chat([{ id: '1', sender: 'them', senderName: 'Contato', text: 'Olá', time: '10:00', whatsappTransport: 'waha', whatsappRemoteJid: '554499999999@c.us' }]));
    await render(chat([{ id: '2', sender: 'them', senderName: 'Contato', text: 'Outra', time: '10:01', whatsappTransport: 'waha', whatsappRemoteJid: '554499999999@c.us' }]));
    expect(get).not.toHaveBeenCalled();
  });
});
