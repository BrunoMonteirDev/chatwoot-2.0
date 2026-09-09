// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Chat } from '../types';
import { ChatArea } from './ChatArea';

const chat: Chat = { id: '81', name: 'Ana', avatar: '', lastMessage: '', time: '', messages: [], isGroup: false };
let container: HTMLDivElement;
let root: Root;

const renderComposer = async () => act(async () => {
  root.render(<ChatArea chat={chat} onSendMessage={vi.fn()} onImageClick={vi.fn()} onSearchInChat={vi.fn()} />);
});

const input = (value: string) => act(() => {
  const textarea = container.querySelector('textarea[placeholder="Mensagem"]') as HTMLTextAreaElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  setter?.call(textarea, value);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
});

describe('ChatArea desktop composer', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Element.prototype.scrollIntoView = vi.fn();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('alterna o único botão externo entre áudio e enviar conforme o conteúdo', async () => {
    await renderComposer();
    expect(container.querySelector('button[title="Gravar áudio"]')).toBeTruthy();
    await input('Olá');
    expect(container.querySelector('button[title="Enviar mensagem"]')).toBeTruthy();
    expect(container.querySelector('button[title="Gravar áudio"]')).toBeNull();
    await input('');
    expect(container.querySelector('button[title="Gravar áudio"]')).toBeTruthy();
  });

  it('mantém anexo preparado e troca áudio por enviar sem upload imediato', async () => {
    const onSendMessage = vi.fn();
    await act(async () => root.render(<ChatArea chat={chat} onSendMessage={onSendMessage} onImageClick={vi.fn()} onSearchInChat={vi.fn()} />));
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [new File(['x'], 'arquivo.pdf', { type: 'application/pdf' })] });
    await act(async () => fileInput.dispatchEvent(new Event('change', { bubbles: true })));
    expect(container.textContent).toContain('arquivo.pdf');
    expect(container.querySelector('button[title="Enviar mensagem"]')).toBeTruthy();
    expect(onSendMessage).not.toHaveBeenCalled();
  });

  it('alterna público/privado no controle interno e mantém o cadeado dentro do campo', async () => {
    await renderComposer();
    const publicControl = container.querySelector('button[aria-label="Responder"]') as HTMLButtonElement;
    expect(publicControl).toBeTruthy();
    await act(async () => publicControl.click());
    expect(container.querySelector('button[aria-label="Mensagem privada"]')).toBeTruthy();
    expect(container.querySelector('textarea[placeholder="Mensagem privada"]')).toBeTruthy();
    await act(async () => (container.querySelector('button[aria-label="Mensagem privada"]') as HTMLButtonElement).click());
    expect(container.querySelector('textarea[placeholder="Mensagem"]')).toBeTruthy();
  });

  it('abre formatação apenas com seleção, aplica no trecho e fecha ao clicar fora', async () => {
    await renderComposer();
    await input('muito importante');
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    textarea.setSelectionRange(0, 5);
    await act(async () => textarea.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })));
    expect(container.querySelector('[role="toolbar"][aria-label="Formatar texto selecionado"]')).toBeTruthy();
    await act(async () => (container.querySelector('button[aria-label="Negrito"]') as HTMLButtonElement).click());
    expect(textarea.value).toBe('*muito* importante');
    expect(container.querySelector('[role="toolbar"][aria-label="Formatar texto selecionado"]')).toBeNull();

    textarea.setSelectionRange(8, 18);
    await act(async () => textarea.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })));
    await act(async () => document.dispatchEvent(new Event('pointerdown')));
    expect(container.querySelector('[role="toolbar"][aria-label="Formatar texto selecionado"]')).toBeNull();
  });

  it('preserva os controles mobile no ramo md:hidden', async () => {
    await renderComposer();
    const mobileMode = container.querySelector('button[title="Trocar para nota privada"]');
    expect(mobileMode?.className).toContain('md:hidden');
  });

  it('mantém cápsula e áudio/enviar na mesma linha desktop sem ocupar a página', async () => {
    await renderComposer();
    const row = container.querySelector('[data-testid="desktop-composer-row"]');
    const capsule = container.querySelector('[data-testid="composer-capsule"]');
    expect(row?.className).toContain('md:flex-wrap');
    expect(row?.className).not.toContain('md:block');
    expect(capsule?.className).toContain('flex-1');
    expect(row?.contains(container.querySelector('button[title="Gravar áudio"]'))).toBe(true);
  });
});
