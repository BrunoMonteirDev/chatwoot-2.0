// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WahaSetup } from './WahaSetup';
import { wahaClient } from '../integrations/waha/client';

vi.mock('../integrations/waha/client', () => ({ wahaClient: {
  getInboxConnection: vi.fn(), connectInbox: vi.fn(), reconnectInbox: vi.fn(), disconnectInbox: vi.fn(), getInboxQrCode: vi.fn(), deleteInboxConnection: vi.fn(),
} }));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const inbox = (id = 152) => ({ id, name: `Comercial ${id}`, avatarUrl: null, channelType: 'Channel::Api', channelId: 1, webhookUrl: null, inboxIdentifier: `inbox-${id}`, additionalAttributes: {} });
let element: HTMLDivElement; let root: Root;

const render = async (id = 152, onSaved = vi.fn()) => {
  element = document.createElement('div'); document.body.append(element); root = createRoot(element);
  await act(async () => { root.render(<WahaSetup accountId={2} inbox={inbox(id)} isDarkMode={false} onSaved={onSaved} />); });
  return onSaved;
};
const button = (label: string) => Array.from(element.querySelectorAll('button')).find(item => item.textContent?.includes(label)) as HTMLButtonElement;

beforeEach(() => { vi.mocked(wahaClient.getInboxConnection).mockReset().mockResolvedValue({ connection: null }); vi.mocked(wahaClient.connectInbox).mockReset(); vi.mocked(wahaClient.reconnectInbox).mockReset(); vi.mocked(wahaClient.disconnectInbox).mockReset(); vi.mocked(wahaClient.getInboxQrCode).mockReset(); vi.mocked(wahaClient.deleteInboxConnection).mockReset(); });
afterEach(async () => { if (root) await act(async () => root.unmount()); element?.remove(); vi.restoreAllMocks(); });

describe('WahaSetup simplified connection', () => {
  it('creates an inbox-scoped connection and displays the returned QR immediately', async () => {
    const connect = vi.mocked(wahaClient.connectInbox).mockResolvedValue({ connection: { status: 'SCAN', connectionStatus: 'connecting' }, qr: { mimetype: 'image/png', data: 'synthetic-qr' } });
    await render();
    expect(element.textContent).toContain('WhatsApp não conectado');
    await act(async () => { button('Conectar por QR Code').click(); });
    expect(connect).toHaveBeenCalledWith({ accountId: 2, inboxId: 152 });
    expect(element.querySelector('img[alt="QR Code do WhatsApp"]')).not.toBeNull();
    expect(element.textContent).not.toMatch(/Criar conexão|WhatsApp oficial|Nome da sessão|Instância/);
  });

  it('recognizes an existing binding without exposing its internal name', async () => {
    vi.mocked(wahaClient.getInboxConnection).mockResolvedValue({ connection: { status: 'WORKING', connectionStatus: 'connected', me: { id: '5511999999999@c.us', pushName: 'Equipe Comercial' } } });
    await render();
    expect(element.textContent).toContain('WhatsApp conectado');
    expect(element.textContent).toContain('Equipe Comercial · 5511999999999');
    expect(element.textContent).toContain('Reconectar');
    expect(element.textContent).toContain('Desconectar');
    expect(element.textContent).toContain('Excluir conexão');
    expect(element.textContent).not.toContain('WhatsApp oficial');
  });

  it('updates to connected automatically after the QR is read', async () => {
    vi.mocked(wahaClient.getInboxConnection).mockResolvedValueOnce({ connection: null }).mockResolvedValue({ connection: { status: 'WORKING', connectionStatus: 'connected', me: { id: '5511777777777@c.us' } } });
    vi.mocked(wahaClient.connectInbox).mockResolvedValue({ connection: { status: 'SCAN', connectionStatus: 'connecting' }, qr: { mimetype: 'image/png', data: 'synthetic-qr' } });
    const saved = await render();
    await act(async () => { button('Conectar por QR Code').click(); });
    await act(async () => { await new Promise(resolve => window.setTimeout(resolve, 1600)); });
    expect(element.textContent).toContain('WhatsApp conectado');
    expect(element.querySelector('img[alt="QR Code do WhatsApp"]')).toBeNull();
    expect(saved).toHaveBeenCalled();
  });

  it('reconnects the existing connection instead of creating another', async () => {
    vi.mocked(wahaClient.getInboxConnection).mockResolvedValue({ connection: { status: 'FAILED', connectionStatus: 'error' } });
    const reconnect = vi.mocked(wahaClient.reconnectInbox).mockResolvedValue({ connection: { status: 'SCAN', connectionStatus: 'connecting' }, qr: { mimetype: 'image/png', data: 'new-qr' } });
    const connect = vi.mocked(wahaClient.connectInbox);
    await render();
    await act(async () => { button('Reconectar').click(); });
    expect(reconnect).toHaveBeenCalledWith({ accountId: 2, inboxId: 152 });
    expect(connect).not.toHaveBeenCalled();
    expect(element.querySelector('img[alt="QR Code do WhatsApp"]')).not.toBeNull();
  });

  it('removes only the connection and updates the UI without a refresh', async () => {
    vi.mocked(wahaClient.getInboxConnection).mockResolvedValue({ connection: { status: 'WORKING', connectionStatus: 'connected' } });
    const remove = vi.mocked(wahaClient.deleteInboxConnection).mockResolvedValue(undefined);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const saved = await render();
    await act(async () => { button('Excluir conexão').click(); });
    expect(remove).toHaveBeenCalledWith({ accountId: 2, inboxId: 152 });
    expect(saved).toHaveBeenCalled();
    expect(element.textContent).toContain('WhatsApp não conectado');
    expect(element.textContent).toContain('Conectar por QR Code');
  });

  it('disconnects the device while preserving the connection and inbox', async () => {
    vi.mocked(wahaClient.getInboxConnection).mockResolvedValue({ connection: { status: 'WORKING', connectionStatus: 'connected' } });
    const disconnect = vi.mocked(wahaClient.disconnectInbox).mockResolvedValue({ connection: { status: 'STOPPED', connectionStatus: 'disconnected' } });
    const remove = vi.mocked(wahaClient.deleteInboxConnection);
    await render();
    await act(async () => { button('Desconectar').click(); });
    expect(disconnect).toHaveBeenCalledWith({ accountId: 2, inboxId: 152 });
    expect(remove).not.toHaveBeenCalled();
    expect(element.textContent).toContain('WhatsApp não conectado');
    expect(element.textContent).toContain('Mostrar novo QR Code');
    expect(element.textContent).toContain('Excluir conexão');
  });

  it('keeps two inboxes isolated through their request context', async () => {
    const connect = vi.mocked(wahaClient.connectInbox).mockResolvedValue({ connection: { status: 'SCAN', connectionStatus: 'connecting' } });
    await render(901);
    await act(async () => { button('Conectar por QR Code').click(); });
    expect(connect).toHaveBeenCalledWith({ accountId: 2, inboxId: 901 });
    expect(connect).not.toHaveBeenCalledWith(expect.objectContaining({ inboxId: 902 }));
  });
});
