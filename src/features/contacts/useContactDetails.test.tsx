// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { contactService } from '../../integrations/chatwoot/contacts';
import { clearContactDetailsCache, useContactDetails } from './useContactDetails';

const profile = { id: 3, name: 'Ana', avatarUrl: null, phoneNumber: '+5511999999999', email: null, identifier: null, companyName: null, city: null, country: null, blocked: false, lastActivityAt: null, createdAt: null, additionalAttributes: {}, customAttributes: {} };
const Probe = ({ accountId = 1, contactId = 3 }: { accountId?: number; contactId?: number }) => {
  const details = useContactDetails(accountId, contactId);
  return <span>{details.contact?.name || details.status}</span>;
};

describe('useContactDetails secondary cache', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    clearContactDetailsCache();
    container = document.createElement('div'); document.body.append(container); root = createRoot(container);
    vi.spyOn(contactService, 'get').mockResolvedValue(profile);
    vi.spyOn(contactService, 'listNotes').mockResolvedValue([]);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); });

  it('deduplica consumidores simultâneos e reutiliza o resultado fresh', async () => {
    await act(async () => { root.render(<><Probe/><Probe/></>); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    expect(container.textContent).toBe('AnaAna');
    expect(contactService.get).toHaveBeenCalledTimes(1);
    expect(contactService.listNotes).toHaveBeenCalledTimes(1);
    await act(async () => { root.render(<Probe/>); });
    expect(contactService.get).toHaveBeenCalledTimes(1);
  });

  it('isola o cache por account', async () => {
    await act(async () => { root.render(<><Probe accountId={1}/><Probe accountId={2}/></>); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
    expect(contactService.get).toHaveBeenCalledTimes(2);
  });
});
