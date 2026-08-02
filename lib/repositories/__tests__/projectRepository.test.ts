import { createEmptyProject } from '../../domain/progress';
import { DomainParseError } from '../../domain/serialization';
import type { Pattern, Project } from '../../domain/types';
import { createSamplePattern } from '../../samples/samplePattern';
import { InMemoryStorageAdapter } from '../../storage/StorageAdapter';
import {
  DEFAULT_IDLE_MS,
  DEFAULT_MAX_WAIT_MS,
  FlushScheduler,
} from '../flushScheduler';
import { RemoteSyncError } from '../errors';
import { ProjectRepository } from '../projectRepository';
import type { ProjectSummary, RemoteProjectStore } from '../projectRepository';

const NOW = '2026-08-01T12:00:00.000Z';
const LATER = '2026-08-01T12:00:05.000Z';

/** Drives time by hand, so debounce behaviour is asserted rather than waited on. */
class FakeClock {
  private time = 0;
  private nextId = 1;
  private readonly timers = new Map<number, { at: number; handler: () => void }>();

  now = (): number => this.time;

  setTimeout = (handler: () => void, ms: number): unknown => {
    const id = this.nextId;
    this.nextId += 1;
    this.timers.set(id, { at: this.time + ms, handler });
    return id;
  };

  clearTimeout = (handle: unknown): void => {
    this.timers.delete(handle as number);
  };

  /** Advance time, firing anything due. */
  advance(ms: number): void {
    const target = this.time + ms;
    for (;;) {
      const due = [...this.timers.entries()]
        .filter(([, timer]) => timer.at <= target)
        .sort((a, b) => a[1].at - b[1].at);
      if (due.length === 0) {
        break;
      }
      const [id, timer] = due[0];
      this.timers.delete(id);
      this.time = timer.at;
      timer.handler();
    }
    this.time = target;
  }

  get pendingCount(): number {
    return this.timers.size;
  }
}

class FakeRemote implements RemoteProjectStore {
  readonly saves: Project[] = [];
  readonly removed: string[] = [];
  failNext = false;

  save(project: Project): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      return Promise.reject(new Error('network down'));
    }
    this.saves.push(project);
    return Promise.resolve();
  }

  load(projectId: string): Promise<Project | null> {
    return Promise.resolve(this.saves.filter((p) => p.id === projectId).pop() ?? null);
  }

  list(): Promise<ProjectSummary[]> {
    return Promise.resolve(
      this.saves.map((p) => ({ id: p.id, patternId: p.patternId, updatedAt: p.updatedAt })),
    );
  }

  remove(projectId: string): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      return Promise.reject(new Error('network down'));
    }
    this.removed.push(projectId);
    return Promise.resolve();
  }
}

/** Let queued promise callbacks run without advancing fake time. */
const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe('FlushScheduler', () => {
  let clock: FakeClock;
  let flushes: number;
  let scheduler: FlushScheduler;

  beforeEach(() => {
    clock = new FakeClock();
    flushes = 0;
    scheduler = new FlushScheduler(
      () => {
        flushes += 1;
        return Promise.resolve();
      },
      {
        idleMs: DEFAULT_IDLE_MS,
        maxWaitMs: DEFAULT_MAX_WAIT_MS,
        setTimeoutFn: clock.setTimeout,
        clearTimeoutFn: clock.clearTimeout,
        now: clock.now,
      },
    );
  });

  it('does not flush before the idle window elapses', () => {
    scheduler.schedule();
    clock.advance(DEFAULT_IDLE_MS - 1);
    expect(flushes).toBe(0);
  });

  it('flushes once the idle window elapses', () => {
    scheduler.schedule();
    clock.advance(DEFAULT_IDLE_MS);
    expect(flushes).toBe(1);
  });

  it('coalesces rapid changes into a single flush', () => {
    for (let i = 0; i < 50; i += 1) {
      scheduler.schedule();
      clock.advance(100);
    }
    clock.advance(DEFAULT_IDLE_MS);
    expect(flushes).toBe(1);
  });

  it('flushes at the maximum wait during continuous activity', () => {
    // A change every 1s never lets the 5s idle timer fire, so only the 30s
    // ceiling bounds how much work is at risk.
    for (let i = 0; i < 29; i += 1) {
      scheduler.schedule();
      clock.advance(1_000);
    }
    expect(flushes).toBe(0);

    scheduler.schedule();
    clock.advance(1_000);
    expect(flushes).toBe(1);
  });

  it('starts a fresh window after flushing', async () => {
    scheduler.schedule();
    clock.advance(DEFAULT_IDLE_MS);
    expect(flushes).toBe(1);

    // Real timers fire as macrotasks with microtasks drained in between, so a
    // settle here matches production rather than papering over anything.
    await settle();

    scheduler.schedule();
    clock.advance(DEFAULT_IDLE_MS);
    expect(flushes).toBe(2);
  });

  it('reports pending work', () => {
    expect(scheduler.hasPending).toBe(false);
    scheduler.schedule();
    expect(scheduler.hasPending).toBe(true);
    clock.advance(DEFAULT_IDLE_MS);
    expect(scheduler.hasPending).toBe(false);
  });

  it('flushes immediately on demand', async () => {
    scheduler.schedule();
    await scheduler.flushNow();
    expect(flushes).toBe(1);
  });

  it('does nothing when flushing with no pending changes', async () => {
    await scheduler.flushNow();
    expect(flushes).toBe(0);
  });

  it('cancels without writing', () => {
    scheduler.schedule();
    scheduler.cancel();
    clock.advance(DEFAULT_MAX_WAIT_MS * 2);
    expect(flushes).toBe(0);
  });

  it('leaves no timer armed after a flush', () => {
    scheduler.schedule();
    clock.advance(DEFAULT_IDLE_MS);
    expect(clock.pendingCount).toBe(0);
  });
});

