import { describe, expect, it } from 'vitest';
import { parseIncomingEvolutionEdit, parseIncomingEvolutionGroupLifecycle, parseIncomingEvolutionMessage, parseIncomingEvolutionReaction, parseIncomingEvolutionRevoke } from './evolutionEvent';

describe('parseIncomingEvolutionMessage', () => {
  it('normaliza texto incoming do evento messages.upsert', () => {
    expect(parseIncomingEvolutionMessage({ event: 'messages.upsert', instance: 'cw-1-vendas', data: { key: { remoteJid: '5511999999999@s.whatsapp.net', id: 'BAE5', fromMe: false }, pushName: 'Ana', message: { conversation: 'Olá' } } }))
      .toEqual({ instance: 'cw-1-vendas', messageId: 'BAE5', sourceId: 'whatsapp:551199999999', remoteJid: '5511999999999@s.whatsapp.net', phoneNumber: '+551199999999', fromMe: false, name: 'Ana', contactName: 'Ana', content: 'Olá' });
  });

  it('usa extendedTextMessage e identifica mensagens enviadas pelo próprio número', () => {
    expect(parseIncomingEvolutionMessage({ event: 'messages.upsert', instance: 'cw-1', data: { key: { remoteJid: '5511999999999@s.whatsapp.net', id: 'id', fromMe: false }, message: { extendedTextMessage: { text: 'Legenda' } } } })?.content).toBe('Legenda');
    expect(parseIncomingEvolutionMessage({ event: 'messages.upsert', instance: 'cw-1', data: { key: { remoteJid: '5511999999999@s.whatsapp.net', id: 'id', fromMe: true }, message: { conversation: 'Enviar pelo celular' } } })?.fromMe).toBe(true);
  });

  it('usa o destinatário, e não senderPn próprio, em mensagem enviada pelo aparelho', () => {
    expect(parseIncomingEvolutionMessage({
      event: 'messages.upsert', instance: 'cw-1',
      data: { key: { remoteJid: '5511988887777@s.whatsapp.net', senderPn: '5511977776666@s.whatsapp.net', id: 'mobile-id', fromMe: true }, message: { conversation: 'Enviado pelo celular' } },
    })).toMatchObject({ sourceId: 'whatsapp:551188887777', phoneNumber: '+551188887777', fromMe: true });
  });

  it('usa senderPn como telefone canônico e mantém o LID como alias', () => {
    expect(parseIncomingEvolutionMessage({
      event: 'messages.upsert', instance: 'cw-1',
      data: { key: { remoteJid: '58497538457613@lid', senderPn: '5511999999999@s.whatsapp.net', id: 'lid-message', fromMe: false }, message: { conversation: 'Oi' } },
    })).toEqual({
      instance: 'cw-1', messageId: 'lid-message', sourceId: 'whatsapp:551199999999', remoteJid: '58497538457613@lid', phoneNumber: '+551199999999', lid: '58497538457613', fromMe: false, name: '551199999999', content: 'Oi',
    });
  });

  it('aceita LID sem telefone e o mantém como fonte temporária', () => {
    expect(parseIncomingEvolutionMessage({
      event: 'messages.upsert', instance: 'cw-1',
      data: { key: { remoteJid: '58497538457613@lid', id: 'lid-only', fromMe: false }, message: { conversation: 'Oi' } },
    })).toMatchObject({ sourceId: 'whatsapp:lid:58497538457613', lid: '58497538457613' });
  });

  it('preserva a referência da mensagem respondida', () => {
    expect(parseIncomingEvolutionMessage({
      event: 'messages.upsert', instance: 'cw-1',
      data: { key: { remoteJid: '5511999999999@s.whatsapp.net', id: 'reply-id', fromMe: false }, message: { extendedTextMessage: { text: 'Minha resposta', contextInfo: { stanzaId: 'original-id' } } } },
    })).toMatchObject({ messageId: 'reply-id', quotedMessageId: 'original-id' });
  });

  it('aceita a referência de reply no wrapper messageContextInfo do Evolution v2', () => {
    expect(parseIncomingEvolutionMessage({
      event: 'messages.upsert', instance: 'cw-1',
      data: { key: { remoteJid: '5511999999999@s.whatsapp.net', id: 'reply-wrapper', fromMe: true }, message: { conversation: 'Resposta pelo celular', messageContextInfo: { stanzaId: 'original-wrapper' } } },
    })).toMatchObject({ messageId: 'reply-wrapper', quotedMessageId: 'original-wrapper' });
  });

  it('aceita imagem com caption e preserva metadados para download', () => {
    expect(parseIncomingEvolutionMessage({
      event: 'messages.upsert', instance: 'cw-1',
      data: { key: { remoteJid: '5511999999999@s.whatsapp.net', id: 'image-caption', fromMe: false }, message: { imageMessage: { caption: 'Produto', mimetype: 'image/jpeg', fileLength: '1234', mediaKey: 'secret' } } },
    })).toMatchObject({
      content: 'Produto', media: { kind: 'image', mimetype: 'image/jpeg', fileLength: 1234, fileName: null, message: { key: { id: 'image-caption' } } },
    });
  });

  it('aceita imagem sem caption, áudio, vídeo e documento sem texto', () => {
    const base = { event: 'messages.upsert', instance: 'cw-1', data: { key: { remoteJid: '5511999999999@s.whatsapp.net', id: 'media-id', fromMe: false }, message: {} } };
    expect(parseIncomingEvolutionMessage({ ...base, data: { ...base.data, message: { imageMessage: { mimetype: 'image/png' } } } })).toMatchObject({ content: '', media: { kind: 'image', mimetype: 'image/png' } });
    expect(parseIncomingEvolutionMessage({ ...base, data: { ...base.data, message: { audioMessage: { mimetype: 'audio/ogg; codecs=opus', seconds: 12 } } } })).toMatchObject({ content: '', media: { kind: 'audio', duration: 12 } });
    expect(parseIncomingEvolutionMessage({ ...base, data: { ...base.data, message: { videoMessage: { mimetype: 'video/mp4' } } } })).toMatchObject({ media: { kind: 'video' } });
    expect(parseIncomingEvolutionMessage({ ...base, data: { ...base.data, message: { documentMessage: { mimetype: 'application/pdf', fileName: 'proposta.pdf' } } } })).toMatchObject({ media: { kind: 'document', fileName: 'proposta.pdf' } });
  });

  it('aceita mídia encapsulada por mensagens temporárias ou visualização única', () => {
    const base = { event: 'messages.upsert', instance: 'cw-1', data: { key: { remoteJid: '5511999999999@s.whatsapp.net', id: 'wrapped-image', fromMe: false }, message: { ephemeralMessage: { message: { viewOnceMessageV2: { message: { imageMessage: { mimetype: 'image/jpeg', caption: 'Imagem temporária' } } } } } } } };
    expect(parseIncomingEvolutionMessage(base)).toMatchObject({
      messageId: 'wrapped-image', content: 'Imagem temporária', media: { kind: 'image', mimetype: 'image/jpeg' },
    });
  });

  it('preserva fromMe em mídia para o bridge criar uma mensagem outgoing', () => {
    expect(parseIncomingEvolutionMessage({
      event: 'messages.upsert', instance: 'cw-1',
      data: { key: { remoteJid: '5511988887777@s.whatsapp.net', id: 'mobile-image', fromMe: true }, message: { imageMessage: { mimetype: 'image/jpeg' } } },
    })).toMatchObject({ fromMe: true, sourceId: 'whatsapp:551188887777', media: { kind: 'image' } });
  });

  it('aceita grupo Evolution e preserva grupo e participante sem criar contato individual', () => {
    expect(parseIncomingEvolutionMessage({
      event: 'messages.upsert', instance: 'cw-1',
      data: { key: { remoteJid: '120363024158769234@g.us', participant: '5511999999999@s.whatsapp.net', id: 'group-1', fromMe: false }, subject: 'Equipe Comercial', pushName: 'Ana', message: { conversation: 'Bom dia' } },
    })).toMatchObject({
      sourceId: 'whatsapp:group:120363024158769234%40g%2Eus', remoteJid: '120363024158769234@g.us', chatType: 'group', name: 'Equipe Comercial', participantJid: '5511999999999@s.whatsapp.net', participantName: 'Ana', content: 'Bom dia',
    });
  });
});

