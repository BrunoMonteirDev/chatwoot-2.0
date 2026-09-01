import { describe, expect, it } from 'vitest';
import type { ConversationSummary } from '../../domain/currentUser';
import { matchesConversationFilters, mergeFilteredRealtimeConversation, mergeRealtimeConversation } from './useConversations';

const conversation = (overrides: Partial<ConversationSummary> = {}): ConversationSummary => ({
  id: 1, inboxId: 7, channelType: null, contactName: 'Maria', contactId: 17, contactAvatarUrl: null, lastMessage: 'Olá', lastMessageByCurrentUser: false, isGroup: false,
  lastActivityAt: 100, updatedAt: 100, unreadCount: 0, status: 'open', priority: null, assigneeId: null, assigneeName: null, participantIds: [], teamId: null, teamName: null, labels: [], ...overrides,
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

describe('matchesConversationFilters', () => {
  it('combina time e múltiplas etiquetas com lógica AND', () => {
    const filters = { teamId: 9, labels: ['vip', 'urgente'] };
    expect(matchesConversationFilters(conversation({ teamId: 9, labels: ['vip', 'urgente', 'novo'] }), filters)).toBe(true);
    expect(matchesConversationFilters(conversation({ teamId: 8, labels: ['vip', 'urgente'] }), filters)).toBe(false);
    expect(matchesConversationFilters(conversation({ teamId: 9, labels: ['vip'] }), filters)).toBe(false);
  });
  it('remove ou insere pontualmente a conversa quando um evento realtime muda o filtro', () => {
    const filters = { teamId: 9, labels: ['vip'] };
    const current = [conversation({ id: 1, teamId: 9, labels: ['vip'] })];
    expect(mergeFilteredRealtimeConversation(current, conversation({ id: 1, teamId: 9, labels: [] }), 'todas', filters)).toEqual([]);
    expect(mergeFilteredRealtimeConversation([], conversation({ id: 2, teamId: 9, labels: ['vip'] }), 'todas', filters).map((item) => item.id)).toEqual([2]);
  });
});
