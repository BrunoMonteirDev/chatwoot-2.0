import type { CannedResponse } from '../../domain/currentUser';
import { chatwootApiClient } from './client';
import { normalizeCannedResponse } from './normalizers';
import type { ChatwootCannedResponseDto } from './types';

export interface ListCannedResponsesParams {
  accountId: number;
  search?: string;
  signal?: AbortSignal;
}

export const cannedResponseService = {
  async list({ accountId, search, signal }: ListCannedResponsesParams): Promise<CannedResponse[]> {
    const query = search?.trim() ? `?${new URLSearchParams({ search: search.trim() })}` : '';
    const response = await chatwootApiClient.get<ChatwootCannedResponseDto[]>(
      `/api/v1/accounts/${accountId}/canned_responses${query}`,
      { signal }
    );
    return response.map(normalizeCannedResponse);
  },
};
