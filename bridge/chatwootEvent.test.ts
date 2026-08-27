import { describe, expect, it } from 'vitest';
import { parseOutgoingChatwootMessage } from './chatwootEvent';

const payload = {
  event: 'message_created', id: 42, message_type: 'outgoing', private: false, content_type: 'text', content: 'Olá, como posso ajudar?',
  account: { id: 9 },
  conversation: { id: 31, inbox_id: 7, contact_inbox: { source_id: 'whatsapp:5511999999999' } },
};

describe('parseOutgoingChatwootMessage', () => {
  it('aceita somente uma mensagem textual outgoing para contato WhatsApp', () => {
    expect(parseOutgoingChatwootMessage(payload)).toEqual({ accountId: 9, messageId: 42, conversationId: 31, inboxId: 7, sourceId: 'whatsapp:5511999999999', number: '5511999999999', chatType: 'private', content: 'Olá, como posso ajudar?', attachments: [] });
  });

  it('usa o telefone do contato quando a inbox tem source id interno do Chatwoot', () => {
    expect(parseOutgoingChatwootMessage({
      ...payload,
      conversation: {
        inbox_id: 7,
        id: 31,
        contact_inbox: { source_id: '7c20c5f0-6f02-4d7e-a3c5-e3d4ad1bcb7d' },
        meta: { sender: { phone_number: '+55 (11) 99999-9999' } },
      },
    })).toEqual({ accountId: 9, messageId: 42, conversationId: 31, inboxId: 7, sourceId: '7c20c5f0-6f02-4d7e-a3c5-e3d4ad1bcb7d', number: '5511999999999', chatType: 'private', content: 'Olá, como posso ajudar?', attachments: [] });
  });

  it('nunca encaminha notas privadas ou mensagens incoming', () => {
    expect(parseOutgoingChatwootMessage({ ...payload, private: true })).toBeNull();
    expect(parseOutgoingChatwootMessage({ ...payload, message_type: 'incoming' })).toBeNull();
  });

  it('não reenvia ao WhatsApp uma mensagem que veio do próprio celular', () => {
    expect(parseOutgoingChatwootMessage({ ...payload, source_id: 'evolution:BAE5' })).toBeNull();
    expect(parseOutgoingChatwootMessage({ ...payload, source_id: 'meta:wamid.1' })).toBeNull();
    expect(parseOutgoingChatwootMessage({ ...payload, source_id: 'waha:ABC' })).toBeNull();
  });

  it('aceita mídia sem texto e preserva seus metadados', () => {
    expect(parseOutgoingChatwootMessage({
      ...payload, content: '', content_type: 'text',
      attachments: [{ data_url: '/rails/active_storage/blobs/arquivo', file_type: 'audio', content_type: 'audio/ogg', fallback_title: 'audio.ogg' }],
    })).toMatchObject({
      content: '',
      attachments: [{ url: '/rails/active_storage/blobs/arquivo', fileType: 'audio', contentType: 'audio/ogg', fileName: 'audio.ogg' }],
    });
  });

  it('encaminha o identificador externo ao responder uma mensagem', () => {
    expect(parseOutgoingChatwootMessage({
      ...payload,
      // Chatwoot's InReplyToMessageBuilder derives this from the original
      // message source_id after the frontend posts its internal in_reply_to.
      content_attributes: { in_reply_to: 1234, in_reply_to_external_id: 'evolution:BAE5-original' },
    })).toMatchObject({ quotedMessageId: 'BAE5-original' });
  });

  it('preserva o external ID Meta para o roteador decidir o reply pelo transport alvo', () => {
    expect(parseOutgoingChatwootMessage({
      ...payload,
      content_attributes: { in_reply_to: 1234, in_reply_to_external_id: 'meta:wamid.original' },
    })).toMatchObject({ quotedExternalId: 'meta:wamid.original' });
  });

  it('reconhece grupo por sua identidade própria, sem fingir que é telefone', () => {
    expect(parseOutgoingChatwootMessage({
      ...payload,
      conversation: { id: 31, inbox_id: 7, contact_inbox: { source_id: 'whatsapp:group:120363024158769234%40g%2Eus' } },
    })).toMatchObject({ number: '120363024158769234@g.us', chatType: 'group' });
  });

  it('envia normalmente quando uma referência interna não possui ID externo', () => {
    const event = parseOutgoingChatwootMessage({
      ...payload,
      content_attributes: { in_reply_to: 1234 },
    });
    expect(event).toMatchObject({ content: 'Olá, como posso ajudar?' });
    expect(event).not.toHaveProperty('quotedMessageId');
  });
});
