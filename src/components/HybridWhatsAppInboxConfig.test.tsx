// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HybridWhatsAppInboxConfig } from './HybridWhatsAppInboxConfig';
import { inboxService } from '../integrations/chatwoot/inboxes';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const inbox = { id: 5, name: 'Oficial', avatarUrl: null, channelType: 'Channel::Whatsapp', channelId: 1, webhookUrl: null, inboxIdentifier: null, additionalAttributes: { meta_connection_status: 'connected' } };
const roots: Array<{ root: Root; element: HTMLDivElement }> = [];
afterEach(async () => {
  await act(async () => { roots.splice(0).forEach(({ root, element }) => { root.unmount(); element.remove(); }); });
  vi.restoreAllMocks();
});

const render = async (configuration: { hybridEnabled: boolean; outOfWindowStrategy: 'template' | 'waha'; metaFailureStrategy: 'block' | 'waha' }, binding: { wahaSession: string | null; wahaStatus: 'connected' | 'disconnected' | 'not_bound' }) => {
  vi.spyOn(inboxService, 'hybridWahaConfiguration').mockResolvedValue({ ...configuration, wahaSession: binding.wahaSession });
  vi.spyOn(inboxService, 'hybridWahaBinding').mockResolvedValue({ hybridEnabled: configuration.hybridEnabled, ...binding });
  vi.spyOn(inboxService, 'listHybridWahaSessions').mockResolvedValue(binding.wahaSession ? [{ name: binding.wahaSession, status: 'STOPPED', connectionStatus: binding.wahaStatus }] : []);
  const element = document.createElement('div'); document.body.appendChild(element); const root = createRoot(element); roots.push({ root, element });
  await act(async () => { root.render(<HybridWhatsAppInboxConfig accountId={1} inbox={inbox} isDarkMode={false} onChanged={vi.fn()} />); });
  return element;
};

describe('HybridWhatsAppInboxConfig', () => {
  it('renders Meta-only mode without exposing a manual provider selector', async () => {
    const element = await render({ hybridEnabled: false, outOfWindowStrategy: 'template', metaFailureStrategy: 'block' }, { wahaSession: null, wahaStatus: 'not_bound' });
    expect(element.textContent).toContain('Meta + WAHA');
    expect(element.textContent).toContain('Meta: Conectado');
    expect(element.textContent).toContain('WAHA: Não vinculado');
    expect(element.textContent).not.toContain('Enviar por Meta');
    expect(element.textContent).not.toContain('Enviar por WAHA');
  });

  it('renders binding, strategies and separate WAHA status when hybrid is enabled', async () => {
    const element = await render({ hybridEnabled: true, outOfWindowStrategy: 'waha', metaFailureStrategy: 'waha' }, { wahaSession: 'sessao-segura', wahaStatus: 'disconnected' });
    expect(element.textContent).toContain('sessao-segura · Desconectado');
    expect(element.textContent).toContain('Permitir texto livre pelo WAHA');
    expect(element.textContent).toContain('Usar WAHA quando o fallback for seguro');
    expect(element.textContent).toContain('Falhas ambíguas da Meta não usam WAHA automaticamente');
    expect(element.textContent).toContain('Grupos serão enviados e recebidos pelo WAHA.');
  });
});
