// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Inbox } from '../domain/currentUser';
import { ChatwootApiError } from '../integrations/chatwoot/errors';
import { inboxService } from '../integrations/chatwoot/inboxes';
import type { MetaEmbeddedSignupEventResult } from '../integrations/meta/embeddedSignup';
import { MetaCloudSetup } from './MetaCloudSetup';

const embeddedMocks = vi.hoisted(() => ({
  listener: null as ((event: { kind: 'finished'; result: MetaEmbeddedSignupEventResult }) => void) | null,
  open: vi.fn(),
}));

vi.mock('../integrations/meta/embeddedSignup', async importOriginal => ({
  ...(await importOriginal<typeof import('../integrations/meta/embeddedSignup')>()),
  openEmbeddedSignup: embeddedMocks.open,
  listenForEmbeddedSignupEvents: vi.fn((listener: typeof embeddedMocks.listener) => {
    embeddedMocks.listener = listener;
    return () => { embeddedMocks.listener = null; };
  }),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const createdInbox: Inbox = {
  id: 615,
  name: 'Synthetic Official',
  avatarUrl: null,
  channelType: 'Channel::Whatsapp',
  channelId: 91,
  webhookUrl: null,
  inboxIdentifier: null,
  provider: 'whatsapp_cloud',
  phoneNumber: '+5511999999999',
  metaPhoneNumberId: '10001',
  metaBusinessAccountId: '20002',
  additionalAttributes: { meta_connection_status: 'connected' },
};

const buttonWithText = (element: HTMLElement, text: string) => {
  const button = Array.from(element.querySelectorAll('button')).find(item => item.textContent?.includes(text));
  if (!button) throw new Error(`Button not found: ${text}`);
  return button as HTMLButtonElement;
};

const setInput = async (element: HTMLElement, name: string, value: string) => {
  const input = element.querySelector(`input[name="${name}"]`) as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  return input;
};

describe('Meta inbox creation methods', () => {
  let element: HTMLDivElement;
  let root: Root;
  let onSaved: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    element = document.createElement('div'); document.body.append(element); root = createRoot(element);
    onSaved = vi.fn(); embeddedMocks.open.mockReset(); embeddedMocks.listener = null;
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    vi.restoreAllMocks(); localStorage.clear(); document.body.replaceChildren();
  });

  it('mantém a criação oficial via Embedded Signup', async () => {
    vi.spyOn(inboxService, 'nativeWhatsAppEmbeddedSignupConfig').mockResolvedValue({ appId: 'public-app', configurationId: 'public-config', graphApiVersion: 'v22.0' });
    vi.spyOn(inboxService, 'createNativeWhatsAppInbox').mockResolvedValue(createdInbox);
    embeddedMocks.open.mockResolvedValue('one-time-code');
    await act(async () => root.render(<MetaCloudSetup accountId={31} inbox={null} isDarkMode onSaved={onSaved} />));
    await act(async () => buttonWithText(element, 'Meta Embedded Signup').click());
    await act(async () => { buttonWithText(element, 'Conectar WhatsApp Business').click(); await Promise.resolve(); });
    await act(async () => {
      embeddedMocks.listener?.({ kind: 'finished', result: { onboardingMode: 'standard', businessId: 'business-1', wabaId: 'waba-1', phoneNumberId: 'phone-1' } });
      await Promise.resolve();
    });

    expect(inboxService.createNativeWhatsAppInbox).toHaveBeenCalledWith(31, { code: 'one-time-code', businessId: 'business-1', wabaId: 'waba-1', phoneNumberId: 'phone-1', onboardingMode: 'standard' });
    expect(onSaved).toHaveBeenCalledWith(createdInbox);
  });

  it('cria a Channel::Whatsapp manual e nunca persiste ou devolve o token ao componente', async () => {
    vi.spyOn(inboxService, 'createManualMetaInbox').mockResolvedValue({ inbox: createdInbox, configured: true });
    await act(async () => root.render(<MetaCloudSetup accountId={31} inbox={null} isDarkMode onSaved={onSaved} />));
    await act(async () => buttonWithText(element, 'Configuração manual').click());
    await setInput(element, 'inboxName', createdInbox.name);
    await setInput(element, 'phoneNumber', '+5511999999999');
    await setInput(element, 'phoneNumberId', '10001');
    await setInput(element, 'businessAccountId', '20002');
    await setInput(element, 'accessToken', 'request-only-secret');
    await act(async () => { buttonWithText(element, 'Criar inbox oficial').click(); await Promise.resolve(); });

    expect(inboxService.createManualMetaInbox).toHaveBeenCalledWith(31, { name: createdInbox.name, phoneNumber: '+5511999999999', phoneNumberId: '10001', businessAccountId: '20002', accessToken: 'request-only-secret' });
    expect(onSaved).toHaveBeenCalledWith(createdInbox);
    expect((element.querySelector('input[name="accessToken"]') as HTMLInputElement).value).toBe('');
    expect(localStorage.length).toBe(0);
  });

  it('mostra erro claro para credenciais recusadas e não avança com inbox parcial', async () => {
    vi.spyOn(inboxService, 'createManualMetaInbox').mockRejectedValue(new ChatwootApiError({ status: 422, statusText: 'Unprocessable Entity', body: { error: 'Credenciais Meta inválidas.' }, message: 'Credenciais Meta inválidas.' }));
    await act(async () => root.render(<MetaCloudSetup accountId={31} inbox={null} isDarkMode onSaved={onSaved} />));
    await act(async () => buttonWithText(element, 'Configuração manual').click());
    await setInput(element, 'inboxName', 'Synthetic Invalid');
    await setInput(element, 'phoneNumber', '+5511888888888');
    await setInput(element, 'phoneNumberId', '30003');
    await setInput(element, 'businessAccountId', '40004');
    await setInput(element, 'accessToken', 'invalid-request-secret');
    await act(async () => { buttonWithText(element, 'Criar inbox oficial').click(); await Promise.resolve(); });

    expect(element.querySelector('[role="alert"]')?.textContent).toContain('Credenciais Meta inválidas.');
    expect(onSaved).not.toHaveBeenCalled();
    expect((element.querySelector('input[name="accessToken"]') as HTMLInputElement).value).toBe('');
    expect(localStorage.length).toBe(0);
  });
});
