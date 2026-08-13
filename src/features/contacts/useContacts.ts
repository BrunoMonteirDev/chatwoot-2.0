import { useCallback, useEffect, useRef, useState } from 'react';
import type { ContactProfile } from '../../domain/currentUser';
import { contactService } from '../../integrations/chatwoot/contacts';
import type { ContactUpdate, CreateContactParams } from '../../integrations/chatwoot/contacts';
import { errorMessageForUser } from '../../integrations/chatwoot/errors';

export type ContactsStatus = 'idle' | 'loading' | 'ready' | 'error';

export const useContacts = (accountId: number | null) => {
  const [contacts, setContacts] = useState<ContactProfile[]>([]);
  const [status, setStatus] = useState<ContactsStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  const [isMutating, setIsMutating] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const requestRef = useRef(0);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    if (!accountId) {
      setContacts([]);
      setTotalCount(0);
      setError(null);
      setStatus('idle');
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    const request = ++requestRef.current;
    setStatus('loading');
    setError(null);
    try {
      const page = await contactService.list({ accountId, signal: controller.signal });
      if (controller.signal.aborted || request !== requestRef.current) return;
      setContacts(page.contacts);
      setTotalCount(page.totalCount);
      setStatus('ready');
    } catch (cause) {
      if (controller.signal.aborted || request !== requestRef.current) return;
      setContacts([]);
      setTotalCount(0);
      setError(errorMessageForUser(cause));
      setStatus('error');
    }
  }, [accountId]);

  useEffect(() => {
    void load();
    return () => abortRef.current?.abort();
  }, [load]);

  const create = useCallback(async (input: Omit<CreateContactParams, 'accountId'>) => {
    if (!accountId || isCreating) return null;
    setIsCreating(true);
    try {
      const contact = await contactService.create({ accountId, ...input });
      setContacts((current) => [contact, ...current.filter((item) => item.id !== contact.id)]);
      setTotalCount((count) => count + 1);
      return contact;
    } finally {
      setIsCreating(false);
    }
  }, [accountId, isCreating]);

  const update = useCallback(async (contactId: number, input: ContactUpdate) => {
    if (!accountId || isMutating) return null;
    const current = contacts.find((contact) => contact.id === contactId);
    if (!current) return null;

    setIsMutating(true);
    try {
      const updated = await contactService.update(accountId, current, input);
      setContacts((items) => items.map((contact) => contact.id === updated.id ? updated : contact));
      return updated;
    } finally {
      setIsMutating(false);
    }
  }, [accountId, contacts, isMutating]);

  const remove = useCallback(async (contactId: number) => {
    if (!accountId || isMutating || !contacts.some((contact) => contact.id === contactId)) return false;

    setIsMutating(true);
    try {
      await contactService.remove(accountId, contactId);
      setContacts((items) => items.filter((contact) => contact.id !== contactId));
      setTotalCount((count) => Math.max(0, count - 1));
      return true;
    } finally {
      setIsMutating(false);
    }
  }, [accountId, contacts, isMutating]);

  return { contacts, status, error, totalCount, retry: load, create, isCreating, update, remove, isMutating };
};
