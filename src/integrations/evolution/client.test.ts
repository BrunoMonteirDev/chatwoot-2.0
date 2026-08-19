// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('evolutionService', () => {
  beforeEach(() => { vi.resetModules(); vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it('falha explicitamente quando a URL pública do bridge não existe', async () => {
    vi.stubEnv('VITE_BRIDGE_PUBLIC_URL', '');
    const { evolutionService } = await import('./client');
    await expect(evolutionService.createInstance('teste')).rejects.toThrow('VITE_BRIDGE_PUBLIC_URL');
  });

  it('extrai a imagem base64 aninhada em qrcode', async () => {
    const { evolutionQrCode } = await import('./client');
    expect(evolutionQrCode({ qrcode: { base64: 'imagem-base64' }, code: 'codigo-para-pareamento' })).toBe('imagem-base64');
  });
});
