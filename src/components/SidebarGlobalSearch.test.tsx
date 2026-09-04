// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SidebarGlobalSearch } from './SidebarGlobalSearch';
import { sidebarSearchService } from '../features/search/sidebarSearch';

const search = vi.spyOn(sidebarSearchService, 'search');
let container: HTMLDivElement;
let root: Root;
const render = (props: Partial<React.ComponentProps<typeof SidebarGlobalSearch>> = {}) => act(() => root.render(<SidebarGlobalSearch accountId={1} isDarkMode onClose={vi.fn()} onOpenConversation={vi.fn()} onOpenContacts={vi.fn()} {...props} />));
const input = () => container.querySelector('input')!;
const changeQuery = async (value: string) => {
  const field = input();
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(field, value);
  await act(async () => { field.dispatchEvent(new Event('input', { bubbles: true })); });
};

describe('SidebarGlobalSearch', () => {
  beforeEach(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; vi.useFakeTimers(); container = document.createElement('div'); document.body.append(container); root = createRoot(container); search.mockReset(); });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.useRealTimers(); });

  it('opens safely, waits 300ms, groups contacts/conversations and navigates only after click', async () => {
    const openConversation = vi.fn(); const openContacts = vi.fn();
    search.mockResolvedValue({ conversations: [{ id: 7, name: 'João', inbox: 'Comercial', summary: 'Olá' }], contacts: [{ id: 2, name: 'Maria', phoneNumber: '+55 (44) 99999-0000' }] });
    render({ onOpenConversation: openConversation, onOpenContacts: openContacts });
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    await changeQuery('jo');
    await act(async () => { await vi.advanceTimersByTimeAsync(299); }); expect(search).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(search).toHaveBeenCalledWith(1, 'jo', expect.any(AbortSignal));
    expect(container.textContent).toContain('Conversas'); expect(container.textContent).toContain('Contatos'); expect(container.textContent).toContain('+55 (44) 99999-0000');
    const buttons = [...container.querySelectorAll('button')];
    await act(async () => { buttons.find(button => button.textContent?.includes('João'))?.click(); }); expect(openConversation).toHaveBeenCalledWith(7);
    await act(async () => { buttons.find(button => button.textContent?.includes('Maria'))?.click(); }); expect(openContacts).toHaveBeenCalledOnce();
  });

  it('does not request short queries and clears old results on account switch', async () => {
    search.mockResolvedValue({ conversations: [], contacts: [] }); render();
    await changeQuery('a'); await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(search).not.toHaveBeenCalled();
    render({ accountId: 2 });
    expect(container.textContent).toContain('Digite ao menos 2 caracteres');
  });

  it('keeps the panel open when unrelated props change and exposes empty/error states', async () => {
    search.mockResolvedValueOnce({ conversations: [], contacts: [] }); render();
    await changeQuery('zz'); await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(container.textContent).toContain('Nenhum resultado');
    search.mockRejectedValueOnce(new Error('falhou'));
    await changeQuery('erro'); await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(container.querySelector('[role="dialog"]')).not.toBeNull(); expect(container.querySelector('[role="alert"]')).not.toBeNull();
  });

  it('ignores a stale response after the query changes', async () => {
    let resolveOld: ((value: { conversations: Array<{ id: number; name: string; inbox: null; summary: null }>; contacts: [] }) => void) | undefined;
    search.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }))
      .mockResolvedValueOnce({ conversations: [{ id: 8, name: 'Atual', inbox: null, summary: null }], contacts: [] });
    render(); await changeQuery('an'); await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    await changeQuery('at'); await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(container.textContent).toContain('Atual');
    await act(async () => { resolveOld?.({ conversations: [{ id: 1, name: 'Antigo', inbox: null, summary: null }], contacts: [] }); });
    expect(container.textContent).toContain('Atual'); expect(container.textContent).not.toContain('Antigo');
  });
});
