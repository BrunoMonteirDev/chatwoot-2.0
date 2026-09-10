import { useCallback, useEffect, useRef, useState } from 'react';
import type { ContactNote, ContactProfile } from '../../domain/currentUser';
import { contactService, type ContactUpdate } from '../../integrations/chatwoot/contacts';
import { errorMessageForUser } from '../../integrations/chatwoot/errors';

const CONTACT_DETAILS_TTL_MS = 5 * 60_000;
type ContactDetailsEntry = { contact: ContactProfile; updatedAt: number; detailed: boolean };
const contactDetailsCache = new Map<string, ContactDetailsEntry>();
const contactNotesCache = new Map<string, { notes: ContactNote[]; updatedAt: number }>();
const contactDetailsRequests = new Map<string, Promise<ContactDetailsEntry>>();
const contactNotesRequests = new Map<string, Promise<ContactNote[]>>();
let contactCacheGeneration = 0;
const contactKey = (accountId: number, contactId: number) => `${accountId}:${contactId}`;
const usableContactName = (name: string) => Boolean(name.trim() && !/^participante$/i.test(name.trim()) && !/@(lid|g\.us|c\.us|s\.whatsapp\.net)$/i.test(name.trim()));
const preserveRichContact = (current: ContactProfile | undefined, incoming: ContactProfile): ContactProfile => current ? {
  ...current,
  ...incoming,
  name: usableContactName(incoming.name) ? incoming.name : current.name,
  phoneNumber: incoming.phoneNumber || current.phoneNumber,
  email: incoming.email || current.email,
  avatarUrl: incoming.avatarUrl || current.avatarUrl,
  additionalAttributes: { ...current.additionalAttributes, ...incoming.additionalAttributes },
  customAttributes: { ...current.customAttributes, ...incoming.customAttributes },
} : incoming;
const cachedContactDetails = (accountId: number, contactId: number) => contactDetailsCache.get(contactKey(accountId, contactId));
const requestContactDetails = (accountId: number, contactId: number) => {
  const key = contactKey(accountId, contactId);
  const cached = contactDetailsCache.get(key);
  if (cached?.detailed && Date.now() - cached.updatedAt < CONTACT_DETAILS_TTL_MS) return Promise.resolve(cached);
  let pending = contactDetailsRequests.get(key);
  if (!pending) {
    const generation = contactCacheGeneration;
    pending = contactService.get(accountId, contactId).then(contact => {
      const entry = { contact: preserveRichContact(cached?.contact, contact), updatedAt: Date.now(), detailed: true };
      if (generation === contactCacheGeneration) contactDetailsCache.set(key, entry);
      return entry;
    }).finally(() => contactDetailsRequests.delete(key));
    contactDetailsRequests.set(key, pending);
  }
  return pending;
};
export const cachedContactProfile = (accountId: number, contactId: number) => cachedContactDetails(accountId, contactId)?.contact || null;
export const resolveContactProfile = async (accountId: number, contactId: number) => (await requestContactDetails(accountId, contactId)).contact;
export const cacheContactProfiles = (accountId: number, contacts: ContactProfile[]) => {
  const updatedAt = Date.now();
  contacts.forEach(contact => {
    const key = contactKey(accountId, contact.id);
    const existing = contactDetailsCache.get(key);
    contactDetailsCache.set(key, { contact: preserveRichContact(existing?.contact, contact), updatedAt, detailed: existing?.detailed || false });
  });
};
const requestContactNotes = (accountId: number, contactId: number) => {
  const key = contactKey(accountId, contactId);
  const cached = contactNotesCache.get(key);
  if (cached && Date.now() - cached.updatedAt < CONTACT_DETAILS_TTL_MS) return Promise.resolve(cached.notes);
  let pending = contactNotesRequests.get(key);
  if (!pending) {
    const generation = contactCacheGeneration;
    pending = contactService.listNotes(accountId, contactId).then(notes => {
      if (generation === contactCacheGeneration) contactNotesCache.set(key, { notes, updatedAt: Date.now() });
      return notes;
    }).finally(() => contactNotesRequests.delete(key));
    contactNotesRequests.set(key, pending);
  }
  return pending;
};
export const clearContactDetailsCache = () => { contactCacheGeneration += 1; contactDetailsCache.clear(); contactNotesCache.clear(); contactDetailsRequests.clear(); contactNotesRequests.clear(); };

