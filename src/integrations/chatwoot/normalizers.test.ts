import { describe, expect, it } from 'vitest';
import { normalizeConversation, normalizeInbox, normalizeMessage, normalizeProfile } from './normalizers';

describe('normalizeProfile', () => {
  it('converte o DTO real de profile em um modelo seguro para a UI', () => {
    const profile = normalizeProfile({
      id: 42, name: 'Ana Agente', display_name: 'Ana', email: 'ana@example.test', uid: 'ana@example.test',
      avatar_url: null, pubsub_token: 'redacted', account_id: 7, role: 'administrator',
      accounts: [{ id: 7, name: 'Conta principal', status: 'active', onboarding_step: null, active_at: 1, role: 'administrator', permissions: ['conversation_manage'], availability: 'online', availability_status: 'online', auto_offline: false, api_and_webhooks: false }],
    });

    expect(profile).toMatchObject({ id: 42, displayName: 'Ana', activeAccountId: 7 });
    expect(profile.accounts[0]).toEqual({ id: 7, name: 'Conta principal', role: 'administrator', permissions: ['conversation_manage'], availability: 'online' });
  });
});

describe('normalizeConversation', () => {
  it('preserva display id e os campos necessários para a lista', () => {
    expect(normalizeConversation({ id: 4, inbox_id: 1, status: 'pending', priority: null, unread_count: 3, last_activity_at: 123, labels: [], messages: [{ content: 'Retorno', message_type: 1 }], meta: { sender: { name: 'João' }, channel: 'Channel::Email' } }))
      .toMatchObject({ id: 4, contactName: 'João', lastMessage: 'Retorno', lastMessageByCurrentUser: true, unreadCount: 3 });
  });

  it('identifica um grupo pela metadata pública do contato', () => {
    expect(normalizeConversation({ id: 5, inbox_id: 1, status: 'open', priority: null, unread_count: 0, last_activity_at: 123, labels: [], messages: [], meta: { sender: { name: 'Equipe', additional_attributes: { whatsapp_chat_type: 'group' } } } }).isGroup).toBe(true);
  });
});

describe('normalizeInbox', () => {
  it('seleciona somente campos seguros do serializer de inbox', () => {
    expect(normalizeInbox({ id: 9, name: 'Suporte', avatar_url: 'https://cdn.example.test/avatar.png', channel_type: 'Channel::Whatsapp' }))
      .toEqual({ id: 9, name: 'Suporte', avatarUrl: 'https://cdn.example.test/avatar.png', channelType: 'Channel::Whatsapp', channelId: null, webhookUrl: null, inboxIdentifier: null, additionalAttributes: {} });
  });

  it('preserva additional_attributes do Channel::Api para a identificação Evolution após recarregar', () => {
    expect(normalizeInbox({ id: 10, name: 'Suporte', avatar_url: null, channel_type: 'Channel::Api', additional_attributes: { evolution_provider: 'evolution', evolution_instance_name: 'cw-suporte', evolution_instance_id: 'instance-10' } }))
      .toMatchObject({ additionalAttributes: { evolution_provider: 'evolution', evolution_instance_name: 'cw-suporte', evolution_instance_id: 'instance-10' } });
  });
});

describe('normalizeMessage', () => {
  it('distingue eventos de atividade de mensagens recebidas', () => {
    expect(normalizeMessage({ id: 1, conversation_id: 9, message_type: 2, content_type: 'text', private: false, created_at: 10 }))
      .toMatchObject({ kind: 'activity', content: '', attachments: [] });
  });

  it('preserva echo_id para reconciliar uma mensagem otimista', () => {
    expect(normalizeMessage({ id: 2, conversation_id: 9, message_type: 1, content_type: 'text', private: false, created_at: 10, echo_id: 'local-echo' }))
      .toMatchObject({ kind: 'outgoing', echoId: 'local-echo' });
  });
});
