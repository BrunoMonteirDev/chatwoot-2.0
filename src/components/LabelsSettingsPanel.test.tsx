// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAccountLabels } from '../features/labels/useAccountLabels';
import { LabelsSettingsPanel } from './LabelsSettingsPanel';

vi.mock('../features/labels/useAccountLabels', () => ({ useAccountLabels: vi.fn() }));
let container: HTMLDivElement;
let root: Root;

describe('LabelsSettingsPanel', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    vi.mocked(useAccountLabels).mockReturnValue({
      labels: [{ id: 90, title: 'backend_real', color: '#123456', description: 'Recebida da API', showOnSidebar: false }],
      status: 'ready', error: null, retry: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(),
    });
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  it('renderiza somente catálogo real, com busca, sem labels hardcoded antigas', async () => {
    await act(async () => root.render(<LabelsSettingsPanel accountId={1} isDarkMode={false} canManage />));
    expect(container.textContent).toContain('backend_real');
    expect(container.textContent).toContain('Recebida da API');
    expect(container.textContent).not.toContain('Pagamento Pendente');
    expect(container.querySelector('input[placeholder="Pesquisar etiquetas"]')).toBeTruthy();
  });

  it('valida nome obrigatório e expõe edição/exclusão somente para autorizado', async () => {
    await act(async () => root.render(<LabelsSettingsPanel accountId={1} isDarkMode={false} canManage />));
    await act(async () => (container.querySelector('button') as HTMLButtonElement).click());
    expect(container.querySelector('[role="dialog"][aria-label="Nova etiqueta"]')).toBeTruthy();
    expect(container.querySelector('button[title="Editar backend_real"]')).toBeTruthy();
    expect(container.querySelector('button[title="Excluir backend_real"]')).toBeTruthy();
    await act(async () => root.render(<LabelsSettingsPanel accountId={1} isDarkMode={false} canManage={false} />));
    expect(container.querySelector('button[title="Editar backend_real"]')).toBeNull();
    expect(container.querySelector('button[title="Excluir backend_real"]')).toBeNull();
  });
});
