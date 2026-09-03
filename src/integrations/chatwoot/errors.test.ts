import { describe, expect, it } from 'vitest';
import { ChatwootApiError, errorMessageForUser } from './errors';

describe('hybrid delivery errors', () => {
  it('explains that ambiguous Meta delivery does not fall back to WAHA', () => {
    const error = new ChatwootApiError({ status: 422, statusText: 'Unprocessable Entity', body: { error: 'Meta delivery result is uncertain; WAHA fallback was not attempted' }, message: 'request failed' });
    expect(errorMessageForUser(error)).toContain('não foi usado para evitar possível duplicação');
  });

  it('explains that an unavailable WAHA session cannot send', () => {
    const error = new ChatwootApiError({ status: 422, statusText: 'Unprocessable Entity', body: { error: 'WAHA session is not configured for this inbox' }, message: 'request failed' });
    expect(errorMessageForUser(error)).toContain('sessão WAHA está indisponível');
  });
});
