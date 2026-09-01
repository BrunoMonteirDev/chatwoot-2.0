import { authSession } from '../chatwoot/authSession';

export class BridgeAuthenticationError extends Error {}

export const authenticatedBridgeHeaders = (accountId?: number | null) => {
  const session = authSession.get();
  if (!session) throw new BridgeAuthenticationError('Faça login novamente para concluir esta operação.');
  return {
    'Content-Type': 'application/json',
    'access-token': session.accessToken,
    'token-type': session.tokenType,
    client: session.client,
    expiry: session.expiry,
    uid: session.uid,
    ...(accountId ? { 'x-chatwoot-account-id': String(accountId) } : {}),
  };
};
