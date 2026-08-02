/**
 * Project repository (S2-5).
 *
 * Same local-first shape as `PatternRepository`, with one difference that
 * matters: **progress writes are debounced to the remote store.** Local writes
 * stay immediate, so nothing is ever lost on this device; only the Firestore
 * write is coalesced. See ADR-005 section 8 for the free-tier arithmetic.
 *
 * Callers must call `flush()` on sign-out and on app background, or the last
 * few seconds of stitching reach local storage but not the account.
 */

import { collectProjectAgainstPatternIssues, collectProjectIssues } from '../domain/guards';
import { markCell, markLine, markPlacement, markPoint } from '../domain/progress';
import { DomainParseError } from '../domain/serialization';
import type { Pattern, Project } from '../domain/types';
import type { StorageAdapter } from '../storage/StorageAdapter';
import { FlushScheduler } from './flushScheduler';
import type { FlushSchedulerOptions } from './flushScheduler';
import { RemoteSyncError } from './errors';

const KEY_PREFIX = 'stitchmap:project:';
const INDEX_KEY = 'stitchmap:projects:index';

export interface ProjectSummary {
  readonly id: string;
  readonly patternId: string;
  readonly updatedAt: string;
}

export interface RemoteProjectStore {
  save(project: Project): Promise<void>;
  load(projectId: string): Promise<Project | null>;
  list(): Promise<ProjectSummary[]>;
  remove(projectId: string): Promise<void>;
}

function summarize(project: Project): ProjectSummary {
  return { id: project.id, patternId: project.patternId, updatedAt: project.updatedAt };
}

function projectKey(id: string): string {
  return `${KEY_PREFIX}${id}`;
}

export interface ProjectRepositoryOptions {
  readonly storage: StorageAdapter;
  readonly remote?: RemoteProjectStore;
  /** Tuning and time injection for the debounce. */
  readonly flush?: FlushSchedulerOptions;
  /**
   * Called when a debounced remote write fails. Because the failure happens
   * after the caller's await resolved, there is nobody left to throw to.
   */
  readonly onSyncError?: (error: RemoteSyncError) => void;
}

export class ProjectRepository {
  private readonly storage: StorageAdapter;
  private readonly remote?: RemoteProjectStore;
  private readonly onSyncError?: (error: RemoteSyncError) => void;
  private readonly scheduler: FlushScheduler;

  /** Projects changed locally but not yet written remotely, by id. */
  private readonly dirty = new Map<string, Project>();

  constructor({ storage, remote, flush, onSyncError }: ProjectRepositoryOptions) {
    this.storage = storage;
    this.remote = remote;
    this.onSyncError = onSyncError;
    this.scheduler = new FlushScheduler(() => this.flushDirty(), flush ?? {});
  }

  /* ---------------- index ---------------- */