describe('parseIncomingEvolutionReaction', () => {
  it('interpreta reactionMessage como operação sobre a mensagem alvo', () => {
    expect(parseIncomingEvolutionReaction({
      event: 'messages.upsert', instance: 'cw-1',
      data: {
        key: { remoteJid: '5511999999999@s.whatsapp.net', id: 'reaction-event-1', fromMe: false, senderPn: '5511999999999@s.whatsapp.net' },
        pushName: 'Ana',
        message: { reactionMessage: { key: { remoteJid: '5511999999999@s.whatsapp.net', id: 'original-1', fromMe: true }, text: '😂' } },
      },
    })).toEqual({
      instance: 'cw-1', eventId: 'reaction-event-1', targetMessageId: 'original-1', targetFromMe: true,
      sourceId: 'whatsapp:551199999999', remoteJid: '5511999999999@s.whatsapp.net', phoneNumber: '+551199999999',
      fromMe: false, name: 'Ana', contactName: 'Ana', senderId: 'contact:5511999999999', emoji: '😂',
    });
  });

  it('preserva fromMe e aceita texto vazio para remover uma reaction', () => {
    expect(parseIncomingEvolutionReaction({
      event: 'messages.upsert', instance: 'cw-1',
      data: { key: { remoteJid: '5511999999999@s.whatsapp.net', id: 'reaction-event-2', fromMe: true }, message: { reactionMessage: { key: { remoteJid: '5511999999999@s.whatsapp.net', id: 'original-2', fromMe: false }, text: '' } } },
    })).toMatchObject({ fromMe: true, senderId: 'self', emoji: '', targetMessageId: 'original-2', targetFromMe: false });
  });

  it('não transforma reaction em mensagem comum', () => {
    const payload = { event: 'messages.upsert', instance: 'cw-1', data: { key: { remoteJid: '5511999999999@s.whatsapp.net', id: 'reaction-event-3', fromMe: false }, message: { reactionMessage: { key: { remoteJid: '5511999999999@s.whatsapp.net', id: 'original-3', fromMe: true }, text: '❤️' } } } };
    expect(parseIncomingEvolutionMessage(payload)).toBeNull();
    expect(parseIncomingEvolutionReaction(payload)).not.toBeNull();
  });

  it('associa reaction de grupo à conversa do grupo e ao participante', () => {
    expect(parseIncomingEvolutionReaction({
      event: 'messages.upsert', instance: 'cw-1',
      data: { key: { remoteJid: '120363024158769234@g.us', participant: '5511999999999@s.whatsapp.net', id: 'reaction-group', fromMe: false }, pushName: 'Ana', message: { reactionMessage: { key: { remoteJid: '120363024158769234@g.us', id: 'group-message', fromMe: true }, text: '👍' } } },
    })).toMatchObject({ chatType: 'group', sourceId: 'whatsapp:group:120363024158769234%40g%2Eus', senderId: 'participant:5511999999999@s.whatsapp.net' });
  });
});

