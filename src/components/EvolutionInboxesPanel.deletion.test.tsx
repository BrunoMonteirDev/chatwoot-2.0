// @vitest-environment jsdom
import React, { useState } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Inbox } from '../domain/currentUser';
import { removeInboxForAccount } from '../features/inboxes/useInboxes';
import { inboxService } from '../integrations/chatwoot/inboxes';
import { wahaClient } from '../integrations/waha/client';
import { EvolutionInboxesPanel } from './EvolutionInboxesPanel';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const accountId = 73;
const wahaInbox = (id: number, name: string): Inbox => ({
  id,
  name,
  avatarUrl: null,
  channelType: 'Channel::Api',
  channelId: id,
  webhookUrl: null,
  inboxIdentifier: `synthetic-${id}`,
  additionalAttributes: {
    whatsapp_transports: ['waha'],
    waha_session_name: `synthetic-session-${id}`,
  },
});

const inboxes = [wahaInbox(801, 'Synthetic Alpha'), wahaInbox(802, 'Synthetic Beta')];

const buttonWithText = (element: HTMLElement, text: string) => {
  const button = Array.from(element.querySelectorAll('button')).find(item => item.textContent?.includes(text) || item.getAttribute('aria-label')?.includes(text));
  if (!button) throw new Error(`Button not found: ${text}`);
  return button as HTMLButtonElement;
};

const click = async (button: HTMLButtonElement) => {
  await act(async () => {
    button.click();
    await Promise.resolve();
  });
};

type HarnessProps = { onRefresh: ReturnType<typeof vi.fn>; onCloseInbox?: ReturnType<typeof vi.fn> };
const Harness = ({ onRefresh, onCloseInbox }: HarnessProps) => {
  const [current, setCurrent] = useState(inboxes);
  const [selectedInboxId, setSelectedInboxId] = useState<number | null>(null);
  return <>
    <button data-testid="select-deletion-target" onClick={() => setSelectedInboxId(801)}>Select target route</button>
    <span data-testid="selected-inbox">{selectedInboxId ?? 'none'}</span>
    <EvolutionInboxesPanel
      accountId={accountId}
      inboxes={current}
      inboxesStatus="ready"
      inboxesError={null}
      onRefresh={onRefresh}
      onInboxDeleted={(removedAccountId, removedInboxId) => {
        setCurrent(items => removeInboxForAccount(items, accountId, removedAccountId, removedInboxId));
      }}
      selectedInboxId={selectedInboxId}
      onCloseInbox={() => { setSelectedInboxId(null); onCloseInbox?.(); }}
      isDarkMode
    />
  </>;
};

describe('inbox deletion state reconciliation', () => {
  let element: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    element = document.createElement('div');
    document.body.append(element);
    root = createRoot(element);
    vi.spyOn(wahaClient, 'listSessions').mockResolvedValue({ sessions: [] });
    vi.spyOn(wahaClient, 'getCurrentHistoryImport').mockResolvedValue({ job: null, running: false });
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it('remove da lista imediatamente após DELETE 204 sem refetch', async () => {
    vi.spyOn(wahaClient, 'deleteInboxAndSession').mockResolvedValue(undefined);
    const onRefresh = vi.fn();
    await act(async () => root.render(<Harness onRefresh={onRefresh} />));

    await click(buttonWithText(element, 'Excluir Synthetic Alpha'));
    await click(buttonWithText(element, 'Excluir caixa'));

    expect(wahaClient.deleteInboxAndSession).toHaveBeenCalledWith({ accountId, inboxId: 801 });
    expect(element.textContent).not.toContain('Synthetic Alpha');
    expect(element.textContent).toContain('Synthetic Beta');
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('limpa a inbox selecionada e volta para a lista após excluí-la', async () => {
    vi.spyOn(wahaClient, 'deleteInboxAndSession').mockResolvedValue(undefined);
    const onCloseInbox = vi.fn();
    await act(async () => root.render(<Harness onRefresh={vi.fn()} onCloseInbox={onCloseInbox} />));

    await click(buttonWithText(element, 'Excluir Synthetic Alpha'));
    await click(element.querySelector('[data-testid="select-deletion-target"]') as HTMLButtonElement);
    await click(buttonWithText(element, 'Excluir caixa'));

    expect(element.querySelector('[data-testid="selected-inbox"]')?.textContent).toBe('none');
    expect(element.textContent).toContain('Adicionar caixa de entrada');
    expect(element.textContent).not.toContain('Synthetic Alpha');
    expect(onCloseInbox).toHaveBeenCalled();
  });

  it('mantém a inbox quando o DELETE falha', async () => {
    vi.spyOn(wahaClient, 'deleteInboxAndSession').mockRejectedValue(new Error('synthetic provider failure'));
    const onRefresh = vi.fn();
    await act(async () => root.render(<Harness onRefresh={onRefresh} />));

    await click(buttonWithText(element, 'Excluir Synthetic Alpha'));
    await click(buttonWithText(element, 'Excluir caixa'));

    expect(element.textContent).toContain('Synthetic Alpha');
    expect(element.textContent).toContain('Synthetic Beta');
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('mantém outras inboxes ao excluir o id confirmado', async () => {
    vi.spyOn(wahaClient, 'deleteInboxAndSession').mockResolvedValue(undefined);
    await act(async () => root.render(<Harness onRefresh={vi.fn()} />));

    await click(buttonWithText(element, 'Excluir Synthetic Beta'));
    await click(buttonWithText(element, 'Excluir caixa'));

    expect(element.textContent).toContain('Synthetic Alpha');
    expect(element.textContent).not.toContain('Synthetic Beta');
  });
});