  private async readIndex(): Promise<ProjectSummary[]> {
    const raw = await this.storage.getItem(INDEX_KEY);
    if (raw === null) {
      return [];
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as ProjectSummary[]) : [];
    } catch {
      // As with patterns, a corrupt index costs listing, not data.
      return [];
    }
  }

  private async writeIndex(entries: readonly ProjectSummary[]): Promise<void> {
    await this.storage.setItem(INDEX_KEY, JSON.stringify(entries));
  }

  private async upsertIndex(project: Project): Promise<void> {
    const entries = await this.readIndex();
    const next = entries.filter((entry) => entry.id !== project.id);
    next.push(summarize(project));
    next.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
    await this.writeIndex(next);
  }

  /* ---------------- reads ---------------- */

  async get(projectId: string): Promise<Project | null> {
    const raw = await this.storage.getItem(projectKey(projectId));
    if (raw === null) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    const issues = collectProjectIssues(parsed);
    if (issues.length > 0) {
      throw new DomainParseError('project', issues);
    }
    return parsed as Project;
  }

  /**
   * Read a project and check it against its pattern. This is where ADR-004
   * items 12 and 13 are enforced: progress cannot reference a stitch the
   * pattern does not have, and the line and point lists must line up.
   *
   * @throws DomainParseError if the pair is inconsistent.
   */
  async getForPattern(projectId: string, pattern: Pattern): Promise<Project | null> {
    const project = await this.get(projectId);
    if (project === null) {
      return null;
    }
    const issues = collectProjectAgainstPatternIssues(pattern, project);
    if (issues.length > 0) {
      throw new DomainParseError('project against its pattern', issues);
    }
    return project;
  }

  async list(): Promise<ProjectSummary[]> {
    return this.readIndex();
  }

  async fetch(projectId: string): Promise<Project | null> {
    if (this.remote === undefined) {
      return null;
    }
    const project = await this.remote.load(projectId);
    if (project === null) {
      return null;
    }
    await this.saveLocal(project);
    return project;
  }

  /* ---------------- writes ---------------- */

  private async saveLocal(project: Project): Promise<void> {
    const issues = collectProjectIssues(project);
    if (issues.length > 0) {
      throw new DomainParseError('project', issues);
    }
    await this.storage.setItem(projectKey(project.id), JSON.stringify(project));
    await this.upsertIndex(project);
  }

  /**
   * Write locally now, queue the remote write.
   *
   * Resolving before the remote write completes is deliberate: the caller's
   * data is already durable on device, and blocking each mark on a network
   * round trip is exactly the cost this avoids.
   */
  async save(project: Project): Promise<void> {
    await this.saveLocal(project);
    if (this.remote === undefined) {
      return;
    }
    this.dirty.set(project.id, project);
    this.scheduler.schedule();
  }

  /**
   * Write locally and remotely before resolving, skipping the debounce. Use for
   * project creation and deletion, which are rare and worth confirming.
   */
  async saveImmediately(project: Project): Promise<void> {
    await this.saveLocal(project);
    if (this.remote === undefined) {
      return;
    }
    this.dirty.set(project.id, project);
    this.scheduler.schedule();
    await this.scheduler.flushNow();
  }

  /** True when local changes have not yet reached the remote store. */
  get hasUnsyncedChanges(): boolean {
    return this.dirty.size > 0 || this.scheduler.hasPending;
  }

  /**
   * Write every pending change now. **Call this on sign-out and on app
   * background.** Rejects if the remote write fails, so the caller can decide
   * whether to block navigation.
   */
  async flush(): Promise<void> {
    await this.scheduler.flushNow();
  }

  private async flushDirty(): Promise<void> {
    if (this.remote === undefined || this.dirty.size === 0) {
      return;
    }
    // Snapshot, so marks arriving during the write are not dropped by the
    // clear below.
    const batch = [...this.dirty.values()];
    this.dirty.clear();

    for (const project of batch) {
      try {
        await this.remote.save(project);
      } catch (error) {
        // Put it back and re-arm, so the next flush retries rather than the
        // write being dropped on the floor.
        if (!this.dirty.has(project.id)) {
          this.dirty.set(project.id, project);
        }
        this.scheduler.schedule();
        const syncError = new RemoteSyncError(project.id, error);
        if (this.onSyncError !== undefined) {
          this.onSyncError(syncError);
        }
        throw syncError;
      }
    }
  }

  async remove(projectId: string): Promise<void> {
    this.dirty.delete(projectId);
    await this.storage.removeItem(projectKey(projectId));
    const entries = await this.readIndex();
    await this.writeIndex(entries.filter((entry) => entry.id !== projectId));

    if (this.remote === undefined) {
      return;
    }
    try {
      await this.remote.remove(projectId);
    } catch (error) {
      throw new RemoteSyncError(projectId, error);
    }
  }

  async syncIndexFromRemote(): Promise<ProjectSummary[]> {
    if (this.remote === undefined) {
      return this.readIndex();
    }
    const summaries = await this.remote.list();
    await this.writeIndex(summaries);
    return summaries;
  }

  /* ---------------- progress ---------------- */

  /**
   * Mark one placement in one cell. Returns the updated project.
   *
   * Throws if the cell holds no placement at that index, so progress can never
   * reference a stitch that is not there.
   */
  async markPlacement(
    pattern: Pattern,
    project: Project,
    x: number,
    y: number,
    placementIndex: number,
    complete: boolean,
    now: string,
  ): Promise<Project> {
    const next = markPlacement(pattern, project, x, y, placementIndex, complete, now);
    if (next === project) {
      return project;
    }
    await this.save(next);
    return next;
  }

  /** Mark every placement in one cell. */
  async markCell(
    pattern: Pattern,
    project: Project,
    x: number,
    y: number,
    complete: boolean,
    now: string,
  ): Promise<Project> {
    const next = markCell(pattern, project, x, y, complete, now);
    if (next === project) {
      return project;
    }
    await this.save(next);
    return next;
  }

  async markLine(
    project: Project,
    index: number,
    complete: boolean,
    now: string,
  ): Promise<Project> {
    const next = markLine(project, index, complete, now);
    if (next === project) {
      return project;
    }
    await this.save(next);
    return next;
  }

  async markPoint(
    project: Project,
    index: number,
    complete: boolean,
    now: string,
  ): Promise<Project> {
    const next = markPoint(project, index, complete, now);
    if (next === project) {
      return project;
    }
    await this.save(next);
    return next;
  }
}
