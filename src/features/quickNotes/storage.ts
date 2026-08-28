export type QuickNote = {
  id: string;
  shortcut: string;
  text: string;
  attachmentName?: string;
  attachmentType?: string;
  updatedAt: string;
};

const NOTES_KEY = 'quick-notes';
const UPDATED_EVENT = 'quick-notes-updated';
const DATABASE = 'chatwoot-quick-notes';
const STORE = 'attachments';

const openDatabase = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open(DATABASE, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(STORE);
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const transaction = async <T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) => {
  const database = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const request = action(database.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).finally(() => database.close());
};

export const quickNotesStorage = {
  list(): QuickNote[] {
    try {
      const parsed = JSON.parse(localStorage.getItem(NOTES_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.filter((note): note is QuickNote => Boolean(note?.id && note?.shortcut)) : [];
    } catch {
      return [];
    }
  },

  save(notes: QuickNote[]) {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
    window.dispatchEvent(new Event(UPDATED_EVENT));
  },

  async putAttachment(noteId: string, file: File) {
    await transaction('readwrite', (store) => store.put(file, noteId));
  },

  async getAttachment(note: QuickNote): Promise<File | null> {
    if (!note.attachmentName) return null;
    try {
      const value = await transaction<Blob | undefined>('readonly', (store) => store.get(note.id));
      if (!value) return null;
      return new File([value], note.attachmentName, { type: note.attachmentType || value.type || 'application/octet-stream' });
    } catch {
      return null;
    }
  },

  async removeAttachment(noteId: string) {
    try { await transaction('readwrite', (store) => store.delete(noteId)); } catch { /* IndexedDB may be unavailable in private mode. */ }
  },
};

export const QUICK_NOTES_UPDATED_EVENT = UPDATED_EVENT;
