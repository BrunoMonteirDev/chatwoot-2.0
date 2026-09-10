// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { messageService } from '../../integrations/chatwoot/messages';
import { authSession } from '../../integrations/chatwoot/authSession';
import { messageHistoryCache } from './MessageHistoryCache';
import { useConversationMessages } from './useConversationMessages';
import { groupParticipantIdentityClient } from '../groups/participantIdentityHydration';

const incompleteGroupMessage = {
  id: 7001,
  conversationId: 81,
  kind: 'incoming' as const,
  contentType: 'text',
  content: 'Mensagem real sem identidade embutida',
  createdAt: 100,
  updatedAt: null,
  status: 'sent' as const,
  sourceId: 'waha:ABCD',
  // Chatwoot serializes the group Contact as sender in the broken payload.
  senderId: 800,
  senderName: 'Equipe Operacional',
  senderPhoneNumber: null,
  senderEmail: null,
  senderAvatarUrl: null,
  origin: null,
  attachments: [],
  contentAttributes: {
    whatsapp_chat_type: 'group',
    whatsapp_transport: 'waha',
    whatsapp_remote_jid: '120363000000000@g.us',
    whatsapp_participant_jid: '19696904601705@lid',
  },
};

const resolvedParticipant = {
  jid: '19696904601705@lid',
  lid: '19696904601705',
  phoneJid: '554497755329@c.us',
  phoneNumber: '+554497755329',
  displayName: 'Maria Silva',
  avatarUrl: 'https://example.test/maria.jpg',
  contactId: 91,
};
const realtimeIncompleteMessage = {
  ...incompleteGroupMessage,
  id: 7002,
  sourceId: 'waha:EFGH',
  senderName: 'Equipe Operacional',
  contentAttributes: { ...incompleteGroupMessage.contentAttributes, whatsapp_participant_jid: '456@lid' },
};
const realtimeResolvedParticipant = {
  jid: '456@lid', lid: '456', phoneJid: '5511988888888@c.us', phoneNumber: '+5511988888888',
  displayName: 'João Souza', avatarUrl: 'https://example.test/joao.jpg', contactId: 92,
};

let container: HTMLDivElement;
let root: Root;
let backgroundParticipants: Array<typeof resolvedParticipant>;

const Harness = () => {
  const history = useConversationMessages(1, 81, 5);
  const sender = history.messages[0];
  const realtimeSender = history.messages.find(message => message.id === 7002);
  return <>
    <output data-testid="sender">{sender ? JSON.stringify({ id: sender.senderId, name: sender.senderName, phone: sender.senderPhoneNumber, avatar: sender.senderAvatarUrl }) : history.status}</output>
    <output data-testid="realtime-sender">{realtimeSender ? JSON.stringify({ id: realtimeSender.senderId, name: realtimeSender.senderName, phone: realtimeSender.senderPhoneNumber, avatar: realtimeSender.senderAvatarUrl }) : ''}</output>
    <button type="button" onClick={() => history.enrichParticipants([resolvedParticipant])}>Abrir Dados do grupo</button>
    <button type="button" onClick={() => history.upsertRealtimeMessage(realtimeIncompleteMessage)}>Receber realtime</button>
  </>;
};

describe('group participant identity bootstrap', () => {
  beforeEach(async () => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    await messageHistoryCache.clear();
    groupParticipantIdentityClient.clear();
    backgroundParticipants = [];
    authSession.set({ accessToken: 'token', tokenType: 'Bearer', client: 'client', expiry: '9999999999', uid: 'agent@example.test' });
    vi.spyOn(messageService, 'list').mockResolvedValue({ messages: [incompleteGroupMessage], hasOlderMessages: false });
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.includes('/groups/participant-identities')) return new Response(JSON.stringify({ participants: backgroundParticipants }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ error: 'unexpected request' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }));
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    authSession.clear();
    await messageHistoryCache.clear();
  });

  it('reproduz o side-effect antigo: permanece incorreto até abrir Dados do grupo', async () => {
    await act(async () => { root.render(<Harness />); });
    expect(container.querySelector('[data-testid="sender"]')?.textContent).toContain('Equipe Operacional');

    await act(async () => { (container.querySelector('button') as HTMLButtonElement).click(); });
    expect(container.querySelector('[data-testid="sender"]')?.textContent).toBe(JSON.stringify({ id: 91, name: 'Maria Silva', phone: '+554497755329', avatar: 'https://example.test/maria.jpg' }));
  });

  it('resolve nome e foto em background sem abrir Dados do grupo', async () => {
    backgroundParticipants = [resolvedParticipant];
    await act(async () => { root.render(<Harness />); });
    await act(async () => { await new Promise(resolve => window.setTimeout(resolve, 10)); });

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain('/groups/participant-identities');
    expect(container.querySelector('[data-testid="sender"]')?.textContent).toBe(JSON.stringify({ id: 91, name: 'Maria Silva', phone: '+554497755329', avatar: 'https://example.test/maria.jpg' }));
    expect(messageService.list).toHaveBeenCalledOnce();
  });

  it('reutiliza cache na reabertura e resolve somente o novo autor do realtime', async () => {
    backgroundParticipants = [resolvedParticipant];
    await act(async () => { root.render(<Harness />); await new Promise(resolve => window.setTimeout(resolve, 10)); });
    vi.mocked(fetch).mockClear();

    await act(async () => { root.render(null); });
    await act(async () => { root.render(<Harness />); await new Promise(resolve => window.setTimeout(resolve, 10)); });
    expect(container.querySelector('[data-testid="sender"]')?.textContent).toContain('Maria Silva');
    expect(fetch).not.toHaveBeenCalled();

    backgroundParticipants = [realtimeResolvedParticipant];
    const realtimeButton = [...container.querySelectorAll('button')].find(button => button.textContent === 'Receber realtime')!;
    await act(async () => { realtimeButton.click(); await new Promise(resolve => window.setTimeout(resolve, 10)); });
    expect(container.querySelector('[data-testid="realtime-sender"]')?.textContent).toBe(JSON.stringify({ id: 92, name: 'João Souza', phone: '+5511988888888', avatar: 'https://example.test/joao.jpg' }));
    expect(fetch).toHaveBeenCalledOnce();
    const request = JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body));
    expect(request.identifiers).toEqual([{ contactId: 800, aliases: ['456@lid'] }]);
  });
});
