import { describe, expect, it } from 'vitest';
import { parseMetaWebhook } from './metaEvent';

const webhook = (message: Record<string, unknown>) => ({
  object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'messages', value: {
    messaging_product: 'whatsapp', metadata: { phone_number_id: 'phone-1' }, contacts: [{ wa_id: '5511999999999', profile: { name: 'Ana' } }], messages: [message],
  } }] }],
});

describe('parseMetaWebhook', () => {
  it('normaliza texto, reply e o namespace Meta', () => {
    const parsed = parseMetaWebhook(webhook({ id: 'wamid.in-1', from: '5511999999999', timestamp: '1710000000', type: 'text', text: { body: 'Olá' }, context: { id: 'wamid.original' } }));
    expect(parsed.messages).toEqual([expect.objectContaining({ phoneNumberId: 'phone-1', messageId: 'wamid.in-1', sourceId: 'whatsapp:5511999999999', content: 'Olá', quotedMessageId: 'wamid.original' })]);
  });

  it.each([
    ['image', { id: 'media-image', mime_type: 'image/jpeg', caption: 'Foto' }],
    ['audio', { id: 'media-audio', mime_type: 'audio/ogg' }],
    ['video', { id: 'media-video', mime_type: 'video/mp4' }],
    ['document', { id: 'media-document', mime_type: 'application/pdf', filename: 'proposta.pdf' }],
  ])('normaliza mídia %s', (type, value) => {
    const parsed = parseMetaWebhook(webhook({ id: `wamid.${type}`, from: '5511999999999', type, [type]: value }));
    expect(parsed.messages[0]).toMatchObject({ media: { kind: type, mediaId: `media-${type}` } });
  });

  it('extrai status entregue, lido e falho pelo wamid', () => {
    const payload = { object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'messages', value: { metadata: { phone_number_id: 'phone-1' }, statuses: [
      { id: 'wamid.delivered', status: 'delivered' }, { id: 'wamid.read', status: 'read' }, { id: 'wamid.failed', status: 'failed', errors: [{ title: 'Janela expirada' }] },
    ] } }] }] };
    expect(parseMetaWebhook(payload).statuses).toEqual([
      { phoneNumberId: 'phone-1', messageId: 'wamid.delivered', status: 'delivered', error: null },
      { phoneNumberId: 'phone-1', messageId: 'wamid.read', status: 'read', error: null },
      { phoneNumberId: 'phone-1', messageId: 'wamid.failed', status: 'failed', error: 'Janela expirada' },
    ]);
  });

  it('extrai reaction sem criar uma bolha de mensagem', () => {
    const parsed = parseMetaWebhook(webhook({ id: 'wamid.reaction-event', from: '5511999999999', type: 'reaction', reaction: { message_id: 'wamid.target', emoji: '😂' } }));
    expect(parsed.messages).toEqual([]);
    expect(parsed.reactions).toEqual([{ phoneNumberId: 'phone-1', eventId: 'wamid.reaction-event', targetMessageId: 'wamid.target', senderId: '5511999999999', emoji: '😂' }]);
  });

  it('reconhece history sem tratá-lo como mensagem realtime e preserva identidade, tempo, reply e mídia', () => {
    const payload = { object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'history', value: { metadata: { phone_number_id: 'phone-1', display_phone_number: '5511999999999' }, history: [{ metadata: { phase: 1, chunk_order: 2, progress: 55 }, threads: [{ id: '5511988888888', messages: [
      { id: 'wamid.history-1', from: '5511999999999', to: '5511988888888', timestamp: '1710000001', type: 'image', image: { id: 'media-1', mime_type: 'image/jpeg', caption: 'Arquivo' }, context: { id: 'wamid.quoted' }, history_context: { status: 'READ' } },
    ] }] }] } }]}] };
    const parsed = parseMetaWebhook(payload);
    expect(parsed.messages).toEqual([]);
    expect(parsed.history).toEqual([expect.objectContaining({ phoneNumberId: 'phone-1', phase: 1, chunkOrder: 2, progress: 55, declined: false, messages: [expect.objectContaining({ sourceId: 'meta:wamid.history-1', timestamp: 1710000001, direction: 'outgoing', quotedMessageId: 'wamid.quoted', media: { kind: 'image', mediaId: 'media-1', mimetype: 'image/jpeg', fileName: null } })] })]);
  });

  it('mantém recusa de histórico fora do pipeline realtime', () => {
    const payload = { object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'history', value: { metadata: { phone_number_id: 'phone-1' }, history: [{ errors: [{ code: 2593109 }] }] } }] }] };
    expect(parseMetaWebhook(payload).history).toEqual([expect.objectContaining({ phoneNumberId: 'phone-1', declined: true, messages: [] })]);
  });

  it('identifica echoes do WhatsApp Business App e estados oficiais de offboarding', () => {
    const payload = { object: 'whatsapp_business_account', entry: [
      { id: 'waba-1', changes: [{ field: 'account_update', value: { event: 'ACCOUNT_OFFBOARDED' } }] },
      { changes: [{ field: 'smb_message_echoes', value: { metadata: { phone_number_id: 'phone-1' }, message_echoes: [{ id: 'wamid.app-1', to: '5511999999999', timestamp: '1710000002', type: 'text', text: { body: 'Enviada pelo app' } }] } }] },
    ] };
    const parsed = parseMetaWebhook(payload);
    expect(parsed.accountUpdates).toEqual([{ wabaId: 'waba-1', state: 'offboarded' }]);
    expect(parsed.businessAppEchoes).toEqual([expect.objectContaining({ messageId: 'wamid.app-1', origin: 'business_app', content: 'Enviada pelo app' })]);
  });
});
