import { afterEach, describe, expect, it, vi } from 'vitest';
import { reactionTransport, UnsupportedReactionTransportError } from './reactionTransport';

afterEach(() => vi.unstubAllGlobals());

describe('reaction transports', () => {
  it('envia a reaction Evolution pela instância complementar mesmo em inbox híbrida', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 201 })));

    await reactionTransport.send({
      transport: 'evolution', evolutionInstanceName: 'cw-complementar',
      target: { remoteJid: '5511999999999@s.whatsapp.net', messageId: 'BAE5', fromMe: false, emoji: '👍' },
    });

    expect(vi.mocked(fetch).mock.calls[0][0]).toContain('/message/sendReaction/cw-complementar');
  });

  it('envia reaction Meta pelo transport original, sem fallback para Evolution', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ messages: [{ id: 'wamid.reaction' }] }), { status: 200 })));
    await reactionTransport.send({
      transport: 'meta_cloud', evolutionInstanceName: 'cw-complementar', metaConfig: { wabaId: 'waba', phoneNumberId: 'phone-1', accessToken: 'secret' },
      target: { remoteJid: '5511999999999@s.whatsapp.net', messageId: 'wamid.1', fromMe: false, emoji: '👍' },
    });
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain('/phone-1/messages');
    expect(JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string)).toMatchObject({ type: 'reaction', reaction: { message_id: 'wamid.1', emoji: '👍' } });
  });

  it('não usa Evolution como fallback para mensagem Meta sem credenciais', async () => {
    await expect(reactionTransport.send({
      transport: 'meta_cloud', evolutionInstanceName: 'cw-complementar',
      target: { remoteJid: '5511999999999@s.whatsapp.net', messageId: 'wamid.1', fromMe: false, emoji: '👍' },
    })).rejects.toBeInstanceOf(UnsupportedReactionTransportError);
  });
});
