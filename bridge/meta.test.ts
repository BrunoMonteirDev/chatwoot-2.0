import { afterEach, describe, expect, it, vi } from 'vitest';
import { metaCloud, MetaCloudError } from './meta';
import { config } from './config';

const originalAppId = config.metaAppId;
const originalAppSecret = config.metaAppSecret;
afterEach(() => { vi.unstubAllGlobals(); config.metaAppId = originalAppId; config.metaAppSecret = originalAppSecret; });

describe('Meta Cloud manual validation', () => {
  it('exige os três campos manuais antes de chamar a Graph API', async () => {
    await expect(metaCloud.validateManual({ wabaId: '', phoneNumberId: 'phone-1', accessToken: 'token' })).rejects.toThrow('obrigatórios');
  });

  it('valida o telefone e sua associação ao WABA sem retornar o token', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'phone-1', display_phone_number: '5511999999999', verified_name: 'Empresa' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'phone-1' }] }), { status: 200 })));
    const connection = await metaCloud.validateManual({ wabaId: 'waba-1', phoneNumberId: 'phone-1', accessToken: 'private-token' });
    expect(connection).toEqual({ provider: 'meta_cloud', wabaId: 'waba-1', phoneNumberId: 'phone-1', displayPhoneNumber: '5511999999999', verifiedName: 'Empresa' });
    expect(connection).not.toHaveProperty('accessToken');
  });

  it('rejeita credenciais inválidas sem expor a resposta da Meta', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'sensitive' } }), { status: 401 })));
    await expect(metaCloud.validateManual({ wabaId: 'waba-1', phoneNumberId: 'phone-1', accessToken: 'bad' })).rejects.toThrow('A Meta recusou');
  });

  it('envia texto com wamid e contexto de reply Meta', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ messages: [{ id: 'wamid.out-1' }] }), { status: 200 })));
    await expect(metaCloud.sendText({ wabaId: 'waba', phoneNumberId: 'phone-1', accessToken: 'secret' }, '+55 (11) 99999-9999', 'Resposta', 'wamid.original')).resolves.toEqual({ messageId: 'wamid.out-1' });
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toContain('/v22.0/phone-1/messages');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ messaging_product: 'whatsapp', recipient_type: 'individual', to: '5511999999999', type: 'text', text: { body: 'Resposta', preview_url: false }, context: { message_id: 'wamid.original' } });
  });

  it('envia e remove reação Meta usando o wamid da mensagem alvo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ messages: [{ id: 'wamid.reaction-1' }] }), { status: 200 })));
    await expect(metaCloud.sendReaction({ wabaId: 'waba', phoneNumberId: 'phone-1', accessToken: 'secret' }, '+55 11 99999-9999', 'wamid.target', '❤️')).resolves.toEqual({ messageId: 'wamid.reaction-1' });
    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({ type: 'reaction', to: '5511999999999', reaction: { message_id: 'wamid.target', emoji: '❤️' } });
  });

  it('lista somente dados públicos dos templates e envia o template escolhido', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'template-1', name: 'hello_world', language: 'pt_BR', category: 'UTILITY', status: 'APPROVED', quality_score: 'GREEN', components: [{ type: 'BODY', text: 'Olá {{1}}' }] }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ messages: [{ id: 'wamid.template-1' }] }), { status: 200 })));
    await expect(metaCloud.listTemplates({ wabaId: 'waba', phoneNumberId: 'phone-1', accessToken: 'secret' })).resolves.toEqual([expect.objectContaining({ name: 'hello_world', language: 'pt_BR', status: 'APPROVED' })]);
    await expect(metaCloud.sendTemplate({ wabaId: 'waba', phoneNumberId: 'phone-1', accessToken: 'secret' }, '5511999999999', { name: 'hello_world', language: 'pt_BR', components: [{ type: 'body', parameters: [{ type: 'text', text: 'Ana' }] }] })).resolves.toEqual({ messageId: 'wamid.template-1' });
    const [, init] = vi.mocked(fetch).mock.calls[1];
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({ type: 'template', template: { name: 'hello_world', language: { code: 'pt_BR' } } });
  });

  it('uploads template header media server-side before referencing its media id', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'header-media-1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ messages: [{ id: 'wamid.template-media' }] }), { status: 200 })));
    const credentials = { wabaId: 'waba', phoneNumberId: 'phone-1', accessToken: 'secret' };
    await expect(metaCloud.uploadTemplateHeaderMedia(credentials, { buffer: Buffer.from('image'), contentType: 'image/jpeg', fileName: 'cabecalho.jpg', kind: 'image' })).resolves.toBe('header-media-1');
    await expect(metaCloud.sendTemplate(credentials, '5511999999999', { name: 'media_template', language: 'pt_BR', components: [{ type: 'header', parameters: [{ type: 'image', image: { id: 'header-media-1' } }] }, { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: 'rastrear' }] }] })).resolves.toEqual({ messageId: 'wamid.template-media' });
    const [, init] = vi.mocked(fetch).mock.calls[1];
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({ template: { components: [{ type: 'header', parameters: [{ image: { id: 'header-media-1' } }] }, { type: 'button', sub_type: 'url', index: '0' }] } });
  });

  it('faz upload e envia imagem, áudio, vídeo e documento pelo media ID', async () => {
    const kinds = [
      { fileType: 'image', contentType: 'image/jpeg' }, { fileType: 'audio', contentType: 'audio/ogg' }, { fileType: 'video', contentType: 'video/mp4' }, { fileType: 'file', contentType: 'application/pdf' },
    ] as const;
    for (const [index, attachment] of kinds.entries()) {
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce(new Response('image', { status: 200, headers: { 'content-type': attachment.contentType } }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ id: `media-${index}` }), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ messages: [{ id: `wamid-media-${index}` }] }), { status: 200 })));
      await expect(metaCloud.sendMedia({ wabaId: 'waba', phoneNumberId: 'phone-1', accessToken: 'secret' }, '5511999999999', { url: 'http://localhost:3003/rails/active_storage/blobs/file', ...attachment, fileName: `file-${index}` }, 'Legenda')).resolves.toEqual({ messageId: `wamid-media-${index}` });
      expect(vi.mocked(fetch).mock.calls[1][0]).toContain('/phone-1/media');
      expect(vi.mocked(fetch).mock.calls[2][0]).toContain('/phone-1/messages');
    }
  });

  it('categoriza rejeição de janela/template sem acionar outro transport', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 131047, message: 'Outside service window' } }), { status: 400 })));
    await expect(metaCloud.sendText({ wabaId: 'waba', phoneNumberId: 'phone-1', accessToken: 'secret' }, '5511999999999', 'Olá')).rejects.toMatchObject({ category: 'template_window' } satisfies Partial<MetaCloudError>);
  });

  it('troca o code no bridge, valida a conta e tenta inscrever o app no WABA', async () => {
    config.metaAppId = 'app-1'; config.metaAppSecret = 'app-secret';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'server-only-token' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'phone-1', display_phone_number: '5511999999999', verified_name: 'Empresa' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'phone-1' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const completed = await metaCloud.completeEmbeddedSignup('authorization-code', { onboardingMode: 'standard', wabaId: 'waba-1', phoneNumberId: 'phone-1' });
    expect(completed.connection).toMatchObject({ wabaId: 'waba-1', phoneNumberId: 'phone-1' });
    expect(completed.webhookReady).toBe(true);
    expect(completed.config.accessToken).toBe('server-only-token');
  });

  it('não informa conexão pronta quando a assinatura do webhook falha', async () => {
    config.metaAppId = 'app-1'; config.metaAppSecret = 'app-secret';
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'server-only-token' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'phone-1' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'phone-1' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 10, message: 'Permission denied' } }), { status: 403 })));
    await expect(metaCloud.completeEmbeddedSignup('authorization-code', { onboardingMode: 'standard', wabaId: 'waba-1', phoneNumberId: 'phone-1' })).resolves.toMatchObject({ webhookReady: false, connection: { phoneNumberId: 'phone-1' } });
  });

  it('descobre o número coexistente pelo WABA sem registrar ou migrar o número do app', async () => {
    config.metaAppId = 'app-1'; config.metaAppSecret = 'app-secret';
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'server-only-token' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'phone-1' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'phone-1', display_phone_number: '5511999999999' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'phone-1' }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 })));
    await expect(metaCloud.completeEmbeddedSignup('authorization-code', { onboardingMode: 'coexistence', wabaId: 'waba-1' })).resolves.toMatchObject({ connection: { phoneNumberId: 'phone-1' }, webhookReady: true });
  });
});
