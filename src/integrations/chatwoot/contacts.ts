import type { AccountLabel, ContactNote, ContactProfile } from '../../domain/currentUser';
import { normalizeBrazilianPhone } from '../../../phone';
import { chatwootApiClient } from './client';
import { normalizeContact, normalizeContactNote, normalizeLabel } from './normalizers';
import type { ChatwootContactDto, ChatwootContactLabelsResponse, ChatwootContactNoteDto, ChatwootContactResponse, ChatwootContactsResponse, ChatwootLabelsResponse } from './types';

export interface ContactUpdate {
  name?: string;
  email?: string | null;
  phoneNumber?: string | null;
  identifier?: string | null;
  blocked?: boolean;
  companyName?: string | null;
  additionalAttributes?: Record<string, unknown>;
  customAttributes?: Record<string, unknown>;
}

export interface CreateContactParams {
  accountId: number;
  name: string;
  phoneNumber?: string;
  email?: string;
  inboxId?: number;
}

export interface ListContactsParams {
  accountId: number;
  page?: number;
  signal?: AbortSignal;
}

export interface ContactPage {
  contacts: ContactProfile[];
  totalCount: number;
  currentPage: number;
}

export type ContactBulkLabelAction = 'add' | 'remove';

const path = (accountId: number, contactId: number) => `/api/v1/accounts/${accountId}/contacts/${contactId}`;

export const contactService = {
  async list({ accountId, page = 1, signal }: ListContactsParams): Promise<ContactPage> {
    const query = new URLSearchParams({
      page: String(page),
      sort: '-last_activity_at',
      include_contact_inboxes: 'false',
    });
    const response = await chatwootApiClient.get<ChatwootContactsResponse>(
      `/api/v1/accounts/${accountId}/contacts?${query}`,
      { signal }
    );
    return {
      contacts: response.payload.map(normalizeContact),
      totalCount: response.meta.count,
      currentPage: response.meta.current_page,
    };
  },

  async get(accountId: number, contactId: number, signal?: AbortSignal): Promise<ContactProfile> {
    const response = await chatwootApiClient.get<ChatwootContactResponse>(path(accountId, contactId), { signal });
    return normalizeContact(response.payload);
  },

  async create({ accountId, name, phoneNumber, email, inboxId }: CreateContactParams): Promise<ContactProfile> {
    const response = await chatwootApiClient.post<{ payload: { contact: ChatwootContactDto } }>(
      `/api/v1/accounts/${accountId}/contacts`,
      {
        name,
        ...(phoneNumber ? { phone_number: normalizeBrazilianPhone(phoneNumber) } : {}),
        ...(email ? { email } : {}),
        ...(inboxId ? { inbox_id: inboxId } : {}),
      }
    );
    return normalizeContact(response.payload.contact);
  },

  async update(accountId: number, contact: ContactProfile, update: ContactUpdate): Promise<ContactProfile> {
    const additionalAttributes = {
      ...contact.additionalAttributes,
      ...(update.additionalAttributes || {}),
      ...(update.companyName === undefined ? {} : { company_name: update.companyName || null }),
    };
    const response = await chatwootApiClient.patch<ChatwootContactResponse>(path(accountId, contact.id), {
      ...(update.name === undefined ? {} : { name: update.name }),
      ...(update.email === undefined ? {} : { email: update.email }),
      ...(update.phoneNumber === undefined ? {} : { phone_number: update.phoneNumber === null ? null : normalizeBrazilianPhone(update.phoneNumber) }),
      ...(update.identifier === undefined ? {} : { identifier: update.identifier }),
      ...(update.blocked === undefined ? {} : { blocked: update.blocked }),
      additional_attributes: additionalAttributes,
      ...(update.customAttributes === undefined ? {} : { custom_attributes: update.customAttributes }),
    });
    return normalizeContact(response.payload);
  },

  async remove(accountId: number, contactId: number): Promise<void> {
    await chatwootApiClient.delete(path(accountId, contactId));
  },

  async listNotes(accountId: number, contactId: number, signal?: AbortSignal): Promise<ContactNote[]> {
    const response = await chatwootApiClient.get<ChatwootContactNoteDto[]>(`${path(accountId, contactId)}/notes`, { signal });
    return response.map(normalizeContactNote);
  },

  async createNote(accountId: number, contactId: number, content: string): Promise<ContactNote> {
    const response = await chatwootApiClient.post<ChatwootContactNoteDto>(`${path(accountId, contactId)}/notes`, { note: { content } });
    return normalizeContactNote(response);
  },

  async listAvailableLabels(accountId: number, signal?: AbortSignal): Promise<AccountLabel[]> {
    const response = await chatwootApiClient.get<ChatwootLabelsResponse>(`/api/v1/accounts/${accountId}/labels`, { signal });
    return response.payload.map(normalizeLabel);
  },

  async listLabels(accountId: number, contactId: number, signal?: AbortSignal): Promise<string[]> {
    const response = await chatwootApiClient.get<ChatwootContactLabelsResponse>(`${path(accountId, contactId)}/labels`, { signal });
    return response.payload;
  },

  async setLabels(accountId: number, contactId: number, labels: string[]): Promise<string[]> {
    const response = await chatwootApiClient.post<ChatwootContactLabelsResponse>(`${path(accountId, contactId)}/labels`, { labels });
    return response.payload;
  },

  async bulkUpdateLabels(accountId: number, contactIds: number[], action: ContactBulkLabelAction, labels: string[]): Promise<void> {
    await chatwootApiClient.post<void>(`/api/v1/accounts/${accountId}/bulk_actions`, {
      type: 'Contact',
      ids: contactIds,
      labels: { [action]: labels },
    });
  },
};
