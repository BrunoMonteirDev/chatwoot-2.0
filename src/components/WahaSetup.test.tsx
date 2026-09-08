// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WahaSetup } from './WahaSetup';
import { wahaClient } from '../integrations/waha/client';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => vi.restoreAllMocks());

describe('WahaSetup operational state', () => {
  it('keeps a failed owned session visible and never calls it connected', async () => {
    vi.spyOn(wahaClient, 'listSessions').mockResolvedValue({ sessions: [{ name: 'KoplaComercial', status: 'FAILED', connectionStatus: 'error', engine: 'GOWS' }] });
    vi.spyOn(wahaClient, 'getCurrentHistoryImport').mockResolvedValue({ job: null, running: false });
    const inbox = { id: 152, name: 'Comercial', avatarUrl: null, channelType: 'Channel::Api', channelId: 1, webhookUrl: null, inboxIdentifier: 'x', additionalAttributes: { whatsapp_transports: ['waha'], waha_session_name: 'KoplaComercial', waha_connection_status: 'connected' } };
    const element = document.createElement('div'); document.body.append(element); const root = createRoot(element);
    await act(async () => { root.render(<WahaSetup accountId={2} inbox={inbox} webhookUrl="" isDarkMode={false} onSaved={vi.fn()} />); });
    await act(async () => { (Array.from(element.querySelectorAll('button')).find(button => button.textContent === 'WhatsApp não oficial') as HTMLButtonElement).click(); });
    expect(element.textContent).toContain('KoplaComercial · Erro');
    expect(element.textContent).toContain('WhatsApp ainda não conectado');
    expect(element.textContent).toContain('Esta conexão já está vinculada à caixa');
    expect(element.textContent).toContain('Reconectar');
    expect(element.textContent).not.toContain('Nenhuma conexão criada');
    expect(element.textContent).not.toContain('WhatsApp conectado');
    await act(async () => root.unmount()); element.remove();
  });
});