describe('ProjectRepository, local only', () => {
  let pattern: Pattern;
  let project: Project;
  let repo: ProjectRepository;

  beforeEach(() => {
    pattern = createSamplePattern();
    project = createEmptyProject({ id: 'project-1', pattern, now: NOW });
    repo = new ProjectRepository({ storage: new InMemoryStorageAdapter() });
  });

  it('returns null for an unknown project', async () => {
    await expect(repo.get('missing')).resolves.toBeNull();
  });

  it('round trips a project', async () => {
    await repo.save(project);
    await expect(repo.get(project.id)).resolves.toEqual(project);
  });

  it('indexes and lists', async () => {
    await repo.save(project);
    await expect(repo.list()).resolves.toEqual([
      { id: project.id, patternId: pattern.id, updatedAt: NOW },
    ]);
  });

  it('refuses to store an invalid project', async () => {
    await expect(repo.save({ ...project, width: -1 })).rejects.toBeInstanceOf(
      DomainParseError,
    );
  });

  it('removes a project and its index entry', async () => {
    await repo.save(project);
    await repo.remove(project.id);
    await expect(repo.get(project.id)).resolves.toBeNull();
    await expect(repo.list()).resolves.toEqual([]);
  });

  it('validates a project against its pattern', async () => {
    await repo.save(project);
    await expect(repo.getForPattern(project.id, pattern)).resolves.toEqual(project);
  });

  it('rejects a project whose pattern does not match', async () => {
    await repo.save(project);
    const otherPattern = createSamplePattern('different');
    await expect(repo.getForPattern(project.id, otherPattern)).rejects.toBeInstanceOf(
      DomainParseError,
    );
  });

  it('rejects progress marking a stitch the pattern does not have', async () => {
    // Bit 2 set in a cell that holds at most two placements.
    const tampered: Project = {
      ...project,
      cellProgress: {
        width: pattern.width,
        height: pattern.height,
        rows: project.cellProgress.rows.map((row, y) =>
          y === 0 ? [{ value: 0b100, count: pattern.width }] : row,
        ),
      },
    };
    await repo.save(tampered);
    await expect(repo.getForPattern(project.id, pattern)).rejects.toBeInstanceOf(
      DomainParseError,
    );
  });
});

