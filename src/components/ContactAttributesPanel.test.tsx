// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContactAttributesPanel } from './ContactAttributesPanel';
import { groupMetadataClient } from '../features/groups/metadata';
import type { Chat } from '../types';
import type { WhatsAppTransport } from '../integrations/whatsapp/provider';
import { contactService } from '../integrations/chatwoot/contacts';

const get = vi.spyOn(groupMetadataClient, 'get');
let container: HTMLDivElement;
let root: Root;
const render = async (isGroup: boolean, transport: WhatsAppTransport = 'waha', conversationId = 91) => {
  const chat: Chat = { id: String(conversationId), name: 'Contact', avatar: '', lastMessage: '', time: '', messages: [], isGroup };
  await act(async () => { root.render(<ContactAttributesPanel chat={chat} accountId={1} inboxId={5} conversationId={conversationId} groupTransport={transport} isDarkMode onClose={() => {}} />); });
};

describe('group metadata requests', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    get.mockReset().mockResolvedValue({ group: { id: '123@g.us', subject: 'Real group', transport: 'waha', participants: [], canEditDescription: true } });
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  it.each(['meta_cloud', 'waha'] as const)('never requests metadata for private %s, including rerenders', async transport => {
    await render(false, transport); await render(false, transport);
    expect(get).not.toHaveBeenCalled();
  });
  it('loads a real group normally and clears group data when switching to private', async () => {
    await render(true);
    expect(get).toHaveBeenCalledExactlyOnceWith(1, 5, 91, 'waha');
    expect(container.textContent).toContain('Real group');
    await render(false, 'meta_cloud', 92);
    expect(get).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain('Real group');
  });
  it('does not retry failed group metadata on rerender', async () => {
    get.mockRejectedValue(new Error('Provider unavailable'));
    await render(true); await render(true); await render(true);
    expect(get).toHaveBeenCalledTimes(1);
  });
  it('renders group identity, description and the canonical participant count from one metadata response', async () => {
    get.mockResolvedValue({ group: { id: '123@g.us', subject: 'Nome atualizado', avatarUrl: 'https://example.test/group.jpg', description: 'Descrição atualizada', memberCount: 5, transport: 'waha', canEditDescription: true, participants: [{ jid: '1@lid', displayName: 'Maria', avatarUrl: 'https://example.test/maria.jpg', admin: 'superadmin' }] } });
    await render(true);
    expect(container.textContent).toContain('Nome atualizado');
    expect(container.textContent).toContain('Descrição atualizada');
    expect(container.textContent).toContain('5 membros');
    expect(container.textContent).toContain('Maria');
    expect(container.textContent).toContain('Superadministrador');
    expect(container.querySelector<HTMLImageElement>('img[alt="Nome atualizado"]')?.src).toBe('https://example.test/group.jpg');
  });
  it('mostra participantes persistidos imediatamente e reutiliza o contato nas ações', async () => {
    get.mockReturnValue(new Promise(() => {}));
    vi.spyOn(contactService, 'get').mockResolvedValue({ id: 44, name: 'João editado', avatarUrl: null, phoneNumber: '+5544999999999', email: null, identifier: null, companyName: null, city: null, country: null, blocked: false, lastActivityAt: null, createdAt: null, additionalAttributes: {}, customAttributes: {} });
    vi.spyOn(contactService, 'listNotes').mockResolvedValue([]);
    const start = vi.fn();
    const chat: Chat = { id: '81', name: 'Equipe', avatar: '', lastMessage: '', time: '', messages: [], isGroup: true };
    const initialGroupMetadata = { id: '120@g.us', subject: 'Equipe', transport: 'waha' as const, canEditDescription: true, memberCount: 1, participants: [{ jid: '123@lid', phoneNumber: '+5544999999999', displayName: 'João editado', contactId: 44, admin: 'admin' }] };
    await act(async () => { root.render(<ContactAttributesPanel chat={chat} accountId={1} inboxId={5} conversationId={81} groupTransport="waha" initialGroupMetadata={initialGroupMetadata} onStartParticipantConversation={start} isDarkMode onClose={() => {}} />); });
    expect(container.textContent).toContain('João editado');
    expect(container.textContent).toContain('Administrador');
    await act(async () => { Array.from(container.querySelectorAll('div')).find(element => element.textContent?.includes('João editado') && element.className.includes('cursor-pointer'))?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await act(async () => {});
    const button = Array.from(container.querySelectorAll('button')).find(element => element.textContent?.includes('Iniciar conversa'));
    expect(button).toBeTruthy();
    await act(async () => { button?.click(); });
    expect(start).toHaveBeenCalledWith(44);
  });
});
