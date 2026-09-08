// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContactAttributesPanel } from './ContactAttributesPanel';
import { groupMetadataClient } from '../features/groups/metadata';
import type { Chat } from '../types';
import type { WhatsAppTransport } from '../integrations/whatsapp/provider';

const get = vi.spyOn(groupMetadataClient, 'get');
let container: HTMLDivElement;
let root: Root;
const render = async (isGroup: boolean, transport: WhatsAppTransport = 'waha', conversationId = 91) => {
  const chat: Chat = { id: String(conversationId), name: 'Contact', avatar: '', lastMessage: '', time: '', messages: [], isGroup };
  await act(async () => { root.render(<ContactAttributesPanel chat={chat} accountId={1} inboxId={5} conversationId={conversationId} groupTransport={transport} isDarkMode onClose={() => {}} />); });
};

describe('group metadata requests', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    get.mockReset().mockResolvedValue({ group: { id: '123@g.us', subject: 'Real group', transport: 'waha', participants: [], canEditDescription: true } });
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  it.each(['meta_cloud', 'waha'] as const)('never requests metadata for private %s, including rerenders', async transport => {
    await render(false, transport); await render(false, transport);
    expect(get).not.toHaveBeenCalled();
  });
  it('loads a real group normally and clears group data when switching to private', async () => {
    await render(true);
    expect(get).toHaveBeenCalledExactlyOnceWith(1, 5, 91, 'waha');
    expect(container.textContent).toContain('Real group');
    await render(false, 'meta_cloud', 92);
    expect(get).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain('Real group');
  });
  it('does not retry failed group metadata on rerender', async () => {
    get.mockRejectedValue(new Error('Provider unavailable'));
    await render(true); await render(true); await render(true);
    expect(get).toHaveBeenCalledTimes(1);
  });
});
