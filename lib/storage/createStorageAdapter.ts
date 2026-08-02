/**
 * Fallback used only when neither platform-specific file resolves, which in
 * practice means a plain Node context such as jest without a platform preset.
 *
 * Storing to memory there is correct: tests should not touch a real backend,
 * and failing loudly would break every suite that constructs a repository.
 */

import { InMemoryStorageAdapter } from './StorageAdapter';
import type { StorageAdapter } from './StorageAdapter';

export function createStorageAdapter(): StorageAdapter {
  return new InMemoryStorageAdapter();
}