describe('Evolution message mutations', () => {
  it('parses the v2 messages.edited webhook as an update, not a new message', () => {
    expect(parseIncomingEvolutionEdit({
      event: 'messages.edited', instance: 'cw-1', data: {
        key: { id: 'BAE5-original', remoteJid: '5511999999999@s.whatsapp.net', fromMe: true },
        editedMessage: { message: { extendedTextMessage: { text: 'Texto corrigido' } } },
      },
    })).toMatchObject({ instance: 'cw-1', targetMessageId: 'BAE5-original', remoteJid: '5511999999999@s.whatsapp.net', fromMe: true, content: 'Texto corrigido' });
  });

  it('also accepts the messages.update event exposed by Evolution v2.3.7', () => {
    expect(parseIncomingEvolutionEdit({
      event: 'messages.update', instance: 'cw-1', data: {
        key: { id: 'BAE5-original', remoteJid: '5511999999999@s.whatsapp.net', fromMe: true },
        editedMessage: { message: { conversation: 'Texto corrigido' } },
      },
    })).toMatchObject({ targetMessageId: 'BAE5-original', content: 'Texto corrigido' });
  });

  it('parses the v2 messages.delete webhook as a revoke operation', () => {
    expect(parseIncomingEvolutionRevoke({
      event: 'messages.delete', instance: 'cw-1', data: {
        key: { id: 'BAE5-original', remoteJid: '120363024158769234@g.us', fromMe: true, participant: '5511999999999@s.whatsapp.net' }, status: 'DELETED',
      },
    })).toMatchObject({ targetMessageId: 'BAE5-original', remoteJid: '120363024158769234@g.us', fromMe: true, participant: '5511999999999@s.whatsapp.net' });
  });
});

describe('Evolution group lifecycle', () => {
  it('normalizes the real v2 groups.upsert metadata and its participant registry', () => {
    expect(parseIncomingEvolutionGroupLifecycle({
      event: 'groups.upsert', instance: 'cw-1', data: [{ id: '120363024158769234@g.us', subject: 'Equipe Comercial', pictureUrl: 'https://cdn.example/group.jpg', participants: [{ id: '5511999999999@s.whatsapp.net', admin: 'admin' }] }],
    })).toMatchObject([{ groupJid: '120363024158769234@g.us', subject: 'Equipe Comercial', avatarUrl: 'https://cdn.example/group.jpg', participants: [{ jid: '5511999999999@s.whatsapp.net', admin: 'admin' }] }]);
  });

  it('normalizes participant updates without pretending unknown names exist', () => {
    expect(parseIncomingEvolutionGroupLifecycle({
      event: 'group-participants.update', instance: 'cw-1', data: { id: '120363024158769234@g.us', action: 'promote', participants: ['5511999999999@s.whatsapp.net'], participantsData: [{ jid: '5511999999999@s.whatsapp.net', phoneNumber: '5511999999999', name: 'Ana' }] },
    })).toMatchObject([{ participantAction: 'promote', participants: [{ jid: '5511999999999@s.whatsapp.net', phoneNumber: '5511999999999', name: 'Ana' }] }]);
  });
});
