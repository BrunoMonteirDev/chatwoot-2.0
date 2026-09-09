// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NewGroupModal } from './NewGroupModal';
import { groupCreationClient } from '../features/groups/creation';

vi.mock('../features/groups/creation', () => ({ groupCreationClient: { listInboxes: vi.fn(), searchContacts: vi.fn(), create: vi.fn(), retryInvitations: vi.fn() } }));
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
});
