import { chatwootApiClient } from './client';
import { ChatwootApiError } from './errors';
import type { AuthCredentials, ChatwootLoginResponse, ChatwootProfileDto, MfaRequiredResponse, MfaVerificationCredentials, SessionsLimitReachedResponse } from './types';

const isSessionsLimitReached = (body: unknown): body is SessionsLimitReachedResponse => {
  if (!body || typeof body !== 'object') return false;
  const candidate = body as Partial<SessionsLimitReachedResponse>;
  return candidate.sessions_limit_reached === true && Array.isArray(candidate.sessions);
};

export const authService = {
  async login(credentials: AuthCredentials, revokeSessionId?: number | 'all'): Promise<ChatwootLoginResponse | MfaRequiredResponse | SessionsLimitReachedResponse> {
    try {
      return await chatwootApiClient.post('/auth/sign_in', {
        ...credentials,
        ...(revokeSessionId === 'all' ? { revoke_all_sessions: true } : {}),
        ...(typeof revokeSessionId === 'number' ? { revoke_session_id: revokeSessionId } : {}),
      });
    } catch (cause) {
      if (cause instanceof ChatwootApiError && cause.status === 409 && isSessionsLimitReached(cause.body)) {
        return cause.body;
      }
      throw cause;
    }
  },
  verifyMfa({ mfaToken, otpCode, backupCode }: MfaVerificationCredentials): Promise<ChatwootLoginResponse> {
    return chatwootApiClient.post('/auth/sign_in', {
      mfa_token: mfaToken,
      ...(otpCode ? { otp_code: otpCode } : {}),
      ...(backupCode ? { backup_code: backupCode } : {}),
    });
  },
  validateSession(): Promise<unknown> {
    return chatwootApiClient.get('/auth/validate_token');
  },
  getProfile(): Promise<ChatwootProfileDto> {
    return chatwootApiClient.get('/api/v1/profile');
  },
  updateProfile(profile: Record<string, unknown>): Promise<ChatwootProfileDto> {
    return chatwootApiClient.patch('/api/v1/profile', { profile });
  },
  resetAccessToken(): Promise<ChatwootProfileDto> {
    return chatwootApiClient.post('/api/v1/profile/reset_access_token');
  },
  setActiveAccount(accountId: number): Promise<void> {
    return chatwootApiClient.put('/api/v1/profile/set_active_account', { profile: { account_id: accountId } });
  },
  async logout(): Promise<void> {
    await chatwootApiClient.delete('/auth/sign_out');
  },
};
