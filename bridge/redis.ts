import { createClient } from 'redis';
import { randomUUID } from 'node:crypto';
import { config } from './config.js';

// Redis is optional in local development so an existing file-backed setup can
// start unchanged. Production requires it through config.ts and uses it for
// shared locks/state across bridge replicas.
class BridgeRedis {
  private client: ReturnType<typeof createClient> | null = null;
  private connecting: Promise<ReturnType<typeof createClient>> | null = null;

  get enabled() { return Boolean(config.redisUrl); }

  private async connected() {
    if (!this.enabled) return null;
    if (this.client?.isReady) return this.client;
    if (!this.connecting) {
      const client = createClient({ url: config.redisUrl });
      client.on('error', error => console.error('[bridge-redis] connection error', { error: error.message }));
      this.connecting = client.connect().then(() => {
        this.client = client;
        return client;
      }).finally(() => { this.connecting = null; });
    }
    return this.connecting;
  }

  async get(key: string) {
    const client = await this.connected();
    return client?.get(key) ?? null;
  }

  async set(key: string, value: string, ttlSeconds?: number) {
    const client = await this.connected();
    if (!client) return;
    await client.set(key, value, ttlSeconds ? { EX: ttlSeconds } : undefined);
  }

  async setIfAbsent(key: string, value: string, ttlSeconds: number) {
    const client = await this.connected();
    return client ? (await client.set(key, value, { NX: true, EX: ttlSeconds })) === 'OK' : null;
  }

  async delete(key: string) {
    const client = await this.connected();
    if (client) await client.del(key);
  }

  async ping() {
    const client = await this.connected();
    return client ? (await client.ping()) === 'PONG' : true;
  }

  async increment(key: string, ttlSeconds: number): Promise<number | null> {
    const client = await this.connected();
    if (!client) return null;
    const value = await client.incr(key);
    if (value === 1) await client.expire(key, ttlSeconds);
    return value;
  }

  async acquireLease(key: string, ttlSeconds: number): Promise<string | null> {
    if (!this.enabled) return 'local';
    const token = randomUUID();
    return await this.setIfAbsent(`bridge:lease:${key}`, token, ttlSeconds) ? token : null;
  }

  async releaseLease(key: string, token: string) {
    if (!this.enabled || token === 'local') return;
    const client = await this.connected();
    if (client) await client.eval('if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) end return 0', {
      keys: [`bridge:lease:${key}`], arguments: [token],
    });
  }

  /**
   * Small distributed critical section for state which is stored as one
   * encrypted document. It is deliberately only used for short read/modify/
   * write operations; network work must never happen while it is held.
   */
  async withLock<T>(key: string, callback: () => Promise<T>, ttlSeconds = 10): Promise<T> {
    if (!this.enabled) return callback();
    const token = randomUUID();
    let acquired = false;
    for (let attempt = 0; attempt < 20 && !acquired; attempt += 1) {
      acquired = Boolean(await this.setIfAbsent(`bridge:lock:${key}`, token, ttlSeconds));
      if (!acquired) await new Promise(resolve => setTimeout(resolve, 25));
    }
    if (!acquired) throw new Error('A operação já está sendo processada por outra instância do bridge.');
    try {
      return await callback();
    } finally {
      const client = await this.connected();
      if (client) await client.eval('if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) end return 0', {
        keys: [`bridge:lock:${key}`], arguments: [token],
      });
    }
  }
}

export const bridgeRedis = new BridgeRedis();