export const useContactDetails = (accountId: number | null, contactId: number | null, enabled = true, notesEnabled = enabled) => {
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
    if (!enabled || !accountId || !contactId) {
      setContact(null); setNotes([]); setStatus('idle'); setError(null);
      return;
    }
    const controller = new AbortController(); abortRef.current = controller;
    const request = ++requestRef.current;
    const target = `${accountId}:${contactId}`;
    activeTargetRef.current = target;
    setStatus('loading'); setError(null);
    try {
      const { contact: nextContact } = await requestContactDetails(accountId, contactId);
      if (controller.signal.aborted || request !== requestRef.current || activeTargetRef.current !== target) return;
      setContact(nextContact); setStatus('ready');
    } catch (cause) {
      if (controller.signal.aborted || request !== requestRef.current || activeTargetRef.current !== target) return;
      setError(errorMessageForUser(cause)); setStatus('error');
    }
  }, [accountId, contactId, enabled]);

  useEffect(() => {
    setContact(null); setNotes([]);
    if (!enabled || !accountId || !contactId) { setStatus('idle'); return; }
    const cached = cachedContactDetails(accountId, contactId);
    if (cached) {
      setContact(cached.contact); setNotes(contactNotesCache.get(contactKey(accountId, contactId))?.notes || []); setStatus('ready');
      if (cached.detailed && Date.now() - cached.updatedAt < CONTACT_DETAILS_TTL_MS) return;
    }
    void load();
    return () => abortRef.current?.abort();
  }, [accountId, contactId, enabled, load]);

  useEffect(() => {
    if (!enabled || !notesEnabled || !accountId || !contactId) return;
    let active = true;
    const cached = contactNotesCache.get(contactKey(accountId, contactId));
    if (cached) setNotes(cached.notes);
    void requestContactNotes(accountId, contactId).then(next => { if (active) setNotes(next); }).catch(() => undefined);
    return () => { active = false; };
  }, [accountId, contactId, enabled, notesEnabled]);

  const update = useCallback(async (updateData: ContactUpdate) => {
    if (!accountId || !contact || isSaving) return null;
    setIsSaving(true);
    try {
      const updated = await contactService.update(accountId, contact, updateData);
      setContact(updated);
      const key = contactKey(accountId, updated.id); const cached = contactDetailsCache.get(key);
      if (cached) contactDetailsCache.set(key, { ...cached, contact: preserveRichContact(cached.contact, updated), updatedAt: Date.now() });
      return updated;
    } finally { setIsSaving(false); }
  }, [accountId, contact, isSaving]);

  const createNote = useCallback(async (content: string) => {
    if (!accountId || !contactId || !content.trim() || isCreatingNote) return null;
    const target = `${accountId}:${contactId}`;
    setIsCreatingNote(true);
    try {
      const note = await contactService.createNote(accountId, contactId, content.trim());
      const key = contactKey(accountId, contactId); const cached = contactNotesCache.get(key);
      contactNotesCache.set(key, { notes: [note, ...(cached?.notes || [])], updatedAt: Date.now() });
      if (activeTargetRef.current === target) setNotes(current => [note, ...current]);
      return note;
    } finally { setIsCreatingNote(false); }
  }, [accountId, contactId, isCreatingNote]);

  const applyRealtimeUpdate = useCallback((updated: ContactProfile) => {
    if (updated.id === contactId) setContact(updated);
    if (accountId) { const key = contactKey(accountId, updated.id); const cached = contactDetailsCache.get(key); contactDetailsCache.set(key, { contact: preserveRichContact(cached?.contact, updated), detailed: cached?.detailed || false, updatedAt: Date.now() }); }
  }, [accountId, contactId]);

  const remove = useCallback(async () => {
    if (!accountId || !contactId || isDeleting) return false;
    setIsDeleting(true);
    try { await contactService.remove(accountId, contactId); return true; }
    finally { setIsDeleting(false); }
  }, [accountId, contactId, isDeleting]);

  return { contact, notes, status, error, isSaving, isCreatingNote, isDeleting, retry: load, update, createNote, remove, applyRealtimeUpdate };
};
