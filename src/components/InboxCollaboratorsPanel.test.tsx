// @vitest-environment jsdom
import React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { inboxService } from '../integrations/chatwoot/inboxes';
import { InboxCollaboratorsPanel } from './InboxCollaboratorsPanel';
import { MetaCloudSetup } from './MetaCloudSetup';

const listAgents = vi.spyOn(inboxService, 'listAgents');
const listMembers = vi.spyOn(inboxService, 'listMembers');
const setMembers = vi.spyOn(inboxService, 'setMembers');
const agents = [
  { id: 2, name: 'Ana', avatarUrl: null, email: null, role: 'agent' as const, availability: 'online' as const, customRoleId: null },
  { id: 3, name: 'Beto', avatarUrl: null, email: null, role: 'agent' as const, availability: 'online' as const, customRoleId: null },
];
let container: HTMLDivElement;
let root: Root;

const renderCollaborators = (inboxId = 5) => act(() => root.render(<InboxCollaboratorsPanel accountId={12} inboxId={inboxId} isDarkMode onSaved={vi.fn()} />));
const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };

describe('InboxCollaboratorsPanel', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    listAgents.mockReset().mockResolvedValue(agents);
    listMembers.mockReset().mockResolvedValue([agents[0]]);
    setMembers.mockReset().mockImplementation(async (_accountId, _inboxId, ids) => agents.filter((agent) => ids.includes(agent.id)));
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  it('carrega membros, permite marcar/desmarcar e salva os IDs selecionados', async () => {
    renderCollaborators(); await flush();
    expect(listAgents).toHaveBeenCalledWith(12); expect(listMembers).toHaveBeenCalledWith(12, 5);
    expect(container.textContent).toContain('Ana');

    await act(async () => { container.querySelector('[role="combobox"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await act(async () => { [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Beto'))?.click(); });
    await act(async () => { [...container.querySelectorAll('button')].find((button) => button.textContent === 'Salvar alterações')?.click(); });
    expect(setMembers).toHaveBeenLastCalledWith(12, 5, [2, 3]);

    await act(async () => { container.querySelector('[aria-label="Remover Ana"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await act(async () => { [...container.querySelectorAll('button')].find((button) => button.textContent === 'Salvar alterações')?.click(); });
    expect(setMembers).toHaveBeenLastCalledWith(12, 5, [3]);
  });

  it('recarrega a seleção real quando a inbox é reaberta', async () => {
    renderCollaborators(); await flush();
    listMembers.mockResolvedValue([agents[1]]);
    renderCollaborators(6); await flush();
    expect(listMembers).toHaveBeenLastCalledWith(12, 6);
    expect(container.textContent).toContain('Beto');
    expect(container.querySelector('[aria-label="Remover Ana"]')).toBeNull();
  });

  it('expõe colaboradores para uma inbox Meta nativa', async () => {
    act(() => root.render(<MetaCloudSetup accountId={12} isDarkMode inbox={{ id: 5, name: 'Meta', avatarUrl: null, channelType: 'Channel::Whatsapp', channelId: 7, webhookUrl: null, inboxIdentifier: null, additionalAttributes: {} }} onSaved={vi.fn()} />));
    await act(async () => { [...container.querySelectorAll('button')].find((button) => button.textContent === 'Colaboradores')?.click(); });
    await flush();
    expect(container.textContent).toContain('Agentes com acesso a esta caixa');
  });
});
