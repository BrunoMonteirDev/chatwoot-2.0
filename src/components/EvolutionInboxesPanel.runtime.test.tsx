// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EvolutionInboxesPanel } from './EvolutionInboxesPanel';
import { inboxService } from '../integrations/chatwoot/inboxes';
import { wahaClient } from '../integrations/waha/client';
import { loadRuntimeConfig, resetRuntimeConfigForTests } from '../config/runtime';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  resetRuntimeConfigForTests();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('WAHA inbox creation with runtime bridge configuration', () => {
  it('creates the inbox and advances to WAHA without any build-time bridge variable', async () => {
    await loadRuntimeConfig(vi.fn().mockResolvedValue(new Response(JSON.stringify({
      bridgePublicUrl: '/bridge',
      chatwootWebhookUrl: 'http://bridge:3100/webhooks/chatwoot',
    }), { status: 200 })));
    const created = { id: 701, name: 'Synthetic WAHA', avatarUrl: null, channelType: 'Channel::Api', channelId: 701, webhookUrl: null, inboxIdentifier: 'synthetic-701', additionalAttributes: {} };
    vi.spyOn(inboxService, 'createWhatsAppApiInbox').mockResolvedValue(created);
    const session = { name: 'synthetic-session', status: 'STOPPED', connectionStatus: 'disconnected' as const, engine: 'GOWS' };
    vi.spyOn(wahaClient, 'listSessions').mockResolvedValueOnce({ sessions: [] }).mockResolvedValue({ sessions: [session] });
    vi.spyOn(wahaClient, 'createSession').mockResolvedValue({ session });
    vi.spyOn(wahaClient, 'getQrCode').mockResolvedValue({ mimetype: 'image/png', data: 'c3ludGhldGljLXFy' });
    vi.spyOn(wahaClient, 'getCurrentHistoryImport').mockResolvedValue({ job: null, running: false });
    const onOpenInbox = vi.fn(); const onRefresh = vi.fn();
    const element = document.createElement('div'); document.body.append(element); const root = createRoot(element);
    const props = { accountId: 47, inboxes: [], inboxesStatus: 'ready' as const, inboxesError: null, onRefresh, isDarkMode: true, onOpenInbox };

    await act(async () => { root.render(<EvolutionInboxesPanel {...props} />); });
    await act(async () => { (Array.from(element.querySelectorAll('button')).find(button => button.textContent?.includes('Adicionar caixa')) as HTMLButtonElement).click(); });
    await act(async () => { (Array.from(element.querySelectorAll('button')).find(button => button.textContent?.includes('API não oficial')) as HTMLButtonElement).click(); });
    const input = element.querySelector('input[placeholder="Ex.: WhatsApp Vendas"]') as HTMLInputElement;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Synthetic WAHA'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    await act(async () => { (Array.from(element.querySelectorAll('button')).find(button => button.textContent?.includes('Continuar para conectar WAHA')) as HTMLButtonElement).click(); });

    expect(inboxService.createWhatsAppApiInbox).toHaveBeenCalledWith(47, { name: 'Synthetic WAHA' });
    expect(onOpenInbox).toHaveBeenCalledWith(701);
    expect(element.textContent).not.toContain('Configure antes de conectar');

    await act(async () => { root.render(<EvolutionInboxesPanel {...props} inboxes={[created]} selectedInboxId={701} />); });
    expect(element.textContent).toContain('Configurações da caixa de entrada');
    expect(element.textContent).toContain('WhatsApp não oficial');
    await act(async () => { (Array.from(element.querySelectorAll('button')).find(button => button.textContent === 'WhatsApp não oficial') as HTMLButtonElement).click(); });
    const sessionInput = element.querySelector('input[placeholder="Ex.: WhatsApp-Vendas"]') as HTMLInputElement;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(sessionInput, 'synthetic-session'); sessionInput.dispatchEvent(new Event('input', { bubbles: true })); });
    await act(async () => { (Array.from(element.querySelectorAll('button')).find(button => button.textContent === 'Criar conexão') as HTMLButtonElement).click(); });
    expect(wahaClient.createSession).toHaveBeenCalledWith({ accountId: 47, inboxId: 701 }, 'synthetic-session');
    await act(async () => { (Array.from(element.querySelectorAll('button')).find(button => button.textContent?.includes('Mostrar QR Code')) as HTMLButtonElement).click(); });
    expect(wahaClient.getQrCode).toHaveBeenCalledWith({ accountId: 47, inboxId: 701 }, 'synthetic-session');
    expect(element.querySelector('img[alt="QR Code do WhatsApp"]')).not.toBeNull();
    await act(async () => root.unmount());
  });
});
