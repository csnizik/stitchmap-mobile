/**
 * MMKV-backed `StorageAdapter` for iOS and Android.
 *
 * MMKV is memory-mapped and synchronous, so the async `StorageAdapter` methods
 * resolve immediately rather than deferring real work. That is deliberate: the
 * interface is async because IndexedDB on web is, and one contract beats two.
 *
 * This module must never be imported on web. Platform selection happens through
 * file extension resolution in `createStorageAdapter`, so Metro never bundles
 * the native module into the web build.
 *
 * MMKV v4 moved to NitroModules: `MMKV` is now a type, instances come from
 * `createMMKV()`, and key deletion is `remove()` rather than `delete()`.
 */

import { createMMKV } from 'react-native-mmkv';

import type { StorageAdapter } from './StorageAdapter';

/** Namespaces the store, so other MMKV users in the app cannot collide. */
export const MMKV_INSTANCE_ID = 'stitchmap';

/**
 * The subset of MMKV this adapter uses.
 *
 * `remove` returns whether a key was actually present. The adapter discards
 * that, because the contract treats removing a missing key as a no-op.
 */
export interface MmkvLike {
  set(key: string, value: string): void;
  getString(key: string): string | undefined;
  remove(key: string): boolean;
  clearAll(): void;
}

export interface MmkvStorageAdapterOptions {
  /** Injected so tests can supply a fake without the native module. */
  readonly storage?: MmkvLike;
}

export class MmkvStorageAdapter implements StorageAdapter {
  private readonly storage: MmkvLike;

  constructor({ storage }: MmkvStorageAdapterOptions = {}) {
    this.storage = storage ?? createMMKV({ id: MMKV_INSTANCE_ID });
  }

  getItem(key: string): Promise<string | null> {
    // MMKV returns undefined for a missing key; the contract says null.
    return Promise.resolve(this.storage.getString(key) ?? null);
  }

  setItem(key: string, value: string): Promise<void> {
    this.storage.set(key, value);
    return Promise.resolve();
  }

  removeItem(key: string): Promise<void> {
    this.storage.remove(key);
    return Promise.resolve();
  }

  clear(): Promise<void> {
    this.storage.clearAll();
    return Promise.resolve();
  }
}
