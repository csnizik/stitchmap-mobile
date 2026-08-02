/**
 * Native platform selection.
 *
 * Metro resolves `.native.ts` for iOS and Android and `.web.ts` for web, so
 * platform choice happens at bundle time rather than through a runtime
 * `Platform.OS` check. That also guarantees the MMKV native module is never
 * pulled into the web bundle, which a runtime branch could not promise.
 */

import { MmkvStorageAdapter } from './mmkvStorageAdapter';
import type { StorageAdapter } from './StorageAdapter';

export function createStorageAdapter(): StorageAdapter {
  return new MmkvStorageAdapter();
}
