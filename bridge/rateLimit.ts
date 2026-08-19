import type { Request, Response } from 'express';
import { bridgeRedis } from './redis.js';

const local = new Map<string, { count: number; expiresAt: number }>();

const clientKey = (request: Request) => {
  const forwarded = request.header('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.ip || 'unknown';
};

export const enforceRateLimit = async (request: Request, response: Response, scope: string, limit: number, windowSeconds: number) => {
  const key = `bridge:rate:${scope}:${clientKey(request)}`;
  const redisCount = await bridgeRedis.increment(key, windowSeconds);
  let count = redisCount;
  if (count === null) {
    const now = Date.now();
    const current = local.get(key);
    const value = !current || current.expiresAt <= now ? { count: 1, expiresAt: now + windowSeconds * 1_000 } : { ...current, count: current.count + 1 };
    local.set(key, value);
    count = value.count;
  }
  if (count <= limit) return true;
  response.setHeader('Retry-After', String(windowSeconds));
  response.status(429).json({ error: 'Too many requests. Try again later.' });
  return false;
};
