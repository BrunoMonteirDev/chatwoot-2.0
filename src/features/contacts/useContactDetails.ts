import { useCallback, useEffect, useRef, useState } from 'react';
import type { ContactNote, ContactProfile } from '../../domain/currentUser';
import { contactService, type ContactUpdate } from '../../integrations/chatwoot/contacts';
import { errorMessageForUser } from '../../integrations/chatwoot/errors';

export const useContactDetails = (accountId: number | null, contactId: number | null) => {
  const [contact, setContact] = useState<ContactProfile | null>(null);
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const requestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const activeTargetRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    if (!accountId || !contactId) {
      setContact(null); setNotes([]); setStatus('idle'); setError(null);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    const request = ++requestRef.current;
    const target = `${accountId}:${contactId}`;
    activeTargetRef.current = target;
    setStatus('loading'); setError(null);
    try {
      const [nextContact, nextNotes] = await Promise.all([contactService.get(accountId, contactId, controller.signal), contactService.listNotes(accountId, contactId, controller.signal)]);
      if (controller.signal.aborted || request !== requestRef.current || activeTargetRef.current !== target) return;
      setContact(nextContact); setNotes(nextNotes); setStatus('ready');
    } catch (cause) {
      if (controller.signal.aborted || request !== requestRef.current || activeTargetRef.current !== target) return;
      setError(errorMessageForUser(cause)); setStatus('error');
    }
  }, [accountId, contactId]);

  useEffect(() => {
    setContact(null); setNotes([]);
    if (!accountId || !contactId) { setStatus('idle'); return; }
    void load();
    return () => abortRef.current?.abort();
  }, [accountId, contactId, load]);

  const update = useCallback(async (updateData: ContactUpdate) => {
    if (!accountId || !contact || isSaving) return null;
    setIsSaving(true);
    try {
      const updated = await contactService.update(accountId, contact, updateData);
      setContact(updated);
      return updated;
    } finally { setIsSaving(false); }
  }, [accountId, contact, isSaving]);

  const createNote = useCallback(async (content: string) => {
    if (!accountId || !contactId || !content.trim() || isCreatingNote) return null;
    const target = `${accountId}:${contactId}`;
    setIsCreatingNote(true);
    try {
      const note = await contactService.createNote(accountId, contactId, content.trim());
      if (activeTargetRef.current === target) setNotes(current => [note, ...current]);
      return note;
    } finally { setIsCreatingNote(false); }
  }, [accountId, contactId, isCreatingNote]);

  const applyRealtimeUpdate = useCallback((updated: ContactProfile) => {
    if (updated.id === contactId) setContact(updated);
  }, [contactId]);

  return { contact, notes, status, error, isSaving, isCreatingNote, retry: load, update, createNote, applyRealtimeUpdate };
};
