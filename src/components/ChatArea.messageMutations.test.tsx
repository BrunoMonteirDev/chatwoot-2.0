// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Chat, Message } from '../types';
import { ChatArea } from './ChatArea';

let container: HTMLDivElement;
let root: Root;

const message = (overrides: Partial<Message> = {}): Message => ({
  id: '42', sender: 'me', text: 'Conteúdo original', time: '10:21', status: 'sent',
  sourceId: 'waha:SYNTHETIC', whatsappTransport: 'waha', whatsappRemoteJid: '5500000000001@c.us', whatsappFromMe: true,
  ...overrides,
});
const chat = (item: Message): Chat => ({ id: '81', name: 'Contato sintético', avatar: '', lastMessage: '', time: '', messages: [item], isGroup: false });
const render = async (item: Message, props: Partial<React.ComponentProps<typeof ChatArea>> = {}) => act(async () => {
  root.render(<ChatArea chat={chat(item)} onSendMessage={vi.fn()} onImageClick={vi.fn()} onSearchInChat={vi.fn()} {...props} />);
});

describe('ChatArea WhatsApp message mutations', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Element.prototype.scrollIntoView = vi.fn();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => { act(() => root.unmount()); container.remove(); });

  it('shows a durable revoked marker and expands the preserved original', async () => {
    await render(message({ isRevoked: true, whatsappPreviousContent: 'Conteúdo original' }));

    expect(container.textContent).toContain('Essa mensagem foi excluída');
    expect(container.textContent).toContain('Ver conteúdo original');
    expect(container.querySelector('details')?.textContent).toContain('Conteúdo original');
  });

  it('does not expose the Chatwoot hard-delete action', async () => {
    await render(message());
    await act(async () => container.querySelector('[id="msg-42"] > div > div')?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })));

    expect(document.body.textContent).not.toContain('Excluir do Chatwoot');
    expect(document.body.textContent).toContain('Apagar para todos');
  });

  it('keeps the message and reports the provider rejection for revoke', async () => {
    const revoke = vi.fn().mockResolvedValue(false);
    await render(message(), { onRevokeMessage: revoke });
    await act(async () => container.querySelector('[id="msg-42"] > div > div')?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })));
    const menuAction = Array.from(document.querySelectorAll('button')).find(button => button.textContent?.includes('Apagar para todos')) as HTMLButtonElement;
    await act(async () => menuAction.click());
    const confirm = Array.from(document.querySelectorAll('button')).find(button => button.textContent === 'Apagar para todos') as HTMLButtonElement;
    await act(async () => { confirm.click(); await Promise.resolve(); });

    expect(revoke).toHaveBeenCalledWith('42');
    expect(document.body.textContent).toContain('Esta mensagem não pode mais ser excluída para todos.');
    expect(container.textContent).toContain('Conteúdo original');
  });

  it('reports edit rejection without replacing the current text', async () => {
    const edit = vi.fn().mockResolvedValue(false);
    await render(message(), { onEditMessage: edit });
    await act(async () => container.querySelector('[id="msg-42"] > div > div')?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true })));
    const menuAction = Array.from(document.querySelectorAll('button')).find(button => button.textContent?.includes('Editar no WhatsApp')) as HTMLButtonElement;
    await act(async () => menuAction.click());
    const textarea = document.querySelector('textarea[aria-label="Novo conteúdo da mensagem"]') as HTMLTextAreaElement;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(textarea, 'Nova tentativa');
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const save = document.querySelector('button[aria-label="Salvar edição"]') as HTMLButtonElement;
    await act(async () => { save.click(); await Promise.resolve(); });

    expect(edit).toHaveBeenCalledWith('42', 'Nova tentativa');
    expect(document.body.textContent).toContain('Esta mensagem não pode mais ser editada.');
    expect(container.textContent).toContain('Conteúdo original');
  });
});
