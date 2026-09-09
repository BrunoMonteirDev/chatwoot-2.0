// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NewGroupModal } from './NewGroupModal';
import { groupCreationClient } from '../features/groups/creation';

vi.mock('../features/groups/creation', () => ({ groupCreationClient: { listInboxes: vi.fn(), searchContacts: vi.fn(), createContact: vi.fn(), create: vi.fn(), retryInvitations: vi.fn() } }));
let container: HTMLDivElement; let root: Root;
const button = (text: string) => Array.from(container.querySelectorAll('button')).find(item => item.textContent?.includes(text));
describe('Criar Novo Grupo', () => {
  beforeEach(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; vi.mocked(groupCreationClient.listInboxes).mockResolvedValue({ inboxes: [{ id: 5, name: 'Kopla WhatsApp', transport: 'waha' }] }); vi.mocked(groupCreationClient.searchContacts).mockResolvedValue({ contacts: [] }); container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.useRealTimers(); vi.clearAllMocks(); });
  const render = async () => { await act(async () => root.render(<NewGroupModal accountId={1} onClose={() => {}}/>)); };
  it('usa Convidar como padrão e mostra somente o nome real da inbox', async () => { await render(); expect(button('Criar grupo e enviar convites')).toBeTruthy(); expect(container.textContent).toContain('Kopla WhatsApp'); expect(container.textContent).not.toContain('Baileys'); });
  it('exige confirmação contextual para adicionar diretamente', async () => { await render(); const name = container.querySelector<HTMLInputElement>('input[required]')!; await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(name, 'Equipe'); name.dispatchEvent(new Event('input', { bubbles: true })); button('Adicionar diretamente')?.click(); }); expect(container.textContent).toContain('Entendo o risco e quero continuar'); expect(button('Criar grupo e adicionar participantes')?.hasAttribute('disabled')).toBe(true); await act(async () => button('Entendo o risco')?.click()); expect(button('Criar grupo e adicionar participantes')?.hasAttribute('disabled')).toBe(false); });
  it('mostra o estado vazio quando não há inbox elegível', async () => { vi.mocked(groupCreationClient.listInboxes).mockResolvedValue({ inboxes: [] }); await render(); expect(container.textContent).toContain('Nenhuma caixa de entrada com suporte a grupos está conectada.'); });
  it('não duplica um contato selecionado', async () => { vi.useFakeTimers(); vi.mocked(groupCreationClient.searchContacts).mockResolvedValue({ contacts: [{ id: 8, name: 'Ana', phoneNumber: '+5544988687221', avatarUrl: null }] }); await render(); const input = container.querySelector<HTMLInputElement>('input[placeholder="Nome ou telefone"]')!; await act(async () => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!; setter.call(input, '88687221'); input.dispatchEvent(new Event('input', { bubbles: true })); await vi.advanceTimersByTimeAsync(300); }); const result = button('Ana'); expect(result).toBeTruthy(); await act(async () => { result?.click(); result?.click(); }); expect(container.textContent).toContain('Participantes selecionados (1)'); });
  it('fecha e entrega conversationId assim que created=true, sem permitir criação duplicada', async () => {
    const onClose = vi.fn(); const onCreated = vi.fn();
    vi.mocked(groupCreationClient.create).mockResolvedValue({ created: true, creationRequestId: 'request-123', conversationId: 91, groupId: '1@g.us', groupJid: '1@g.us', inbox: { id: 5, name: 'Kopla WhatsApp' }, provider: { transport: 'waha', session: 'session-5' }, inviteStatus: 'complete', results: [], warnings: [] });
    await act(async () => root.render(<NewGroupModal accountId={1} onClose={onClose} onCreated={onCreated}/>));
    const name = container.querySelector<HTMLInputElement>('input[required]')!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(name, 'Equipe'); name.dispatchEvent(new Event('input', { bubbles: true })); });
    await act(async () => { button('Criar grupo e enviar convites')?.click(); button('Criar grupo e enviar convites')?.click(); });
    expect(groupCreationClient.create).toHaveBeenCalledTimes(1); expect(vi.mocked(groupCreationClient.create).mock.calls[0][0].creationRequestId.length).toBeGreaterThanOrEqual(8); expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ created: true, conversationId: 91 })); expect(onClose).toHaveBeenCalled();
  });
  it('cria contato rápido e o seleciona sem sair do modal', async () => {
    vi.useFakeTimers(); vi.mocked(groupCreationClient.createContact).mockResolvedValue({ contact: { id: 88, name: 'Novo', phoneNumber: '+5544999999999', avatarUrl: null }, existing: false }); await render();
    const search = container.querySelector<HTMLInputElement>('input[placeholder="Nome ou telefone"]')!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, '+55 44 99999-9999'); search.dispatchEvent(new Event('input', { bubbles: true })); await vi.advanceTimersByTimeAsync(300); });
    await act(async () => button('+ Criar contato')?.click()); const name = Array.from(container.querySelectorAll('input')).at(-1)!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(name, 'Novo'); name.dispatchEvent(new Event('input', { bubbles: true })); });
    await act(async () => button('Criar e selecionar')?.click());
    expect(groupCreationClient.createContact).toHaveBeenCalledWith({ accountId: 1, name: 'Novo', phoneNumber: '+5544999999999' }); expect(container.textContent).toContain('Participantes selecionados (1)');
  });
  it('fecha e navega pelo mesmo callback após criação direta confirmada', async () => {
    const onClose = vi.fn(); const onCreated = vi.fn(); vi.mocked(groupCreationClient.create).mockResolvedValue({ created: true, creationRequestId: 'direct-123', conversationId: 92, groupId: '2@g.us', groupJid: '2@g.us', inbox: { id: 5, name: 'Kopla WhatsApp' }, provider: { transport: 'waha', session: 'session-5' }, inviteStatus: 'not_requested', results: [{ contactId: 8, ok: true }], warnings: [] });
    await act(async () => root.render(<NewGroupModal accountId={1} onClose={onClose} onCreated={onCreated}/>)); const name = container.querySelector<HTMLInputElement>('input[required]')!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(name, 'Direto'); name.dispatchEvent(new Event('input', { bubbles: true })); button('Adicionar diretamente')?.click(); });
    await act(async () => button('Entendo o risco')?.click()); await act(async () => button('Criar grupo e adicionar participantes')?.click());
    expect(groupCreationClient.create).toHaveBeenCalledWith(expect.objectContaining({ mode: 'direct' })); expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({ conversationId: 92 })); expect(onClose).toHaveBeenCalled();
  });
});
