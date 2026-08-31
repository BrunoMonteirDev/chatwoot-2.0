import type express from 'express';
import { config } from './config.js';

const SESSION_HEADERS = ['access-token', 'token-type', 'client', 'expiry', 'uid'] as const;

type ChatwootProfile = { account_id?: unknown; role?: unknown; accounts?: Array<{ id?: unknown; role?: unknown }> };
const requestedAccountId = (request: express.Request) => {
  const value = request.header('x-chatwoot-account-id') || request.query.accountId || (request.body && typeof request.body === 'object' ? (request.body as { accountId?: unknown }).accountId : undefined);
  const accountId = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : null;
  return Number.isInteger(accountId) && accountId! > 0 ? accountId : null;
};

// Reuse the exact browser session only after the route has authenticated it.
// This is useful for account-scoped administrative checks in development too,
// where a service-account token may not have been bootstrapped yet.
export const chatwootSessionHeaders = (request: express.Request) => {
  // The bridge reaches Rails through Docker HTTP while the public request is
  // HTTPS through Caddy. Preserve that scheme so FORCE_SSL does not redirect
  // the token validation request to an unavailable internal TLS endpoint.
  const headers = new Headers({ Accept: 'application/json', 'X-Forwarded-Proto': 'https', 'X-Forwarded-Ssl': 'on' });
  for (const name of SESSION_HEADERS) {
    const value = request.header(name);
    if (!value) return null;
    headers.set(name, value);
  }
  return headers;
};

// Administrative browser calls are authenticated against Chatwoot on every
// sensitive operation. The bridge never accepts a shared browser secret.
export const requireChatwootSession = async (request: express.Request, administrator = false) => {
  const headers = chatwootSessionHeaders(request);
  if (!headers) return false;
  try {
    const response = await fetch(`${config.chatwootBaseUrl}/api/v1/profile`, { headers });
    if (!response.ok) return false;
    const profile = await response.json() as ChatwootProfile;
    const accountId = requestedAccountId(request) ?? config.chatwootDefaultAccountId;
    if (!accountId) return false;
    const account = profile.accounts?.find(item => item.id === accountId);
    const role = account?.role || (profile.account_id === accountId ? profile.role : null);
    return !administrator || role === 'administrator';
  } catch {
    return false;
  }
};

export const bridgeCors = (request: express.Request, response: express.Response, next: express.NextFunction) => {
  const origin = request.header('origin');
  if (origin && config.allowedOrigins.includes(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Access-Token, Token-Type, Client, Expiry, Uid');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }
  if (request.method === 'OPTIONS') return response.sendStatus(origin && config.allowedOrigins.includes(origin) ? 204 : 403);
  return next();
};
