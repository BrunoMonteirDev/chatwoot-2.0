import { describe, expect, it } from 'vitest';
import { chatwootAssetUrl, normalizeEvolutionDestination } from './evolution';

describe('normalizeEvolutionDestination', () => {
  it('adiciona o nono dígito a celular brasileiro no formato antigo', () => {
    expect(normalizeEvolutionDestination('554484532595')).toBe('5544984532595');
  });

  it('preserva números que já estão no formato atual', () => {
    expect(normalizeEvolutionDestination('+55 (44) 98453-2595')).toBe('5544984532595');
  });

  it('troca a URL local do Vite pela URL do Rails para baixar anexos', () => {
    expect(chatwootAssetUrl('http://localhost:3000/rails/active_storage/blobs/redirect/arquivo').toString())
      .toBe('http://localhost:3003/rails/active_storage/blobs/redirect/arquivo');
  });
});
