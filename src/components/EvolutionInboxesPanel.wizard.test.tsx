// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadRuntimeConfig, resetRuntimeConfigForTests } from '../config/runtime';
import type { Inbox } from '../domain/currentUser';
import { inboxService } from '../integrations/chatwoot/inboxes';
import { EvolutionInboxesPanel } from './EvolutionInboxesPanel';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const syntheticInbox: Inbox = {
  id: 941,
  name: 'Synthetic Routing Inbox',
  avatarUrl: null,
  channelType: 'Channel::Api',
  channelId: 941,
  webhookUrl: null,
  inboxIdentifier: 'synthetic-routing-941',
  additionalAttributes: { whatsapp_transports: ['waha'] },
};

const buttonWithText = (element: HTMLElement, text: string) => {
  const button = Array.from(element.querySelectorAll('button')).find(item => item.textContent?.includes(text));
  if (!button) throw new Error(`Button not found: ${text}`);
  return button as HTMLButtonElement;
};

describe('route-owned inbox creation wizard', () => {
  let element: HTMLDivElement;
  let root: Root;
  const onNavigateInboxCreation = vi.fn();
  const baseProps = {
    accountId: 64,
    inboxes: [] as Inbox[],
    inboxesStatus: 'ready' as const,
    inboxesError: null,
    onRefresh: vi.fn(),
    isDarkMode: true,
    onNavigateInboxCreation,
  };

  beforeEach(async () => {
    element = document.createElement('div');
    document.body.append(element);
    root = createRoot(element);
    await loadRuntimeConfig(vi.fn().mockResolvedValue(new Response(JSON.stringify({
      bridgePublicUrl: '/bridge',
      chatwootWebhookUrl: 'http://bridge:3100/webhooks/chatwoot',
    }), { status: 200 })));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    resetRuntimeConfigForTests();
    vi.restoreAllMocks();
    onNavigateInboxCreation.mockReset();
    baseProps.onRefresh.mockReset();
    document.body.replaceChildren();
  });

  it('/new abre a escolha de canal e avança alterando a rota', async () => {
    await act(async () => root.render(<EvolutionInboxesPanel {...baseProps} inboxCreationRoute={{ step: 'channel' }} />));
    expect(element.textContent).toContain('Configure uma conexão oficial, não oficial ou coexistente.');

    await act(async () => buttonWithText(element, 'WhatsApp').click());
    expect(onNavigateInboxCreation).toHaveBeenCalledWith({ step: 'whatsapp' });
  });

  it('provider=waha e provider=meta abrem somente a configuração correspondente', async () => {
    await act(async () => root.render(<EvolutionInboxesPanel {...baseProps} inboxCreationRoute={{ step: 'whatsapp', provider: 'waha' }} />));
    expect(element.textContent).toContain('Criar caixa e adicionar agentes');
    expect(element.textContent).not.toContain('Conectar WhatsApp Business');

    await act(async () => root.render(<EvolutionInboxesPanel {...baseProps} inboxCreationRoute={{ step: 'whatsapp', provider: 'meta' }} />));
    expect(element.textContent).toContain('API oficial do WhatsApp');
    expect(element.textContent).toContain('Conectar WhatsApp Business');
    expect(element.textContent).not.toContain('Criar caixa e adicionar agentes');
  });

  it('troca o provider por navegação, sem estado local de tela', async () => {
    await act(async () => root.render(<EvolutionInboxesPanel {...baseProps} inboxCreationRoute={{ step: 'whatsapp' }} />));
    await act(async () => buttonWithText(element, 'WhatsApp não oficial').click());
    expect(onNavigateInboxCreation).toHaveBeenCalledWith({ step: 'whatsapp', provider: 'waha' });

    onNavigateInboxCreation.mockClear();
    await act(async () => buttonWithText(element, 'WhatsApp oficial').click());
    expect(onNavigateInboxCreation).toHaveBeenCalledWith({ step: 'whatsapp', provider: 'meta' });
  });

  it('usa o inboxId real retornado pela criação e navega para agentes', async () => {
    vi.spyOn(inboxService, 'createWhatsAppApiInbox').mockResolvedValue(syntheticInbox);
    await act(async () => root.render(<EvolutionInboxesPanel {...baseProps} inboxCreationRoute={{ step: 'whatsapp', provider: 'waha' }} />));
    const input = element.querySelector('input[placeholder="Ex.: WhatsApp Vendas"]') as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, syntheticInbox.name);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => { buttonWithText(element, 'Criar caixa e adicionar agentes').click(); await Promise.resolve(); });

    expect(inboxService.createWhatsAppApiInbox).toHaveBeenCalledWith(64, { name: syntheticInbox.name });
    expect(onNavigateInboxCreation).toHaveBeenCalledWith({ step: 'agents', inboxId: '941' });
  });

  it('abre agentes somente para uma inbox existente da conta e corrige id inválido', async () => {
    vi.spyOn(inboxService, 'listAgents').mockResolvedValue([]);
    vi.spyOn(inboxService, 'listMembers').mockResolvedValue([]);
    await act(async () => root.render(<EvolutionInboxesPanel {...baseProps} inboxes={[syntheticInbox]} inboxCreationRoute={{ step: 'agents', inboxId: '941' }} />));
    expect(element.textContent).toContain('Adicionar agentes');
    expect(element.textContent).toContain(syntheticInbox.name);

    await act(async () => root.render(<EvolutionInboxesPanel {...baseProps} inboxes={[syntheticInbox]} inboxCreationRoute={{ step: 'agents', inboxId: '999' }} />));
    expect(onNavigateInboxCreation).toHaveBeenCalledWith({ step: 'channel' }, true);
    expect(element.textContent).not.toContain('Defina quem poderá atender pela caixa');
  });

  it('não reutiliza dados transitórios do wizard ao trocar de account', async () => {
    await act(async () => root.render(<EvolutionInboxesPanel {...baseProps} inboxCreationRoute={{ step: 'whatsapp', provider: 'waha' }} />));
    const firstInput = element.querySelector('input[placeholder="Ex.: WhatsApp Vendas"]') as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(firstInput, 'Transient Account Data');
      firstInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(firstInput.value).toBe('Transient Account Data');

    await act(async () => root.render(<EvolutionInboxesPanel {...baseProps} accountId={65} inboxCreationRoute={{ step: 'whatsapp', provider: 'waha' }} />));
    expect((element.querySelector('input[placeholder="Ex.: WhatsApp Vendas"]') as HTMLInputElement).value).toBe('');
  });
});