describe('ProjectRepository, debounced write-through', () => {
  let clock: FakeClock;
  let remote: FakeRemote;
  let pattern: Pattern;
  let project: Project;
  let repo: ProjectRepository;

  beforeEach(() => {
    clock = new FakeClock();
    remote = new FakeRemote();
    pattern = createSamplePattern();
    project = createEmptyProject({ id: 'project-1', pattern, now: NOW });
    repo = new ProjectRepository({
      storage: new InMemoryStorageAdapter(),
      remote,
      flush: {
        setTimeoutFn: clock.setTimeout,
        clearTimeoutFn: clock.clearTimeout,
        now: clock.now,
      },
    });
  });

  it('writes locally without waiting for the remote', async () => {
    await repo.save(project);
    await expect(repo.get(project.id)).resolves.toEqual(project);
    expect(remote.saves).toHaveLength(0);
  });

  it('reaches the remote after the idle window', async () => {
    await repo.save(project);
    clock.advance(DEFAULT_IDLE_MS);
    await settle();
    expect(remote.saves).toHaveLength(1);
  });

  it('coalesces many marks into one remote write', async () => {
    let current = project;
    // Mark every placement in the top row, one at a time.
    for (let x = 0; x < pattern.width; x += 1) {
      current = await repo.markCell(pattern, current, x, 0, true, LATER);
      clock.advance(200);
    }
    clock.advance(DEFAULT_IDLE_MS);
    await settle();

    // The whole point: eight marks, one write.
    expect(remote.saves).toHaveLength(1);
    expect(remote.saves[0].updatedAt).toBe(LATER);
  });

  it('bounds risk during continuous stitching via the maximum wait', async () => {
    let current = project;
    for (let i = 0; i < 30; i += 1) {
      current = await repo.markLine(current, 0, i % 2 === 0, LATER);
      clock.advance(1_000);
      await settle();
    }
    expect(remote.saves.length).toBeGreaterThanOrEqual(1);
  });

  it('reports unsynced changes until the flush lands', async () => {
    await repo.save(project);
    expect(repo.hasUnsyncedChanges).toBe(true);
    clock.advance(DEFAULT_IDLE_MS);
    await settle();
    expect(repo.hasUnsyncedChanges).toBe(false);
  });

  it('flushes on demand, for sign-out and backgrounding', async () => {
    await repo.save(project);
    await repo.flush();
    expect(remote.saves).toHaveLength(1);
    expect(repo.hasUnsyncedChanges).toBe(false);
  });

  it('writes immediately when asked, skipping the debounce', async () => {
    await repo.saveImmediately(project);
    expect(remote.saves).toHaveLength(1);
  });

  it('keeps the change queued when a flush fails', async () => {
    await repo.save(project);
    remote.failNext = true;

    await expect(repo.flush()).rejects.toBeInstanceOf(RemoteSyncError);
    // Not lost: still local, and still queued for the next attempt.
    await expect(repo.get(project.id)).resolves.toEqual(project);
    expect(repo.hasUnsyncedChanges).toBe(true);

    await repo.flush();
    expect(remote.saves).toHaveLength(1);
  });

  it('reports a failed background flush through the callback', async () => {
    const errors: RemoteSyncError[] = [];
    const watched = new ProjectRepository({
      storage: new InMemoryStorageAdapter(),
      remote,
      flush: {
        setTimeoutFn: clock.setTimeout,
        clearTimeoutFn: clock.clearTimeout,
        now: clock.now,
      },
      onSyncError: (error) => errors.push(error),
    });

    await watched.save(project);
    remote.failNext = true;
    clock.advance(DEFAULT_IDLE_MS);
    await settle();

    expect(errors).toHaveLength(1);
    expect(errors[0].id).toBe(project.id);
  });

  it('sends only the latest state of a project', async () => {
    const first = await repo.markLine(project, 0, true, LATER);
    await repo.markPoint(first, 0, true, LATER);
    clock.advance(DEFAULT_IDLE_MS);
    await settle();

    expect(remote.saves).toHaveLength(1);
    expect(remote.saves[0].pointProgress).toEqual(
      expect.arrayContaining([expect.objectContaining({ value: true })]),
    );
  });

  it('does not queue a write when a mark changes nothing', async () => {
    const marked = await repo.markLine(project, 0, true, LATER);
    await repo.flush();
    expect(remote.saves).toHaveLength(1);

    const again = await repo.markLine(marked, 0, true, LATER);
    expect(again).toBe(marked);
    expect(repo.hasUnsyncedChanges).toBe(false);
  });

  it('drops a queued write when the project is removed', async () => {
    await repo.save(project);
    await repo.remove(project.id);
    clock.advance(DEFAULT_IDLE_MS);
    await settle();

    expect(remote.saves).toHaveLength(0);
    expect(remote.removed).toEqual([project.id]);
  });

  it('fetches a project absent locally and caches it', async () => {
    await remote.save(project);
    await expect(repo.get(project.id)).resolves.toBeNull();
    await expect(repo.fetch(project.id)).resolves.toEqual(project);
    await expect(repo.get(project.id)).resolves.toEqual(project);
  });

  it('replaces the local index from the remote listing', async () => {
    await remote.save(project);
    const summaries = await repo.syncIndexFromRemote();
    expect(summaries.map((entry) => entry.id)).toEqual([project.id]);
  });
});
