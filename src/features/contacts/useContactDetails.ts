import { useCallback, useEffect, useRef, useState } from 'react';
import type { ContactNote, ContactProfile } from '../../domain/currentUser';
import { contactService, type ContactUpdate } from '../../integrations/chatwoot/contacts';
import { errorMessageForUser } from '../../integrations/chatwoot/errors';

const CONTACT_DETAILS_TTL_MS = 5 * 60_000;
type ContactDetailsEntry = { contact: ContactProfile; notes: ContactNote[]; updatedAt: number };
const contactDetailsCache = new Map<string, ContactDetailsEntry>();
const contactDetailsRequests = new Map<string, Promise<ContactDetailsEntry>>();
let contactCacheGeneration = 0;
const contactKey = (accountId: number, contactId: number) => `${accountId}:${contactId}`;
const cachedContactDetails = (accountId: number, contactId: number) => contactDetailsCache.get(contactKey(accountId, contactId));
const requestContactDetails = (accountId: number, contactId: number) => {
  const key = contactKey(accountId, contactId);
  const cached = contactDetailsCache.get(key);
  if (cached && Date.now() - cached.updatedAt < CONTACT_DETAILS_TTL_MS) return Promise.resolve(cached);
  let pending = contactDetailsRequests.get(key);
  if (!pending) {
    const generation = contactCacheGeneration;
    pending = contactService.get(accountId, contactId).then(async contact => {
      const notes = await contactService.listNotes(accountId, contactId);
      const entry = { contact, notes, updatedAt: Date.now() };
      if (generation === contactCacheGeneration) contactDetailsCache.set(key, entry);
      return entry;
    }).finally(() => contactDetailsRequests.delete(key));
    contactDetailsRequests.set(key, pending);
  }
  return pending;
};
export const clearContactDetailsCache = () => { contactCacheGeneration += 1; contactDetailsCache.clear(); contactDetailsRequests.clear(); };

export const useContactDetails = (accountId: number | null, contactId: number | null, deferMs = 0) => {
  const [contact, setContact] = useState<ContactProfile | null>(null);
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const requestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const activeTargetRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    abortRef.current?.abort();
    if (!accountId || !contactId) {
      setContact(null); setNotes([]); setStatus('idle'); setError(null);
      return;
    }
    const controller = new AbortController(); abortRef.current = controller;
    const request = ++requestRef.current;
    const target = `${accountId}:${contactId}`;
    activeTargetRef.current = target;
    setStatus('loading'); setError(null);
    try {
      const { contact: nextContact, notes: nextNotes } = await requestContactDetails(accountId, contactId);
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
    const cached = cachedContactDetails(accountId, contactId);
    if (cached) {
      setContact(cached.contact); setNotes(cached.notes); setStatus('ready');
      if (Date.now() - cached.updatedAt < CONTACT_DETAILS_TTL_MS) return;
    }
    const timer = window.setTimeout(() => void load(), deferMs);
    return () => { window.clearTimeout(timer); abortRef.current?.abort(); };
  }, [accountId, contactId, deferMs, load]);

  const update = useCallback(async (updateData: ContactUpdate) => {
    if (!accountId || !contact || isSaving) return null;
    setIsSaving(true);
    try {
      const updated = await contactService.update(accountId, contact, updateData);
      setContact(updated);
      const key = contactKey(accountId, updated.id); const cached = contactDetailsCache.get(key);
      if (cached) contactDetailsCache.set(key, { ...cached, contact: updated, updatedAt: Date.now() });
      return updated;
    } finally { setIsSaving(false); }
  }, [accountId, contact, isSaving]);

  const createNote = useCallback(async (content: string) => {
    if (!accountId || !contactId || !content.trim() || isCreatingNote) return null;
    const target = `${accountId}:${contactId}`;
    setIsCreatingNote(true);
    try {
      const note = await contactService.createNote(accountId, contactId, content.trim());
      const key = contactKey(accountId, contactId); const cached = contactDetailsCache.get(key);
      if (cached) contactDetailsCache.set(key, { ...cached, notes: [note, ...cached.notes], updatedAt: Date.now() });
      if (activeTargetRef.current === target) setNotes(current => [note, ...current]);
      return note;
    } finally { setIsCreatingNote(false); }
  }, [accountId, contactId, isCreatingNote]);

  const applyRealtimeUpdate = useCallback((updated: ContactProfile) => {
    if (updated.id === contactId) setContact(updated);
    if (accountId) { const key = contactKey(accountId, updated.id); const cached = contactDetailsCache.get(key); if (cached) contactDetailsCache.set(key, { ...cached, contact: updated, updatedAt: Date.now() }); }
  }, [accountId, contactId]);

  const remove = useCallback(async () => {
    if (!accountId || !contactId || isDeleting) return false;
    setIsDeleting(true);
    try { await contactService.remove(accountId, contactId); return true; }
    finally { setIsDeleting(false); }
  }, [accountId, contactId, isDeleting]);

  return { contact, notes, status, error, isSaving, isCreatingNote, isDeleting, retry: load, update, createNote, remove, applyRealtimeUpdate };
};
