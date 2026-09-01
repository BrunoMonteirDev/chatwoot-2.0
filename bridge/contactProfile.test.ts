import { describe, expect, it } from 'vitest';
import { contactProfileSyncPlan, isPhoneDefaultName } from './contactProfile';

describe('contact profile synchronization policy', () => {
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
