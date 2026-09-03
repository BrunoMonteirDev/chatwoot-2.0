import { createHmac, timingSafeEqual } from 'node:crypto';

export const verifyInternalHybridRequest = (input: { secret: string; method: string; path: string; body: string; signature?: string; timestamp?: string; requestId?: string; now?: number }) => {
  const timestamp = Number(input.timestamp); const requestId = input.requestId || '';
  if (!input.secret || !Number.isInteger(timestamp) || !requestId || Math.abs((input.now ?? Math.floor(Date.now() / 1000)) - timestamp) > 300) return false;
  const expected = createHmac('sha256', input.secret).update(`${input.method}\n${input.path}\n${timestamp}\n${requestId}\n${input.body}`).digest('hex');
  const signature = input.signature || '';
  return signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) ? requestId : false;
};
