import type express from 'express';
import { config } from './config.js';

const SESSION_HEADERS = ['access-token', 'token-type', 'client', 'expiry', 'uid'] as const;

type ChatwootProfile = { account_id?: unknown; role?: unknown; accounts?: Array<{ id?: unknown; role?: unknown }> };

const sessionHeaders = (request: express.Request) => {
  const headers = new Headers({ Accept: 'application/json' });
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
  const headers = sessionHeaders(request);
  if (!headers) return false;
  try {
    const response = await fetch(`${config.chatwootBaseUrl}/api/v1/profile`, { headers });
    if (!response.ok) return false;
    const profile = await response.json() as ChatwootProfile;
    const account = profile.accounts?.find(item => item.id === config.chatwootAccountId);
    const role = account?.role || (profile.account_id === config.chatwootAccountId ? profile.role : null);
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
