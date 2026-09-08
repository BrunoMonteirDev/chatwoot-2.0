// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MetaTemplatePicker } from './MetaTemplatePicker';
import { metaTemplateService, type WhatsAppTemplate } from '../integrations/whatsapp/templates';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root; let container: HTMLDivElement;
const approved: WhatsAppTemplate = { id: '1', name: 'pedido_pronto', language: 'pt_BR', category: 'UTILITY', status: 'APPROVED', quality: 'GREEN', components: [{ type: 'BODY', text: 'Olá, seu pedido está pronto.' }, { type: 'FOOTER', text: 'Equipe Kopla' }, { type: 'BUTTONS', buttons: [{ type: 'QUICK_REPLY', text: 'Confirmar' }] }], updatedAt: null };
const pending: WhatsAppTemplate = { ...approved, id: '2', name: 'rascunho', status: 'PENDING' };

describe('MetaTemplatePicker', () => {
  beforeEach(() => { container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); });

  it('lists only approved native templates with category, preview and buttons, then sends the selection', async () => {
    vi.spyOn(metaTemplateService, 'listNative').mockResolvedValue([approved, pending]);
    const send = vi.spyOn(metaTemplateService, 'sendNative').mockResolvedValue({});
    const close = vi.fn();
    await act(async () => { root.render(<MetaTemplatePicker accountId={1} inboxId={5} conversationId={91} native onClose={close} />); await Promise.resolve(); await Promise.resolve(); });
    expect(container.textContent).toContain('pedido_pronto'); expect(container.textContent).toContain('Utilidade'); expect(container.textContent).toContain('Olá, seu pedido está pronto.'); expect(container.textContent).toContain('Possui botões'); expect(container.textContent).not.toContain('rascunho');
    await act(async () => { [...container.querySelectorAll('button')].find(button => button.textContent?.includes('pedido_pronto'))?.click(); });
    expect(container.textContent).toContain('Equipe Kopla'); expect(container.textContent).toContain('[QUICK_REPLY] Confirmar');
    await act(async () => { [...container.querySelectorAll('button')].find(button => button.textContent === 'Enviar template')?.click(); await Promise.resolve(); });
    expect(send).toHaveBeenCalledWith(1, 91, expect.objectContaining({ name: 'pedido_pronto', language: 'pt_BR', category: 'UTILITY' })); expect(close).toHaveBeenCalled();
  });
});
