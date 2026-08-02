/**
 * Web platform selection. See `createStorageAdapter.native.ts` for why this is
 * split by file extension rather than a runtime check.
 */

import { IndexedDbStorageAdapter } from './indexedDbStorageAdapter';
import type { StorageAdapter } from './StorageAdapter';

export function createStorageAdapter(): StorageAdapter {
  return new IndexedDbStorageAdapter();
}
