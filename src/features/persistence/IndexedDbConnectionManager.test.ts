import { describe, expect, it, vi } from 'vitest';
import { IndexedDbConnectionManager } from './IndexedDbConnectionManager';

const indexedDbHarness = () => {
  const databases: IDBDatabase[] = [];
  const open = vi.fn(() => {
    const database = {
      close: vi.fn(),
      onclose: null,
      onversionchange: null,
    } as unknown as IDBDatabase;
    databases.push(database);
    const request = { result: database, onupgradeneeded: null, onsuccess: null, onerror: null, onblocked: null } as unknown as IDBOpenDBRequest;
    queueMicrotask(() => request.onsuccess?.({} as Event));
    return request;
  });
  return { databases, factory: () => ({ open }) as Pick<IDBFactory, 'open'>, open };
};

const invalidState = () => Object.assign(new Error('connection is closing'), { name: 'InvalidStateError' });

describe('IndexedDbConnectionManager', () => {
  it('reutiliza uma conexão aberta para get/put', async () => {
    const harness = indexedDbHarness();
    const manager = new IndexedDbConnectionManager('test', 1, vi.fn(), harness.factory);
    await expect(manager.run(async () => 'get')).resolves.toBe('get');
    await expect(manager.run(async () => 'put')).resolves.toBe('put');
    expect(harness.open).toHaveBeenCalledTimes(1);
    expect(manager.state()).toBe('open');
  });

  it('espera operações pendentes antes de fechar e reabre para operação concorrente ao close', async () => {
    const harness = indexedDbHarness();
    const manager = new IndexedDbConnectionManager('test', 1, vi.fn(), harness.factory);
    let finish!: (value: string) => void;
    const write = manager.run(() => new Promise<string>(resolve => { finish = resolve; }));
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    const closing = manager.close();
    await Promise.resolve();
    expect(harness.databases[0].close).not.toHaveBeenCalled();
    const afterClose = manager.run(async () => 'next');
    finish('written');
    await expect(write).resolves.toBe('written');
    await closing;
    expect(harness.databases[0].close).toHaveBeenCalledOnce();
    await expect(afterClose).resolves.toBe('next');
    expect(harness.open).toHaveBeenCalledTimes(2);
  });

  it('reabre uma conexão invalidada pelo browser', async () => {
    const harness = indexedDbHarness();
    const manager = new IndexedDbConnectionManager('test', 1, vi.fn(), harness.factory);
    await manager.run(async () => 'first');
    harness.databases[0].onclose?.({} as Event);
    await expect(manager.run(async () => 'second')).resolves.toBe('second');
    expect(harness.open).toHaveBeenCalledTimes(2);
  });

  it('fecha em versionchange e abre uma conexão nova na próxima operação', async () => {
    const harness = indexedDbHarness();
    const manager = new IndexedDbConnectionManager('test', 1, vi.fn(), harness.factory);
    await manager.run(async () => 'first');
    harness.databases[0].onversionchange?.({} as IDBVersionChangeEvent);
    await manager.close();
    expect(manager.state()).toBe('closed');
    await expect(manager.run(async () => 'second')).resolves.toBe('second');
    expect(harness.open).toHaveBeenCalledTimes(2);
  });

  it('faz um único retry após InvalidStateError', async () => {
    const harness = indexedDbHarness();
    const manager = new IndexedDbConnectionManager('test', 1, vi.fn(), harness.factory);
    const operation = vi.fn(() => {
      if (operation.mock.calls.length === 1) throw invalidState();
      return Promise.resolve('recovered');
    });
    await expect(manager.run(operation)).resolves.toBe('recovered');
    expect(operation).toHaveBeenCalledTimes(2);
    expect(harness.open).toHaveBeenCalledTimes(2);
  });

  it('não repete indefinidamente quando o retry também falha', async () => {
    const harness = indexedDbHarness();
    const manager = new IndexedDbConnectionManager('test', 1, vi.fn(), harness.factory);
    const operation = vi.fn(() => { throw invalidState(); });
    await expect(manager.run(operation)).rejects.toMatchObject({ name: 'InvalidStateError' });
    expect(operation).toHaveBeenCalledTimes(2);
    expect(harness.open).toHaveBeenCalledTimes(2);
  });
});
