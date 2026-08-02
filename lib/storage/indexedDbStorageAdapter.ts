/**
 * IndexedDB-backed `StorageAdapter` for web.
 *
 * localStorage would be simpler, but it caps out around 5 MB and blocks the
 * main thread. A single 250x250 pattern is comfortably within that, but a
 * library of them is not, so IndexedDB is the right floor to build on.
 *
 * The database handle is opened lazily and cached, so the first read pays for
 * the open and later calls do not.
 */

import type { StorageAdapter } from './StorageAdapter';

export const DB_NAME = 'stitchmap';
export const STORE_NAME = 'keyvalue';
export const DB_VERSION = 1;

export interface IndexedDbStorageAdapterOptions {
  /** Injected so tests can supply a fake factory. */
  readonly factory?: IDBFactory;
  readonly databaseName?: string;
}

export class IndexedDbStorageAdapter implements StorageAdapter {
  private readonly factory: IDBFactory;
  private readonly databaseName: string;
  private database: Promise<IDBDatabase> | null = null;

  constructor({ factory, databaseName }: IndexedDbStorageAdapterOptions = {}) {
    const resolved = factory ?? globalThis.indexedDB;
    if (resolved === undefined || resolved === null) {
      throw new Error(
        'IndexedDB is not available. Pass a factory explicitly, or use a different StorageAdapter.',
      );
    }
    this.factory = resolved;
    this.databaseName = databaseName ?? DB_NAME;
  }

  private open(): Promise<IDBDatabase> {
    const existing = this.database;
    if (existing !== null) {
      return existing;
    }

    const opening = new Promise<IDBDatabase>((resolve, reject) => {
      const request = this.factory.open(this.databaseName, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('failed to open IndexedDB'));
    });

    this.database = opening;
    // Do not cache a failed open, so a later call can retry. The rejection is
    // still delivered to callers awaiting `opening`.
    void opening.catch(() => {
      this.database = null;
    });

    return opening;
  }

  /**
   * Run one operation in its own transaction. Writes await `transaction.oncomplete`
   * rather than the request, because a request can succeed and the transaction
   * still abort, which would silently lose the write.
   */
  private async withStore<T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode);
      const request = operation(transaction.objectStore(STORE_NAME));

      let result: T;
      request.onsuccess = () => {
        result = request.result;
      };
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = () =>
        reject(transaction.error ?? new Error('IndexedDB transaction aborted'));
      transaction.onerror = () =>
        reject(transaction.error ?? new Error('IndexedDB transaction failed'));
    });
  }

  async getItem(key: string): Promise<string | null> {
    const value = await this.withStore<unknown>('readonly', (store) => store.get(key));
    return typeof value === 'string' ? value : null;
  }

  async setItem(key: string, value: string): Promise<void> {
    await this.withStore('readwrite', (store) => store.put(value, key));
  }

  async removeItem(key: string): Promise<void> {
    await this.withStore('readwrite', (store) => store.delete(key));
  }

  async clear(): Promise<void> {
    await this.withStore('readwrite', (store) => store.clear());
  }
}
