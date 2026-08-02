/**
 * Storage layer.
 *
 * Callers should depend on `StorageAdapter` and obtain one from
 * `createStorageAdapter()`, which resolves per platform at bundle time. The
 * concrete adapters are exported for tests and for anything that genuinely
 * needs a specific backend.
 */

export type { StorageAdapter } from './StorageAdapter';
export { InMemoryStorageAdapter } from './StorageAdapter';
export { createStorageAdapter } from './createStorageAdapter';
export {
  IndexedDbStorageAdapter,
  DB_NAME,
  DB_VERSION,
  STORE_NAME,
} from './indexedDbStorageAdapter';
export type { IndexedDbStorageAdapterOptions } from './indexedDbStorageAdapter';
export { describeStorageAdapterContract } from './adapterContract';
export type { ContractOptions } from './adapterContract';
