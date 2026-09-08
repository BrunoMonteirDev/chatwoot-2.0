import { describe, expect, it, vi } from 'vitest';
import { bestEffortContactProfile, contactProfileSyncPlan, isPhoneDefaultName } from './contactProfile';

describe('contact profile synchronization policy', () => {
  it('retorna o profile resolvido pelo provider', async () => {
    await expect(bestEffortContactProfile(async () => ({ name: 'Ana', avatarUrl: 'https://cdn/avatar.jpg' }))).resolves.toEqual({ name: 'Ana', avatarUrl: 'https://cdn/avatar.jpg' });
  });
  it('transforma indisponibilidade operacional em fallback coerente', async () => {
    const log = vi.fn();
    await expect(bestEffortContactProfile(async () => { throw new Error('timeout'); }, log)).resolves.toEqual({ unavailable: true });
    expect(log).toHaveBeenCalledOnce();
  });
  it('mantém os dados conhecidos quando o provider não encontra profile', async () => {
    await expect(bestEffortContactProfile(async () => ({}))).resolves.toEqual({});
  });
  it('preenche automaticamente um nome vazio', () => expect(contactProfileSyncPlan({ name: '', phoneNumber: '+55 44 99563-9999' })).toMatchObject({ name: true }));
  it('reconhece o telefone como nome padrão em formatos diferentes', () => {
    expect(isPhoneDefaultName('554499563999', '+55 44 99563-9999')).toBe(true);
    expect(isPhoneDefaultName('+55 44 99563-9999', '554499563999')).toBe(true);
    expect(isPhoneDefaultName('44995639999', '+55 44 99563-9999')).toBe(true);
  });
  it('não substitui nome real automaticamente', () => expect(contactProfileSyncPlan({ name: 'Ivan Paschoalotto Marques', phoneNumber: '+554499563999' })).toMatchObject({ name: false }));
  it('preenche somente foto ausente automaticamente', () => {
    expect(contactProfileSyncPlan({ name: 'Ricardo Freitas', avatarUrl: null, phoneNumber: '+554499563999' })).toEqual({ name: false, avatar: true });
    expect(contactProfileSyncPlan({ name: 'Ricardo Freitas', avatarUrl: 'https://cdn/avatar.jpg', phoneNumber: '+554499563999' })).toEqual({ name: false, avatar: false });
  });
  it('força nome e foto na sincronização manual', () => expect(contactProfileSyncPlan({ name: 'Ricardo', avatarUrl: 'https://cdn/avatar.jpg' }, true)).toEqual({ name: true, avatar: true }));
});
