import { describe, expect, it } from 'vitest';
import { parseIncomingEvolutionMessage } from './evolutionEvent';

describe('parseIncomingEvolutionMessage', () => {
  it('normaliza texto incoming do evento messages.upsert', () => {
    expect(parseIncomingEvolutionMessage({ event: 'messages.upsert', instance: 'cw-1-vendas', data: { key: { remoteJid: '5511999999999@s.whatsapp.net', id: 'BAE5', fromMe: false }, pushName: 'Ana', message: { conversation: 'Olá' } } }))
      .toEqual({ instance: 'cw-1-vendas', messageId: 'BAE5', sourceId: 'whatsapp:5511999999999', phoneNumber: '+5511999999999', fromMe: false, name: 'Ana', content: 'Olá' });
  });

  it('usa extendedTextMessage e identifica mensagens enviadas pelo próprio número', () => {
    expect(parseIncomingEvolutionMessage({ event: 'messages.upsert', instance: 'cw-1', data: { key: { remoteJid: '5511999999999@s.whatsapp.net', id: 'id', fromMe: false }, message: { extendedTextMessage: { text: 'Legenda' } } } })?.content).toBe('Legenda');
    expect(parseIncomingEvolutionMessage({ event: 'messages.upsert', instance: 'cw-1', data: { key: { remoteJid: '5511999999999@s.whatsapp.net', id: 'id', fromMe: true }, message: { conversation: 'Enviar pelo celular' } } })?.fromMe).toBe(true);
  });

  it('usa o destinatário, e não senderPn próprio, em mensagem enviada pelo aparelho', () => {
    expect(parseIncomingEvolutionMessage({
      event: 'messages.upsert', instance: 'cw-1',
      data: { key: { remoteJid: '5511988887777@s.whatsapp.net', senderPn: '5511977776666@s.whatsapp.net', id: 'mobile-id', fromMe: true }, message: { conversation: 'Enviado pelo celular' } },
    })).toMatchObject({ sourceId: 'whatsapp:5511988887777', phoneNumber: '+5511988887777', fromMe: true });
  });

  it('usa senderPn como telefone canônico e mantém o LID como alias', () => {
    expect(parseIncomingEvolutionMessage({
      event: 'messages.upsert', instance: 'cw-1',
      data: { key: { remoteJid: '58497538457613@lid', senderPn: '5511999999999@s.whatsapp.net', id: 'lid-message', fromMe: false }, message: { conversation: 'Oi' } },
    })).toEqual({
      instance: 'cw-1', messageId: 'lid-message', sourceId: 'whatsapp:5511999999999', phoneNumber: '+5511999999999', lid: '58497538457613', fromMe: false, name: '5511999999999', content: 'Oi',
    });
  });

  it('aceita LID sem telefone e o mantém como fonte temporária', () => {
    expect(parseIncomingEvolutionMessage({
      event: 'messages.upsert', instance: 'cw-1',
      data: { key: { remoteJid: '58497538457613@lid', id: 'lid-only', fromMe: false }, message: { conversation: 'Oi' } },
    })).toMatchObject({ sourceId: 'whatsapp:lid:58497538457613', lid: '58497538457613' });
  });
});
