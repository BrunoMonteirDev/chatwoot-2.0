import { describe, expect, it } from 'vitest';
import { normalizeWahaMessageId, parseIncomingWahaGroupLifecycle, parseIncomingWahaMessage, parseIncomingWahaMutation, parseIncomingWahaReaction, parseWahaHistoryMessage, parseWahaWebhook } from './wahaEvent';

describe('WAHA webhook normalization', () => {
  it('creates a track id without retaining raw content', () => {
    const event = parseWahaWebhook({ event: 'message', session: 'empresa', payload: { id: 'ABC', chatId: '5511999999999@c.us', fromMe: true, body: 'private content' } });
    expect(event).toMatchObject({ transport: 'waha', event: 'message', category: 'message', session: 'empresa', externalId: 'ABC', chatId: '5511999999999@c.us', fromMe: true });
    expect(event.trackId).toMatch(/^trk_/);
    expect(event).not.toHaveProperty('rawPayload');
  });

  it('preserva session.status para que o bridge persista a conexão da inbox', () => {
    expect(parseWahaWebhook({ event: 'session.status', session: 'empresa', payload: { status: 'WORKING' } })).toMatchObject({ event: 'session.status', session: 'empresa', category: 'session' });
  });

  it('normaliza texto, LID, grupo e mídia sem depender do payload bruto', () => {
    expect(parseIncomingWahaMessage({ event: 'message', session: 'empresa', payload: { id: 'm1', from: '5511999999999@s.whatsapp.net', chatId: '5511999999999@c.us', body: 'oi', timestamp: 1 } })).toMatchObject({ externalId: 'm1', sourceId: 'whatsapp:551199999999', phoneNumber: '+551199999999', chatType: 'private' });
    expect(parseIncomingWahaMessage({ event: 'message.any', session: 'empresa', payload: { id: 'm2', from: 'abc@lid', chatId: 'abc@lid', fromMe: false, hasMedia: true, media: { data: 'YQ==', mimetype: 'image/jpeg' } } })).toMatchObject({ lid: 'abc', sourceId: 'whatsapp:lid:abc', media: { kind: 'image' } });
    expect(parseIncomingWahaMessage({ event: 'message', session: 'empresa', payload: { id: 'm3', from: '120@g.us', chatId: '120@g.us', participant: '5511@c.us', body: 'grupo' } })).toMatchObject({ chatType: 'group', sourceId: 'whatsapp:group:120@g.us', participantJid: '5511@c.us' });
    expect(parseIncomingWahaMessage({ event: 'message', session: 'empresa', payload: { id: 'm4', from: '120@g.us', chatId: '120@g.us', pushName: 'Ana', subject: 'Vendas', body: 'grupo' } })).toMatchObject({ chatType: 'group', name: 'Vendas', groupName: 'Vendas', participantName: 'Ana' });
  });

  it('identifica alvo real de reaction, edit e revoke', () => {
    expect(parseIncomingWahaReaction({ event: 'message.reaction', session: 'empresa', payload: { chatId: '55@c.us', msgId: 'target', reaction: { text: '👍' } } })).toMatchObject({ targetMessageId: 'target', emoji: '👍' });
    expect(parseIncomingWahaMutation({ event: 'message.revoked', session: 'empresa', payload: { chatId: '55@c.us', revokedMessageId: 'target' } })).toMatchObject({ targetMessageId: 'target' });
  });

  it('usa a chave da mensagem, e não o JID do evento, como identidade WAHA', () => {
    expect(normalizeWahaMessageId('true_5511999999999@c.us_3EB01234')).toBe('3EB01234');
    expect(normalizeWahaMessageId('true_123456@lid_3EB01234')).toBe('3EB01234');
    expect(parseIncomingWahaMessage({ event: 'message.any', session: 'empresa', payload: { id: 'true_123@lid_3EB01234', from: '123@lid', chatId: '123@lid' } })).toMatchObject({ externalId: '3EB01234' });
  });

  it('normaliza lifecycle group.v2 sem transformar o grupo em contato individual', () => {
    expect(parseIncomingWahaGroupLifecycle({ event: 'group.v2.participants', session: 'empresa', payload: { groupId: '120@g.us', action: 'promote', participants: [{ id: '5511999999999@c.us', name: 'Ana', role: 'admin' }] } })).toMatchObject({ session: 'empresa', groupId: '120@g.us', participantAction: 'promote', participants: [{ jid: '5511999999999@c.us', phoneNumber: '5511999999999', name: 'Ana', admin: 'admin' }] });
    expect(parseIncomingWahaGroupLifecycle({ event: 'group.v2.update', session: 'empresa', payload: { group: { id: '120@g.us', subject: 'Vendas', description: 'Equipe' } } })).toMatchObject({ groupId: '120@g.us', subject: 'Vendas', description: 'Equipe' });
  });

  it('reutiliza a normalização realtime para registros históricos GOWS', () => {
    expect(parseWahaHistoryMessage('empresa', { id: 'false_55119999@c.us_3EB0H', from: '55119999@c.us', chatId: '55119999@c.us', body: 'antiga', timestamp: 1727745026, replyTo: { id: '3EB0Q', body: 'citada' } })).toMatchObject({
      externalId: '3EB0H', session: 'empresa', sourceId: 'whatsapp:55119999', content: 'antiga', quotedMessageId: '3EB0Q', fromMe: false,
    });
  });

  it('normaliza encaminhamento do contexto real GOWS para texto e mídia', () => {
    expect(parseIncomingWahaMessage({ event: 'message', session: 'empresa', payload: { id: 'forwarded', chatId: '5511999999999@c.us', from: '5511999999999@c.us', body: 'encaminhada', _data: { Message: { documentMessage: { contextInfo: { isForwarded: true, forwardingScore: 2 } } } } } })).toMatchObject({ isForwarded: true, forwardingScore: 2 });
  });

  it('mantém mensagens próprias do histórico GOWS mesmo quando `to` vem vazio', () => {
    expect(parseWahaHistoryMessage('empresa', { id: 'true_123@lid_3EB0OWN', from: '123@lid', to: null, fromMe: true, body: 'enviada pelo aparelho' }))
      .toMatchObject({ externalId: '3EB0OWN', chatId: '123@lid', remoteJid: '123@lid', fromMe: true, lid: '123', content: 'enviada pelo aparelho' });
  });
});
