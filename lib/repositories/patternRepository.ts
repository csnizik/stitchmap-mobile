/**
 * Pattern repository (S2-4).
 *
 * Local-first: every write lands in the `StorageAdapter` first, then writes
 * through to the remote store. Local is authoritative, so a remote failure
 * leaves the pattern saved and readable offline.
 *
 * `StorageAdapter` is a plain key/value store with no key enumeration, so
 * `list` cannot scan. The repository maintains its own index document instead.
 * That keeps the enumeration burden here rather than forcing all three backends
 * in S2-2 to implement listing.
 */

import { parsePattern, serializePattern } from '../domain/serialization';
import type { Pattern } from '../domain/types';
import type { StorageAdapter } from '../storage/StorageAdapter';
import { RemoteSyncError } from './errors';

export { RemoteSyncError } from './errors';

const KEY_PREFIX = 'stitchmap:pattern:';
const INDEX_KEY = 'stitchmap:patterns:index';

/** Enough to render a pattern list without reading the pattern itself. */
export interface PatternSummary {
  readonly id: string;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly updatedAt: string;
}

export interface RemotePatternStore {
  save(pattern: Pattern): Promise<void>;
  load(patternId: string): Promise<Pattern | null>;
  list(): Promise<PatternSummary[]>;
  remove(patternId: string): Promise<void>;
}

function summarize(pattern: Pattern): PatternSummary {
  return {
    id: pattern.id,
    name: pattern.name,
    width: pattern.width,
    height: pattern.height,
    updatedAt: pattern.updatedAt,
  };
}

function patternKey(id: string): string {
  return `${KEY_PREFIX}${id}`;
}

export interface PatternRepositoryOptions {
  readonly storage: StorageAdapter;
  /** Omit to run local-only, which is what tests and offline use do. */
  readonly remote?: RemotePatternStore;
}

export class PatternRepository {
  private readonly storage: StorageAdapter;
  private readonly remote?: RemotePatternStore;

  constructor({ storage, remote }: PatternRepositoryOptions) {
    this.storage = storage;
    this.remote = remote;
  }

  /* ---------------- index ---------------- */

  private async readIndex(): Promise<PatternSummary[]> {
    const raw = await this.storage.getItem(INDEX_KEY);
    if (raw === null) {
      return [];
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as PatternSummary[]) : [];
    } catch {
      // A corrupt index is recoverable: the patterns themselves are still
      // stored under their own keys. Losing the index loses listing, not data,
      // so this repairs rather than throws.
      return [];
    }
  }

  private async writeIndex(entries: readonly PatternSummary[]): Promise<void> {
    await this.storage.setItem(INDEX_KEY, JSON.stringify(entries));
  }

  private async upsertIndex(pattern: Pattern): Promise<void> {
    const entries = await this.readIndex();
    const next = entries.filter((entry) => entry.id !== pattern.id);
    next.push(summarize(pattern));
    next.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
    await this.writeIndex(next);
  }

  private async removeFromIndex(patternId: string): Promise<void> {
    const entries = await this.readIndex();
    await this.writeIndex(entries.filter((entry) => entry.id !== patternId));
  }

  /* ---------------- reads ---------------- */

  /** Local read. Returns null when the pattern is not stored on this device. */
  async get(patternId: string): Promise<Pattern | null> {
    const raw = await this.storage.getItem(patternKey(patternId));
    if (raw === null) {
      return null;
    }
    // Validates on the way out of storage, so corruption surfaces here rather
    // than somewhere downstream that assumed the invariants held.
    return parsePattern(JSON.parse(raw));
  }

  /** Most recently updated first. */
  async list(): Promise<PatternSummary[]> {
    return this.readIndex();
  }

  /**
   * Fetch from the remote store and cache locally. Used when a pattern exists
   * on the account but not on this device.
   */
  async fetch(patternId: string): Promise<Pattern | null> {
    if (this.remote === undefined) {
      return null;
    }
    const pattern = await this.remote.load(patternId);
    if (pattern === null) {
      return null;
    }
    await this.saveLocal(pattern);
    return pattern;
  }

  /* ---------------- writes ---------------- */

  private async saveLocal(pattern: Pattern): Promise<void> {
    // serializePattern validates before writing, so a malformed pattern never
    // reaches storage.
    await this.storage.setItem(patternKey(pattern.id), serializePattern(pattern));
    await this.upsertIndex(pattern);
  }

  /**
   * Save locally, then write through to the remote store.
   *
   * @throws DomainParseError if the pattern is invalid; nothing is written.
   * @throws RemoteSyncError if the local write succeeded and the remote did not.
   */
  async save(pattern: Pattern): Promise<void> {
    await this.saveLocal(pattern);
    if (this.remote === undefined) {
      return;
    }
    try {
      await this.remote.save(pattern);
    } catch (error) {
      throw new RemoteSyncError(pattern.id, error);
    }
  }

  /**
   * Apply changes to a stored pattern and stamp `updatedAt`.
   *
   * @throws RangeError if the pattern is not stored locally.
   */
  async update(
    patternId: string,
    changes: Partial<Omit<Pattern, 'id' | 'schemaVersion' | 'createdAt'>>,
    now: string,
  ): Promise<Pattern> {
    const existing = await this.get(patternId);
    if (existing === null) {
      throw new RangeError(`pattern "${patternId}" is not stored locally`);
    }
    const updated: Pattern = { ...existing, ...changes, updatedAt: now };
    await this.save(updated);
    return updated;
  }

  /**
   * Delete locally, then remotely.
   *
   * @throws RemoteSyncError if the local delete succeeded and the remote did not.
   */
  async remove(patternId: string): Promise<void> {
    await this.storage.removeItem(patternKey(patternId));
    await this.removeFromIndex(patternId);
    if (this.remote === undefined) {
      return;
    }
    try {
      await this.remote.remove(patternId);
    } catch (error) {
      throw new RemoteSyncError(patternId, error);
    }
  }

  /**
   * Replace the local index and cache from the remote store's listing. This is
   * the read half of hydrate-on-sign-in; the full sync loop is S2-6.
   */
  async syncIndexFromRemote(): Promise<PatternSummary[]> {
    if (this.remote === undefined) {
      return this.readIndex();
    }
    const summaries = await this.remote.list();
    await this.writeIndex(summaries);
    return summaries;
  }
}
