// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authSession } from './authSession';
import { messageService } from './messages';

describe('messageService', () => {
  beforeEach(() => {
    sessionStorage.clear();
    authSession.set({ accessToken: 'token', tokenType: 'Bearer', client: 'client', expiry: '1', uid: 'agent@example.test' });
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it('usa o cursor before e normaliza o envelope de histórico', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ meta: {}, payload: [{
      id: 51, conversation_id: 31, content: 'Nota para o time', message_type: 1,
      content_type: 'text', status: 'read', private: true, created_at: 100,
      sender: { name: 'Ana' }, attachments: [{ id: 7, file_type: 'image', data_url: 'https://cdn.test/image.png', thumb_url: null }],
    }] }), { status: 200 }));

    await expect(messageService.list({ accountId: 2, conversationId: 31, before: 80 })).resolves.toMatchObject({
      hasOlderMessages: false,
      messages: [{ id: 51, kind: 'private_note', status: 'read', attachments: [{ kind: 'image' }] }],
    });
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/v1/accounts/2/conversations/31/messages?before=80');
  });

  it('envia texto e nota privada com echo_id e normaliza a resposta do POST', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      id: 52, conversation_id: 31, content: 'Nota interna', message_type: 1,
      content_type: 'text', status: 'sent', private: true, created_at: 101, echo_id: 'echo-52', attachments: [],
    }), { status: 200 }));

    await expect(messageService.create({ accountId: 2, conversationId: 31, content: 'Nota interna', private: true, echoId: 'echo-52' }))
      .resolves.toMatchObject({ id: 52, kind: 'private_note', status: 'sent', echoId: 'echo-52' });
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('/api/v1/accounts/2/conversations/31/messages');
    expect(vi.mocked(fetch).mock.calls[0][1]).toMatchObject({ method: 'POST', body: JSON.stringify({ content: 'Nota interna', private: true, echo_id: 'echo-52' }) });
  });

  it('envia anexos como multipart sem alterar o contrato JSON de mensagens simples', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({
      id: 53, conversation_id: 31, content: 'Veja o arquivo', message_type: 1,
      content_type: 'text', status: 'sent', private: false, created_at: 102, echo_id: 'echo-53', attachments: [],
    }), { status: 200 }));

    const file = new File(['conteúdo'], 'proposta.pdf', { type: 'application/pdf' });
    await messageService.create({ accountId: 2, conversationId: 31, content: 'Veja o arquivo', private: false, echoId: 'echo-53', files: [file] });
    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    const form = init.body as FormData;
    expect(form.get('content')).toBe('Veja o arquivo');
    expect(form.get('private')).toBe('false');
    expect(form.get('echo_id')).toBe('echo-53');
    expect(form.get('attachments[]')).toBe(file);
    expect(new Headers(init.headers).get('Content-Type')).toBeNull();
  });
});
