import { chatwootApiClient } from '../../integrations/chatwoot/client';

export type SidebarSearchConversation = {
  id: number;
  name: string;
  inbox: string | null;
  summary: string | null;
};

export type SidebarSearchContact = {
  id: number;
  name: string;
  phoneNumber: string | null;
};

export type SidebarSearchResults = {
  conversations: SidebarSearchConversation[];
  contacts: SidebarSearchContact[];
};

type SearchResponse = {
  payload?: {
    conversations?: Array<{
      id?: number;
      contact?: { name?: string };
      inbox?: { name?: string };
      message?: { content?: string };
    }>;
    contacts?: Array<{ id?: number; name?: string; phone_number?: string | null }>;
  };
};

export const SIDEBAR_SEARCH_MIN_LENGTH = 2;
export const SIDEBAR_SEARCH_DEBOUNCE_MS = 300;

export const canSearchSidebar = (query: string) => query.trim().length >= SIDEBAR_SEARCH_MIN_LENGTH;

export const normalizeSidebarSearch = (response: SearchResponse): SidebarSearchResults => ({
  conversations: (response.payload?.conversations || [])
    .filter((conversation): conversation is Required<Pick<SidebarSearchConversation, 'id'>> & typeof conversation => Number.isInteger(conversation.id))
    .map(conversation => ({
      id: conversation.id!,
      name: conversation.contact?.name || 'Contato sem nome',
      inbox: conversation.inbox?.name || null,
      summary: conversation.message?.content || null,
    })),
  contacts: (response.payload?.contacts || [])
    .filter((contact): contact is Required<Pick<SidebarSearchContact, 'id'>> & typeof contact => Number.isInteger(contact.id))
    .map(contact => ({ id: contact.id!, name: contact.name || 'Contato sem nome', phoneNumber: contact.phone_number || null })),
});

export const sidebarSearchService = {
  async search(accountId: number, query: string, signal?: AbortSignal): Promise<SidebarSearchResults> {
    const params = new URLSearchParams({ q: query.trim(), page: '1' });
    const response = await chatwootApiClient.get<SearchResponse>(`/api/v1/accounts/${accountId}/search?${params}`, { signal });
    return normalizeSidebarSearch(response);
  },
};
