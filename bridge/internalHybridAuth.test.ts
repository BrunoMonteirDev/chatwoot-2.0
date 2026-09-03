import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyInternalHybridRequest } from './internalHybridAuth.js';

const secret = 'test-secret'; const method = 'POST'; const path = '/internal/official-whatsapp/waha/binding/bind'; const body = '{"account_id":1}'; const now = 1_700_000_000;
const signed = (requestId = 'r1', timestamp = now) => ({ requestId, timestamp: String(timestamp), signature: createHmac('sha256', secret).update(`${method}\n${path}\n${timestamp}\n${requestId}\n${body}`).digest('hex') });
const verify = (headers = signed()) => verifyInternalHybridRequest({ secret, method, path, body, now, ...headers });

describe('internal hybrid HMAC', () => {
  it('accepts valid distinct request IDs', () => { expect(verify(signed('r1'))).toBe('r1'); expect(verify(signed('r2'))).toBe('r2'); });
  it('rejects invalid, tampered, changed method or path signatures', () => {
    expect(verify({ ...signed(), signature: '0'.repeat(64) })).toBe(false);
    expect(verifyInternalHybridRequest({ secret, method, path, body: '{"account_id":2}', now, ...signed() })).toBe(false);
    expect(verifyInternalHybridRequest({ secret, method: 'GET', path, body, now, ...signed() })).toBe(false);
    expect(verifyInternalHybridRequest({ secret, method, path: '/other', body, now, ...signed() })).toBe(false);
  });
  it('rejects expired, future and incomplete requests', () => {
    expect(verify(signed('old', now - 301))).toBe(false); expect(verify(signed('future', now + 301))).toBe(false);
    expect(verifyInternalHybridRequest({ secret, method, path, body, now })).toBe(false);
  });
});
