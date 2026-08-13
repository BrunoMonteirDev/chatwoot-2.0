// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('evolutionService', () => {
  beforeEach(() => { vi.resetModules(); vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it('falha explicitamente quando a configuração de desenvolvimento não existe', async () => {
    vi.stubEnv('VITE_EVOLUTION_BASE_URL', '');
    vi.stubEnv('VITE_EVOLUTION_API_KEY', '');
    const { evolutionService } = await import('./client');
    await expect(evolutionService.createInstance('teste')).rejects.toThrow('VITE_EVOLUTION_BASE_URL');
  });

  it('extrai a imagem base64 aninhada em qrcode', async () => {
    const { evolutionQrCode } = await import('./client');
    expect(evolutionQrCode({ qrcode: { base64: 'imagem-base64' }, code: 'codigo-para-pareamento' })).toBe('imagem-base64');
  });
});
