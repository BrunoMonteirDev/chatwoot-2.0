// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatArea } from './ChatArea';
import { groupMetadataClient } from '../features/groups/metadata';
import type { ContactProfile, ConversationSummary } from '../domain/currentUser';
import type { Chat } from '../types';

const get = vi.spyOn(groupMetadataClient, 'get');
let container: HTMLDivElement;
let root: Root;
const conversation: ConversationSummary = { id: 81, inboxId: 5, channelType: 'Channel::Api', contactName: 'Equipe', contactId: 65, contactAvatarUrl: null, lastMessage: 'Olá', lastMessageByCurrentUser: false, lastActivityAt: 1, updatedAt: 1, unreadCount: 0, status: 'open', priority: null, assigneeId: null, assigneeName: null, participantIds: [], teamId: null, teamName: null, labels: [], isGroup: true };
const chat: Chat = { id: '81', name: 'Equipe', avatar: '', lastMessage: 'Olá', time: '', messages: [{ id: '1', sender: 'them', senderIdentity: '123@lid', text: 'Olá', time: '10:00', whatsappTransport: 'waha', whatsappRemoteJid: '120@g.us' }], isGroup: true };
const contact: ContactProfile = { id: 65, name: 'Equipe', avatarUrl: 'group.jpg', phoneNumber: null, email: null, identifier: null, companyName: null, city: null, country: null, blocked: false, lastActivityAt: null, createdAt: null, additionalAttributes: { whatsapp_chat_type: 'group', whatsapp_group_jid: '120@g.us', whatsapp_group_transport: 'waha', whatsapp_group_participants: [{ jid: '123@lid', display_name: 'Maria', contact_id: 44 }] }, customAttributes: {} };

describe('ChatArea group metadata opening', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Element.prototype.scrollIntoView = vi.fn();
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    get.mockReset();
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  it('renders persisted group identity and participants without querying the provider', async () => {
    await act(async () => { root.render(<ChatArea chat={chat} conversation={conversation} contact={contact} accountId={1} historyStatus="ready" onSendMessage={() => undefined} onImageClick={() => undefined} onSearchInChat={() => undefined} />); });
    expect(container.querySelector('h2')?.textContent).toBe('Equipe');
    expect(container.textContent).toContain('Maria');
    expect(get).not.toHaveBeenCalled();
  });

  it('does not query group metadata before or after the first message render', async () => {
    await act(async () => { root.render(<ChatArea chat={chat} conversation={conversation} accountId={1} historyStatus="loading" onSendMessage={() => undefined} onImageClick={() => undefined} onSearchInChat={() => undefined} />); });
    await act(async () => { root.render(<ChatArea chat={chat} conversation={conversation} accountId={1} historyStatus="ready" onSendMessage={() => undefined} onImageClick={() => undefined} onSearchInChat={() => undefined} />); });
    expect(get).not.toHaveBeenCalled();
  });

  it('renders the sender thumbnail carried by the message without opening group data', async () => {
    const withSenderAvatar = { ...chat, messages: [{ ...chat.messages[0], senderName: 'Maria', senderAvatarUrl: 'https://example.test/maria.jpg' }] };
    await act(async () => { root.render(<ChatArea chat={withSenderAvatar} conversation={conversation} accountId={1} historyStatus="ready" onSendMessage={() => undefined} onImageClick={() => undefined} onSearchInChat={() => undefined} />); });
    expect(container.querySelector('img[src="https://example.test/maria.jpg"]')).toBeTruthy();
    expect(get).not.toHaveBeenCalled();
  });

  it('switches A → B → C from selected conversation data without stale provider responses', async () => {
    for (const [id, name] of [[81, 'Grupo A'], [82, 'Grupo B'], [83, 'Contato C']] as const) {
      const selected = { ...conversation, id, contactName: name, contactId: id, isGroup: id !== 83 };
      const selectedChat = { ...chat, id: String(id), name, isGroup: id !== 83, messages: [] };
      await act(async () => { root.render(<ChatArea chat={selectedChat} conversation={selected} accountId={1} onSendMessage={() => undefined} onImageClick={() => undefined} onSearchInChat={() => undefined} />); });
      expect(container.querySelector('h2')?.textContent).toBe(name);
    }
    expect(get).not.toHaveBeenCalled();
  });
});
