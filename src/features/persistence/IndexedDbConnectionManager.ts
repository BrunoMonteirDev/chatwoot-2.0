export type IndexedDbConnectionState = 'closed' | 'opening' | 'open' | 'closing';

const isLifecycleError = (error: unknown) => error instanceof Error && error.name === 'InvalidStateError';

type IndexedDbFactory = Pick<IDBFactory, 'open'>;

export class IndexedDbConnectionManager {
  private connection: IDBDatabase | null = null;
  private opening: Promise<IDBDatabase | null> | null = null;
  private closing: Promise<void> | null = null;
  private operations = new Set<Promise<unknown>>();
  private currentState: IndexedDbConnectionState = 'closed';

  constructor(
    private readonly name: string,
    private readonly version: number,
    private readonly upgrade: (database: IDBDatabase) => void,
    private readonly factory: () => IndexedDbFactory | undefined = () => globalThis.indexedDB,
  ) {}

  state() { return this.currentState; }

  async ensureOpen(): Promise<IDBDatabase | null> {
    if (this.currentState === 'closing' && this.closing) await this.closing;
    if (this.currentState === 'open' && this.connection) return this.connection;
    if (this.opening) return this.opening;
    const factory = this.factory();
    if (!factory) return null;

    this.currentState = 'opening';
    const opening = new Promise<IDBDatabase | null>((resolve) => {
      let settled = false;
      const request = factory.open(this.name, this.version);
      request.onupgradeneeded = () => this.upgrade(request.result);
      request.onsuccess = () => {
        const database = request.result;
        if (settled) { database.close(); return; }
        settled = true;
        database.onversionchange = () => { void this.close(); };
        database.onclose = () => this.invalidate(database);
        this.connection = database;
        if (this.currentState !== 'closing') this.currentState = 'open';
        resolve(database);
      };
      const unavailable = () => {
        if (settled) return;
        settled = true;
        this.currentState = 'closed';
        resolve(null);
      };
      request.onerror = unavailable;
      request.onblocked = unavailable;
    });
    this.opening = opening;
    return opening.finally(() => { if (this.opening === opening) this.opening = null; });
  }

  async run<T>(operation: (database: IDBDatabase) => Promise<T>): Promise<T | null> {
    if (this.closing) await this.closing;
    const pending = this.runOnce(operation, false);
    this.operations.add(pending);
    try { return await pending; }
    finally { this.operations.delete(pending); }
  }

  async close(): Promise<void> {
    if (this.closing) return this.closing;
    const pendingOpening = this.opening;
    this.currentState = 'closing';
    const closing = (async () => {
      const opened = pendingOpening ? await pendingOpening : this.connection;
      await Promise.allSettled([...this.operations]);
      const database = this.connection || opened;
      if (database) {
        try { database.close(); } catch { /* An already-invalid connection is closed. */ }
      }
      if (this.connection === database) this.connection = null;
    })().finally(() => {
      if (this.closing === closing) this.closing = null;
      this.currentState = this.connection ? 'open' : 'closed';
    });
    this.closing = closing;
    return closing;
  }

  private async runOnce<T>(operation: (database: IDBDatabase) => Promise<T>, retried: boolean): Promise<T | null> {
    const database = await this.ensureOpen();
    if (!database) return null;
    let pending: Promise<T>;
    try { pending = operation(database); }
    catch (error) {
      if (!retried && isLifecycleError(error)) { this.invalidate(database); return this.runOnce(operation, true); }
      throw error;
    }
    try { return await pending; }
    catch (error) {
      if (!retried && isLifecycleError(error)) { this.invalidate(database); return this.runOnce(operation, true); }
      throw error;
    }
  }

  private invalidate(database: IDBDatabase) {
    if (this.connection !== database) return;
    this.connection = null;
    if (this.currentState !== 'closing') this.currentState = 'closed';
    try { database.close(); } catch { /* Browser already invalidated it. */ }
  }
}
