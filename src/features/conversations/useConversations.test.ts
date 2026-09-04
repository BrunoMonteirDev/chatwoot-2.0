import { describe, expect, it } from 'vitest';
import type { ConversationMessage, ConversationSummary } from '../../domain/currentUser';
import { matchesConversationFilters, mergeFilteredRealtimeConversation, mergeRealtimeConversation, mergeRealtimeMessage } from './useConversations';

const conversation = (overrides: Partial<ConversationSummary> = {}): ConversationSummary => ({
  id: 1, inboxId: 7, channelType: null, contactName: 'Maria', contactId: 17, contactAvatarUrl: null, lastMessage: 'Olá', lastMessageByCurrentUser: false, isGroup: false,
  lastActivityAt: 100, updatedAt: 100, unreadCount: 0, status: 'open', priority: null, assigneeId: null, assigneeName: null, participantIds: [], teamId: null, teamName: null, labels: [], ...overrides,
});

const message = (overrides: Partial<ConversationMessage> = {}): ConversationMessage => ({
  id: 11, conversationId: 1, kind: 'incoming', contentType: 'text', content: 'Nova mensagem',
  attachments: [], createdAt: 200, updatedAt: null, senderName: 'Maria',
  ...overrides,
});

describe('mergeRealtimeConversation', () => {
  it('atualiza e reordena a conversa, ignorando evento fora de ordem', () => {
    const current = [conversation({ id: 1, lastActivityAt: 100, updatedAt: 100 }), conversation({ id: 2, lastActivityAt: 150, updatedAt: 150 })];
    const merged = mergeRealtimeConversation(current, conversation({ id: 1, lastActivityAt: 200, updatedAt: 200, status: 'resolved' }), 'todas');
    expect(merged.map(item => item.id)).toEqual([1, 2]);
    expect(merged[0].status).toBe('resolved');
    expect(mergeRealtimeConversation(merged, conversation({ id: 1, updatedAt: 199, status: 'open' }), 'todas')[0].status).toBe('resolved');
  });
  it('não adiciona conversa criada fora da inbox selecionada', () => expect(mergeRealtimeConversation([], conversation({ inboxId: 8 }), '7')).toEqual([]));
  it('não deixa evento com mesmo timestamp e atividade anterior desfazer a conversa atual', () => {
    const current = [conversation({ updatedAt: 200, lastActivityAt: 220, labels: ['vip'] })];
    expect(mergeRealtimeConversation(current, conversation({ updatedAt: 200, lastActivityAt: 210, status: 'resolved', labels: [] }), 'todas')[0]).toMatchObject({ status: 'open', labels: ['vip'] });
  });
  it('não deixa uma resposta antiga regredir nome e avatar resolvidos', () => {
    const current = [conversation({ contactName: 'Ricardo Freitas', contactAvatarUrl: 'https://cdn/avatar.jpg' })];
    expect(mergeRealtimeConversation(current, conversation({ contactName: '+55 44 99563-9999', contactAvatarUrl: null, updatedAt: 101 }), 'todas')[0]).toMatchObject({ contactName: 'Ricardo Freitas', contactAvatarUrl: 'https://cdn/avatar.jpg' });
  });
});

describe('mergeRealtimeMessage', () => {
  it('atualiza a conversa aberta sem alterar qual conversa a rota mantém selecionada', () => {
    const selectedConversationId = 1;
    const result = mergeRealtimeMessage([conversation({ id: 1 })], message());

    expect(result[0]).toMatchObject({ id: 1, lastMessage: 'Nova mensagem' });
    expect(selectedConversationId).toBe(1);
  });

  it('atualiza unread e reordena outra conversa sem alterar a seleção, a rota ou rascunhos', () => {
    const selectedConversationId = 1;
    const route = '/app/accounts/1/conversations/1';
    const draft = 'resposta em andamento';
    const result = mergeRealtimeMessage(
      [conversation({ id: 1 }), conversation({ id: 2, lastActivityAt: 150 })],
      message({ conversationId: 2, content: 'Mensagem externa' }),
      3,
      300,
    );

    expect(result.map(item => item.id)).toEqual([2, 1]);
    expect(result[0]).toMatchObject({ unreadCount: 3, lastMessage: 'Mensagem externa' });
    expect(selectedConversationId).toBe(1);
    expect(route).toBe('/app/accounts/1/conversations/1');
    expect(draft).toBe('resposta em andamento');
  });

  it('não altera o estado local de criação quando uma conversa nova entra na lista', () => {
    const createContactForm = { open: true, name: 'Ana', phone: '+5511999999999' };
    const newConversationForm = { open: true, draft: 'Olá', attachments: ['arquivo.pdf'] };
    const result = mergeRealtimeConversation([], conversation({ id: 3, lastActivityAt: 300 }), 'todas');

    expect(result.map(item => item.id)).toEqual([3]);
    expect(createContactForm).toEqual({ open: true, name: 'Ana', phone: '+5511999999999' });
    expect(newConversationForm).toEqual({ open: true, draft: 'Olá', attachments: ['arquivo.pdf'] });
  });
});

describe('matchesConversationFilters', () => {
  it('combina time e múltiplas etiquetas com lógica AND', () => {
    const filters = { teamId: 9, labels: ['vip', 'urgente'] };
    expect(matchesConversationFilters(conversation({ teamId: 9, labels: ['vip', 'urgente', 'novo'] }), 'todas', filters)).toBe(true);
    expect(matchesConversationFilters(conversation({ teamId: 8, labels: ['vip', 'urgente'] }), 'todas', filters)).toBe(false);
    expect(matchesConversationFilters(conversation({ teamId: 9, labels: ['vip'] }), 'todas', filters)).toBe(false);
  });
  it('isola a inbox selecionada junto com time e etiquetas', () => {
    const filters = { teamId: 9, labels: ['vip'] };
    expect(matchesConversationFilters(conversation({ inboxId: 7, teamId: 9, labels: ['vip'] }), '7', filters)).toBe(true);
    expect(matchesConversationFilters(conversation({ inboxId: 8, teamId: 9, labels: ['vip'] }), '7', filters)).toBe(false);
  });
  it('remove ou insere pontualmente a conversa quando um evento realtime muda o filtro', () => {
    const filters = { teamId: 9, labels: ['vip'] };
    const current = [conversation({ id: 1, teamId: 9, labels: ['vip'] })];
    expect(mergeFilteredRealtimeConversation(current, conversation({ id: 1, teamId: 9, labels: [] }), 'todas', filters)).toEqual([]);
    expect(mergeFilteredRealtimeConversation([], conversation({ id: 2, teamId: 9, labels: ['vip'] }), 'todas', filters).map((item) => item.id)).toEqual([2]);
  });
  it('remove uma conversa realtime que deixa a inbox selecionada', () => {
    const current = [conversation({ id: 1, inboxId: 7 })];
    expect(mergeFilteredRealtimeConversation(current, conversation({ id: 1, inboxId: 8, updatedAt: 101 }), '7', {})).toEqual([]);
  });
});
