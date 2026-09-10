import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe('runtime configuration', () => {
  it('carrega a URL pública do bridge em runtime quando o build não possui URL', async () => {
    const { bridgeChatwootWebhookUrl, bridgePublicUrl, loadRuntimeConfig } = await import('./runtime');
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ bridgePublicUrl: 'https://bridge.synthetic.example/', chatwootWebhookUrl: 'http://bridge:3100/webhooks/chatwoot' }), { status: 200 }));
    await expect(loadRuntimeConfig(fetcher)).resolves.toEqual({ bridgePublicUrl: 'https://bridge.synthetic.example', chatwootWebhookUrl: 'http://bridge:3100/webhooks/chatwoot' });
    expect(fetcher).toHaveBeenCalledWith('/bridge/config', { headers: { Accept: 'application/json' } });
    expect(bridgePublicUrl()).toBe('https://bridge.synthetic.example');
    expect(bridgeChatwootWebhookUrl()).toBe('http://bridge:3100/webhooks/chatwoot');
  });

  it('usa sempre o bootstrap same-origin e aceita o proxy runtime', async () => {
    const { bridgePublicUrl, loadRuntimeConfig } = await import('./runtime');
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ bridgePublicUrl: '/bridge', chatwootWebhookUrl: 'http://bridge:3100/webhooks/chatwoot' }), { status: 200 }));
    await loadRuntimeConfig(fetcher);
    expect(fetcher).toHaveBeenCalledWith('/bridge/config', expect.anything());
    expect(bridgePublicUrl()).toBe('/bridge');
  });

  it('rejeita URL runtime insegura fora do desenvolvimento local', async () => {
    const { loadRuntimeConfig } = await import('./runtime');
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ bridgePublicUrl: 'http://bridge.synthetic.example', chatwootWebhookUrl: 'http://bridge:3100/webhooks/chatwoot' }), { status: 200 }));
    await expect(loadRuntimeConfig(fetcher)).rejects.toThrow('configuração runtime');
  });

  it('rejeita URL relativa protocol-relative', async () => {
    const { loadRuntimeConfig } = await import('./runtime');
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ bridgePublicUrl: '//untrusted.synthetic.example', chatwootWebhookUrl: 'http://bridge:3100/webhooks/chatwoot' }), { status: 200 }));
    await expect(loadRuntimeConfig(fetcher)).rejects.toThrow('configuração runtime');
  });

  it('não mantém fallback de build quando o endpoint runtime falha', async () => {
    const { bridgePublicUrl, loadRuntimeConfig } = await import('./runtime');
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'unavailable' }), { status: 503 }));
    await expect(loadRuntimeConfig(fetcher)).rejects.toThrow('configuração runtime');
    expect(bridgePublicUrl()).toBe('');
  });
});
