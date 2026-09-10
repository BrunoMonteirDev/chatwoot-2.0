import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe('runtime configuration', () => {
  it('carrega a URL pública do bridge em runtime quando o build não possui URL', async () => {
    vi.stubEnv('VITE_BRIDGE_PUBLIC_URL', '');
    const { bridgePublicUrl, loadRuntimeConfig } = await import('./runtime');
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ bridgePublicUrl: 'https://bridge.synthetic.example/' }), { status: 200 }));
    await expect(loadRuntimeConfig(fetcher)).resolves.toEqual({ bridgePublicUrl: 'https://bridge.synthetic.example' });
    expect(fetcher).toHaveBeenCalledWith('/bridge/config', { headers: { Accept: 'application/json' } });
    expect(bridgePublicUrl()).toBe('https://bridge.synthetic.example');
  });

  it('usa o proxy de build somente para buscar a configuração runtime', async () => {
    vi.stubEnv('VITE_BRIDGE_PUBLIC_URL', '/custom-bridge/');
    const { bridgePublicUrl, loadRuntimeConfig } = await import('./runtime');
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ bridgePublicUrl: 'https://runtime.synthetic.example' }), { status: 200 }));
    await loadRuntimeConfig(fetcher);
    expect(fetcher).toHaveBeenCalledWith('/custom-bridge/config', expect.anything());
    expect(bridgePublicUrl()).toBe('https://runtime.synthetic.example');
  });

  it('rejeita URL runtime insegura fora do desenvolvimento local', async () => {
    vi.stubEnv('VITE_BRIDGE_PUBLIC_URL', '');
    const { loadRuntimeConfig } = await import('./runtime');
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ bridgePublicUrl: 'http://bridge.synthetic.example' }), { status: 200 }));
    await expect(loadRuntimeConfig(fetcher)).rejects.toThrow('configuração runtime');
  });

  it('rejeita URL relativa protocol-relative', async () => {
    vi.stubEnv('VITE_BRIDGE_PUBLIC_URL', '');
    const { loadRuntimeConfig } = await import('./runtime');
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ bridgePublicUrl: '//untrusted.synthetic.example' }), { status: 200 }));
    await expect(loadRuntimeConfig(fetcher)).rejects.toThrow('configuração runtime');
  });
});
