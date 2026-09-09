import { describe, expect, it } from 'vitest';
import settingsSource from '../../components/SettingsView.tsx?raw';

describe('regressão de atributos mockados', () => {
  it('não mantém definições hardcoded como fonte da administração', () => {
    expect(settingsSource).not.toContain("name: 'CPF_CNPJ'");
    expect(settingsSource).not.toContain("name: 'PLANO_CONTRATADO'");
    expect(settingsSource).toContain('CustomAttributesSettingsPanel');
  });
});
