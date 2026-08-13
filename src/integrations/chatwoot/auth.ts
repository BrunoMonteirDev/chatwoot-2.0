import { chatwootApiClient } from './client';
import type { AuthCredentials, ChatwootLoginResponse, ChatwootProfileDto, MfaRequiredResponse, MfaVerificationCredentials } from './types';

export const authService = {
  login(credentials: AuthCredentials): Promise<ChatwootLoginResponse | MfaRequiredResponse> {
    return chatwootApiClient.post('/auth/sign_in', credentials);
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
  setActiveAccount(accountId: number): Promise<void> {
    return chatwootApiClient.put('/api/v1/profile/set_active_account', { profile: { account_id: accountId } });
  },
  async logout(): Promise<void> {
    await chatwootApiClient.delete('/auth/sign_out');
  },
};
