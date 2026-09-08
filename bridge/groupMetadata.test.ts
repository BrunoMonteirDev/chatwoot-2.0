import { describe, expect, it } from 'vitest';
import { GroupMetadataCache } from './groupMetadata';

describe('GroupMetadataCache', () => {
  it('reutiliza metadados durante o TTL e expira após cinco minutos', () => {
    let now = 0; const cache = new GroupMetadataCache(300_000, () => now);
    cache.set({ id: '1@g.us', transport: 'waha', canEditDescription: true, description: 'teste', participants: [] });
    expect(cache.get('waha', '1@g.us')?.description).toBe('teste');
    now = 300_001;
    expect(cache.get('waha', '1@g.us')).toBeNull();
  });

  it('separa grupos pelo transporte, essencial para inbox híbrida', () => {
    const cache = new GroupMetadataCache();
    cache.set({ id: '1@g.us', transport: 'evolution', canEditDescription: true, participants: [] });
    expect(cache.get('waha', '1@g.us')).toBeNull();
  });

  it('invalida metadata após evento do provider sem afetar outro transport', () => {
    const cache = new GroupMetadataCache();
    cache.set({ id: '1@g.us', transport: 'waha', subject: 'Antigo', canEditDescription: true, participants: [] });
    cache.set({ id: '1@g.us', transport: 'evolution', subject: 'Evolution', canEditDescription: true, participants: [] });
    cache.invalidate('waha', '1@g.us');
    expect(cache.get('waha', '1@g.us')).toBeNull();
    expect(cache.get('evolution', '1@g.us')?.subject).toBe('Evolution');
  });
});
