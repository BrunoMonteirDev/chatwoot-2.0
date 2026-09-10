import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

const load = async (values: Record<string, string>) => {
  for (const [key, value] of Object.entries({
    NODE_ENV: 'test',
    BRIDGE_WEBHOOK_SECRET: 'synthetic-secret',
    CHATWOOT_BASE_URL: 'http://rails.synthetic.test:3000',
    BRIDGE_REDIS_URL: '',
    BRIDGE_ENCRYPTION_KEY: '',
    ...values,
  })) vi.stubEnv(key, value);
  return import('./config');
};

describe('fresh-install bridge callback configuration', () => {
  it('derives the Chatwoot callback from installation runtime configuration', async () => {
    const { chatwootWebhookUrl } = await load({ BRIDGE_PUBLIC_URL: 'https://bridge.new-install.example/', BRIDGE_INTERNAL_URL: '' });
    expect(chatwootWebhookUrl()).toBe('https://bridge.new-install.example/webhooks/chatwoot');
  });

  it('prefers a configured internal callback without hardcoded domains', async () => {
    const { chatwootWebhookUrl } = await load({ BRIDGE_PUBLIC_URL: '/bridge', BRIDGE_INTERNAL_URL: 'http://runtime-bridge:3100/' });
    expect(chatwootWebhookUrl()).toBe('http://runtime-bridge:3100/webhooks/chatwoot');
  });

  it('fails clearly when a browser-only proxy is the only callback configuration', async () => {
    const { chatwootWebhookUrl } = await load({ BRIDGE_PUBLIC_URL: '/bridge', BRIDGE_INTERNAL_URL: '' });
    expect(chatwootWebhookUrl).toThrow('URL HTTP(S) absoluta');
  });
});
