// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HybridWhatsAppInboxConfig } from './HybridWhatsAppInboxConfig';
import { inboxService, type HybridWahaStatus } from '../integrations/chatwoot/inboxes';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const inbox = { id: 5, name: 'Oficial', avatarUrl: null, channelType: 'Channel::Whatsapp', channelId: 1, webhookUrl: null, inboxIdentifier: null, additionalAttributes: { meta_connection_status: 'connected' } };
const roots: Array<{ root: Root; element: HTMLDivElement }> = [];
afterEach(async () => {
  await act(async () => { roots.splice(0).forEach(({ root, element }) => { root.unmount(); element.remove(); }); });
  vi.restoreAllMocks();
});

const render = async (configuration: { hybridEnabled: boolean; outOfWindowStrategy: 'template' | 'waha'; metaFailureStrategy: 'block' | 'waha' }, binding: { wahaSession: string | null; wahaStatus: HybridWahaStatus }) => {
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

  it('persists the hybrid toggle then renders the configuration returned by Rails', async () => {
    const element = await render({ hybridEnabled: true, outOfWindowStrategy: 'template', metaFailureStrategy: 'block' }, { wahaSession: 'sessao-segura', wahaStatus: 'disconnected' });
    vi.mocked(inboxService.hybridWahaConfiguration).mockResolvedValue({ hybridEnabled: false, wahaSession: 'sessao-segura', outOfWindowStrategy: 'template', metaFailureStrategy: 'block' });
    const save = vi.spyOn(inboxService, 'saveHybridWahaConfiguration').mockResolvedValue({ hybridEnabled: false, wahaSession: 'sessao-segura', outOfWindowStrategy: 'template', metaFailureStrategy: 'block' });

    const toggle = element.querySelector('input[type="checkbox"]') as HTMLInputElement;
    await act(async () => { toggle.click(); });

    expect(save).toHaveBeenCalledWith(1, 5, { hybridEnabled: false, outOfWindowStrategy: 'template', metaFailureStrategy: 'block' });
    expect(toggle.checked).toBe(false);
  });

  it('keeps the server binding visible when unbind fails', async () => {
    const element = await render({ hybridEnabled: true, outOfWindowStrategy: 'template', metaFailureStrategy: 'block' }, { wahaSession: 'sessao-ausente', wahaStatus: 'disconnected' });
    vi.spyOn(inboxService, 'unbindHybridWahaSession').mockRejectedValue(new Error('Falha ao desvincular'));

    await act(async () => { (Array.from(element.querySelectorAll('button')).find(button => button.textContent?.includes('Desvincular')) as HTMLButtonElement).click(); });

    expect(element.textContent).toContain('sessao-ausente');
    expect(element.textContent).toContain('Ocorreu um erro inesperado');
  });

  it('shows a missing session as removable and does not offer reconnect', async () => {
    const element = await render({ hybridEnabled: true, outOfWindowStrategy: 'template', metaFailureStrategy: 'block' }, { wahaSession: 'sessao-ausente', wahaStatus: 'missing' });
    expect(element.textContent).toContain('Sessão não encontrada no WAHA');
    expect(element.textContent).toContain('Desvincular');
    expect((Array.from(element.querySelectorAll('button')).find(button => button.textContent?.includes('Reconectar')) as HTMLButtonElement).disabled).toBe(true);
  });

  it('creates, reconnects and shows QR without attempting to bind', async () => {
    const element = await render({ hybridEnabled: true, outOfWindowStrategy: 'template', metaFailureStrategy: 'block' }, { wahaSession: null, wahaStatus: 'not_bound' });
    vi.spyOn(inboxService, 'createHybridWahaSession').mockResolvedValue({ name: 'hybrid-a1-i5', status: 'FAILED', connectionStatus: 'error' });
    vi.spyOn(inboxService, 'hybridWahaSessionStatus').mockResolvedValue({ name: 'hybrid-a1-i5', status: 'FAILED', connectionStatus: 'error' });
    const operate = vi.spyOn(inboxService, 'operateHybridWahaSession').mockImplementation(async (_account, _inbox, _session, operation) => operation === 'restart'
      ? { session: { name: 'hybrid-a1-i5', status: 'SCAN_QR_CODE', connectionStatus: 'connecting' } }
      : { session: { name: 'hybrid-a1-i5', status: 'SCAN_QR_CODE', connectionStatus: 'connecting' }, qr: { mimetype: 'image/png', data: 'qr-data' } });
    const bind = vi.spyOn(inboxService, 'bindHybridWahaSession');

    await act(async () => { (Array.from(element.querySelectorAll('button')).find(button => button.textContent?.includes('Criar e conectar')) as HTMLButtonElement).click(); });

    expect(inboxService.createHybridWahaSession).toHaveBeenCalledWith(1, 5);
    expect(operate).toHaveBeenCalledWith(1, 5, 'hybrid-a1-i5', 'restart');
    expect(operate).toHaveBeenCalledWith(1, 5, 'hybrid-a1-i5', 'qr');
    expect(element.querySelector('img[alt="QR Code WAHA"]')).not.toBeNull();
    expect(bind).not.toHaveBeenCalled();
  });

  it('auto-binds exactly once after the status becomes connected', async () => {
    const element = await render({ hybridEnabled: true, outOfWindowStrategy: 'template', metaFailureStrategy: 'block' }, { wahaSession: null, wahaStatus: 'not_bound' });
    vi.spyOn(inboxService, 'createHybridWahaSession').mockResolvedValue({ name: 'hybrid-a1-i5', status: 'WORKING', connectionStatus: 'connected', me: { id: '554488567632@c.us' } });
    vi.spyOn(inboxService, 'hybridWahaSessionStatus').mockResolvedValue({ name: 'hybrid-a1-i5', status: 'WORKING', connectionStatus: 'connected', me: { id: '554488567632@c.us' } });
    const bind = vi.spyOn(inboxService, 'bindHybridWahaSession').mockResolvedValue({ hybridEnabled: true, wahaSession: 'hybrid-a1-i5', wahaStatus: 'connected' });

    await act(async () => { (Array.from(element.querySelectorAll('button')).find(button => button.textContent?.includes('Criar e conectar')) as HTMLButtonElement).click(); });

    expect(bind).toHaveBeenCalledTimes(1);
    expect(bind).toHaveBeenCalledWith(1, 5, 'hybrid-a1-i5');
  });
});
