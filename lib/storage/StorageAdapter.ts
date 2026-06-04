// Storage abstraction for persisted state.
//
// `StorageAdapter` is the seam between Zustand's persistence middleware and a
// concrete key/value store. Defining it here lets stores be wired for
// persistence today while real backends (e.g. AsyncStorage, SecureStore,
// MMKV) are deferred to a later sprint — swap the adapter, not the stores.
//
// The async signatures match Zustand's `StateStorage` contract, so any adapter
// can be passed straight to `createJSONStorage`.

export interface StorageAdapter {
  /** Returns the stored string for `key`, or `null` when absent. */
  getItem(key: string): Promise<string | null>;
  /** Stores `value` under `key`, overwriting any existing value. */
  setItem(key: string, value: string): Promise<void>;
  /** Removes any value stored under `key`. No-op when absent. */
  removeItem(key: string): Promise<void>;
  /** Removes every value managed by this adapter. */
  clear(): Promise<void>;
}

/**
 * In-memory `StorageAdapter` stub.
 *
 * Backed by a `Map`, so nothing survives a reload. It exists to satisfy the
 * persistence wiring (and tests) until a real adapter ships in a later sprint.
 */
export class InMemoryStorageAdapter implements StorageAdapter {
  private readonly store = new Map<string, string>();

  getItem(key: string): Promise<string | null> {
    return Promise.resolve(this.store.has(key) ? (this.store.get(key) as string) : null);
  }

  setItem(key: string, value: string): Promise<void> {
    this.store.set(key, value);
    return Promise.resolve();
  }

  removeItem(key: string): Promise<void> {
    this.store.delete(key);
    return Promise.resolve();
  }

  clear(): Promise<void> {
    this.store.clear();
    return Promise.resolve();
  }
}
