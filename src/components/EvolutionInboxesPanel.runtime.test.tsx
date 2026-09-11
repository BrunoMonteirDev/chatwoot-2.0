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
    vi.spyOn(wahaClient, 'getInboxConnection').mockResolvedValue({ connection: null });
    vi.spyOn(wahaClient, 'connectInbox').mockResolvedValue({ connection: { status: 'SCAN', connectionStatus: 'connecting' }, qr: { mimetype: 'image/png', data: 'c3ludGhldGljLXFy' } });
    const onOpenInbox = vi.fn(); const onRefresh = vi.fn(); const onNavigateInboxCreation = vi.fn();
    const element = document.createElement('div'); document.body.append(element); const root = createRoot(element);
    const props = { accountId: 47, inboxes: [], inboxesStatus: 'ready' as const, inboxesError: null, onRefresh, isDarkMode: true, onOpenInbox, onNavigateInboxCreation };

    await act(async () => { root.render(<EvolutionInboxesPanel {...props} inboxCreationRoute={{ step: 'whatsapp', provider: 'waha' }} />); });
    const input = element.querySelector('input[placeholder="Ex.: WhatsApp Vendas"]') as HTMLInputElement;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Synthetic WAHA'); input.dispatchEvent(new Event('input', { bubbles: true })); });
    await act(async () => { (Array.from(element.querySelectorAll('button')).find(button => button.textContent?.includes('Criar caixa e adicionar agentes')) as HTMLButtonElement).click(); });

    expect(inboxService.createWhatsAppApiInbox).toHaveBeenCalledWith(47, { name: 'Synthetic WAHA' });
    expect(onNavigateInboxCreation).toHaveBeenCalledWith({ step: 'agents', inboxId: '701' });
    expect(element.textContent).not.toContain('Configure antes de conectar');

    await act(async () => { root.render(<EvolutionInboxesPanel {...props} inboxes={[created]} selectedInboxId={701} inboxCreationRoute={null} />); });
    expect(element.textContent).toContain('WhatsApp não conectado');
    expect(element.textContent).not.toMatch(/WhatsApp oficial|Nome da sessão|Criar conexão/);
    await act(async () => { (Array.from(element.querySelectorAll('button')).find(button => button.textContent === 'Conectar por QR Code') as HTMLButtonElement).click(); });
    expect(wahaClient.connectInbox).toHaveBeenCalledWith({ accountId: 47, inboxId: 701 });
    expect(element.querySelector('img[alt="QR Code do WhatsApp"]')).not.toBeNull();
    await act(async () => root.unmount());
  });
});
