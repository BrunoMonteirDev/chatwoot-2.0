import { describe, expect, it } from 'vitest';
import { canSearchSidebar, normalizeSidebarSearch, SIDEBAR_SEARCH_MIN_LENGTH } from './sidebarSearch';

describe('sidebar global search contract', () => {
  it('does not search short queries', () => {
    expect(canSearchSidebar('a')).toBe(false);
    expect(canSearchSidebar(' '.repeat(SIDEBAR_SEARCH_MIN_LENGTH))).toBe(false);
    expect(canSearchSidebar('jo')).toBe(true);
  });

  it('normalizes grouped conversations and contacts returned by the account search endpoint', () => {
    expect(normalizeSidebarSearch({ payload: {
      conversations: [{ id: 12, contact: { name: 'João' }, inbox: { name: 'Comercial' }, message: { content: 'Olá' } }],
      contacts: [{ id: 9, name: 'Maria', phone_number: '+55 (44) 99999-0000' }],
    } })).toEqual({
      conversations: [{ id: 12, name: 'João', inbox: 'Comercial', summary: 'Olá' }],
      contacts: [{ id: 9, name: 'Maria', phoneNumber: '+55 (44) 99999-0000' }],
    });
  });
});
