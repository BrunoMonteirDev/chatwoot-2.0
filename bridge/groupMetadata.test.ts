import { describe, expect, it, vi } from 'vitest';
import { GroupMetadataCache, mergeParticipantHistory, persistedGroupMetadata, selectPersistedParticipantIdentities } from './groupMetadata';

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

  it('deduplica carregamentos simultâneos do provider', async () => {
    const cache = new GroupMetadataCache(); const loader = vi.fn().mockResolvedValue({ id: '1@g.us', transport: 'waha', canEditDescription: true, participants: [] });
    const [first, second] = await Promise.all([cache.getOrLoad('waha', '1@g.us', loader), cache.getOrLoad('waha', '1@g.us', loader)]);
    expect(loader).toHaveBeenCalledOnce();
    expect([first.loaded, second.loaded].filter(Boolean)).toHaveLength(1);
  });

  it('mantém ex-participante no histórico sem recolocá-lo na lista atual', () => {
    const previous = [{ jid: 'old@lid', contactId: 1, displayName: 'Antigo' }];
    const current = [{ jid: 'new@lid', contactId: 2, displayName: 'Atual' }];
    expect(mergeParticipantHistory(previous, current)).toEqual([...previous, ...current]);
    expect(current).toHaveLength(1);
  });

  it('normaliza aliases e identidade persistida para fallback quando o WAHA está indisponível', () => {
    expect(persistedGroupMetadata('1@g.us', 'waha', { subject: 'Equipe', avatarUrl: 'group.jpg', description: 'Descrição', participants: [{ jid: '19696904601705@lid', lid: '19696904601705@lid', phone_jid: '554497755329@c.us', phone: '554497755329', name: 'Maria', display_name: 'Maria editada', avatar_url: 'maria.jpg', contact_id: 9, admin: 'admin' }] }))
      .toMatchObject({ subject: 'Equipe', avatarUrl: 'group.jpg', description: 'Descrição', canEditDescription: false, participants: [{ jid: '19696904601705@lid', phoneJid: '554497755329@c.us', displayName: 'Maria editada', contactId: 9, avatarUrl: 'maria.jpg' }] });
  });

  it('seleciona somente autores pedidos por contact_id, LID ou telefone, incluindo histórico', () => {
    const participants = [
      { jid: '123@lid', lid: '123', phone_jid: '5511999999999@c.us', display_name: 'Maria', avatar_url: 'maria.jpg', contact_id: 91 },
      { jid: '456@lid', display_name: 'Membro não visível', contact_id: 92 },
    ];
    const history = [{ jid: '789@lid', phone: '+5521888888888', display_name: 'Antigo', contact_id: 93 }];
    expect(selectPersistedParticipantIdentities(participants, history, [{ contactId: 800, aliases: ['123@lid'] }, { aliases: ['+5521888888888'] }]))
      .toEqual([expect.objectContaining({ jid: '789@lid', contactId: 93 }), expect.objectContaining({ jid: '123@lid', contactId: 91, avatarUrl: 'maria.jpg' })]);
  });
});
