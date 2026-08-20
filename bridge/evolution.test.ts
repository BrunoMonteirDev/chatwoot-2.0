import { afterEach, describe, expect, it, vi } from 'vitest';
import { chatwootAssetUrl, evolutionBridge, normalizeEvolutionDestination, normalizeEvolutionReactionEmoji } from './evolution';

afterEach(() => vi.unstubAllGlobals());

describe('normalizeEvolutionDestination', () => {
  it('adiciona o nono dígito a celular brasileiro no formato antigo', () => {
    expect(normalizeEvolutionDestination('554484532595')).toBe('5544984532595');
  });

  it('preserva números que já estão no formato atual', () => {
    expect(normalizeEvolutionDestination('+55 (44) 98453-2595')).toBe('5544984532595');
  });

  it('troca a URL local do Vite pela URL do Rails para baixar anexos', () => {
    expect(chatwootAssetUrl('http://localhost:3000/rails/active_storage/blobs/redirect/arquivo').toString())
      .toBe('http://localhost:3000/rails/active_storage/blobs/redirect/arquivo');
  });

  it('baixa Base64 puro ou data URI da Evolution sem expor a mídia ao navegador', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ base64: 'data:image/png;base64,aGVsbG8=' }), { status: 200 })));
    await expect(evolutionBridge.downloadMedia('cw-1', {
      kind: 'image', mimetype: 'image/png', fileName: null, duration: null, fileLength: null,
      message: { key: { id: 'media-1' }, message: { imageMessage: { mediaKey: 'secret' } } },
    })).resolves.toMatchObject({ contentType: 'image/png', fileName: 'image.png', buffer: Buffer.from('hello') });
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain('/chat/getBase64FromMediaMessage/cw-1');
    expect(JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string)).toMatchObject({ message: { key: { id: 'media-1' } }, convertToMp4: false });
  });

  it('envia e remove reaction com a chave original Evolution', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'PENDING' }), { status: 201 })));
    await evolutionBridge.sendReaction('cw-1', { remoteJid: '5511999999999@s.whatsapp.net', messageId: 'BAE5-original', fromMe: false, emoji: '❤️' });
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain('/message/sendReaction/cw-1');
    expect(JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string)).toEqual({ key: { remoteJid: '5511999999999@s.whatsapp.net', fromMe: false, id: 'BAE5-original' }, reaction: '❤' });
  });

  it('normaliza variações visuais para o validador de emoji da Evolution v2.3', async () => {
    expect(normalizeEvolutionReactionEmoji('❤️')).toBe('❤');
    expect(normalizeEvolutionReactionEmoji('👍')).toBe('👍');
    expect(normalizeEvolutionReactionEmoji('')).toBe('');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 201 })));
    await evolutionBridge.sendReaction('cw-1', { remoteJid: '5511999999999@s.whatsapp.net', messageId: 'BAE5-heart', fromMe: false, emoji: '❤️' });
    expect(JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string).reaction).toBe('❤');
  });

  it('edita e revoga com os endpoints reais v2 e a chave original', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ key: { id: 'edited' } }), { status: 200 })));
    const target = { remoteJid: '5511999999999@s.whatsapp.net', messageId: 'BAE5-original', fromMe: true };
    await evolutionBridge.editMessage('cw-1', target, 'Texto corrigido');
    await evolutionBridge.revokeMessage('cw-1', target);
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain('/chat/updateMessage/cw-1');
    expect(JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string)).toMatchObject({ number: target.remoteJid, text: 'Texto corrigido', key: { id: target.messageId, fromMe: true } });
    expect(vi.mocked(fetch).mock.calls[1][0]).toContain('/chat/deleteMessageForEveryone/cw-1');
    expect(JSON.parse((vi.mocked(fetch).mock.calls[1][1] as RequestInit).body as string)).toMatchObject({ id: target.messageId, remoteJid: target.remoteJid, fromMe: true });
  });

  it('sends a complete quoted key for an Evolution group reply', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ key: { id: 'reply', remoteJid: '120363024158769234@g.us', fromMe: true } }), { status: 200 })));
    await evolutionBridge.sendText('cw-1', '120363024158769234@g.us', 'Respondendo', { messageId: 'original', remoteJid: '120363024158769234@g.us', fromMe: false, participant: '5511999999999@s.whatsapp.net' });
    expect(JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string)).toMatchObject({ quoted: { key: { id: 'original', remoteJid: '120363024158769234@g.us', fromMe: false, participant: '5511999999999@s.whatsapp.net' } } });
  });

  it('configura eventos de grupo aceitos pela Evolution v2.3', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ webhook: {} }), { status: 200 })));
    await evolutionBridge.configureWebhook('cw-1');
    const request = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    expect(request.webhook.events).toContain('GROUP_UPDATE');
    expect(request.webhook.events).not.toContain('GROUPS_UPDATE');
    expect(request.webhook.events).toContain('MESSAGES_UPDATE');
  });

  it('reutiliza instância criada em uma tentativa anterior que falhou no webhook', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ response: { message: ['This name "cw-1" is already in use.'] } }), { status: 403 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ instance: { instanceName: 'cw-1' } }), { status: 200 })));
    await expect(evolutionBridge.createInstance('cw-1')).resolves.toEqual({ instanceName: 'cw-1', reused: true });
    expect(vi.mocked(fetch).mock.calls[1][0]).toContain('/instance/connectionState/cw-1');
  });
});
