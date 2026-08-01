import { collectPatternIssues } from '../../domain/guards';
import { countPlacements } from '../../domain/progress';
import { DomainParseError } from '../../domain/serialization';
import type { Pattern } from '../../domain/types';
import { createSamplePattern } from '../../samples/samplePattern';
import { InMemoryStorageAdapter } from '../../storage/StorageAdapter';
import { PatternRepository, RemoteSyncError } from '../patternRepository';
import type { PatternSummary, RemotePatternStore } from '../patternRepository';

const NOW = '2026-08-01T12:00:00.000Z';

/** Records calls so write-through can be asserted without Firestore. */
class FakeRemote implements RemotePatternStore {
  readonly saved: Pattern[] = [];
  readonly removed: string[] = [];
  failNext = false;

  save(pattern: Pattern): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      return Promise.reject(new Error('network down'));
    }
    this.saved.push(pattern);
    return Promise.resolve();
  }

  load(patternId: string): Promise<Pattern | null> {
    const found = this.saved.filter((p) => p.id === patternId).pop();
    return Promise.resolve(found ?? null);
  }

  list(): Promise<PatternSummary[]> {
    return Promise.resolve(
      this.saved.map((p) => ({
        id: p.id,
        name: p.name,
        width: p.width,
        height: p.height,
        updatedAt: p.updatedAt,
      })),
    );
  }

  remove(patternId: string): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      return Promise.reject(new Error('network down'));
    }
    this.removed.push(patternId);
    return Promise.resolve();
  }
}

describe('sample pattern', () => {
  const pattern = createSamplePattern();

  it('satisfies every domain invariant', () => {
    expect(collectPatternIssues(pattern)).toEqual([]);
  });

  it('exercises all three stitch layers', () => {
    expect(countPlacements(pattern)).toBeGreaterThan(0);
    expect(pattern.lines.length).toBeGreaterThan(0);
    expect(pattern.points.length).toBeGreaterThan(0);
  });

  it('includes every cell-occupying kind', () => {
    const kinds = new Set(pattern.cellContents.flat().map((p) => p.kind));
    expect(kinds).toEqual(new Set(['full', 'half', 'quarter', 'threeQuarter']));
  });

  it('includes a cell holding two placements of different threads', () => {
    const shared = pattern.cellContents.find((content) => content.length > 1);
    expect(shared).toBeDefined();
    expect(new Set(shared?.map((p) => p.thread)).size).toBeGreaterThan(1);
  });

  it('includes both line kinds and a knot at a cell centre', () => {
    expect(new Set(pattern.lines.map((l) => l.kind))).toEqual(new Set(['backstitch', 'straight']));
    expect(pattern.points.some((p) => p.at.x % 1 === 0.5)).toBe(true);
  });

  it('returns an independent instance each call', () => {
    expect(createSamplePattern()).not.toBe(createSamplePattern());
    expect(createSamplePattern('other').id).toBe('other');
  });
});

describe('PatternRepository, local only', () => {
  let repo: PatternRepository;

  beforeEach(() => {
    repo = new PatternRepository({ storage: new InMemoryStorageAdapter() });
  });

  it('returns null for an unknown pattern', async () => {
    await expect(repo.get('missing')).resolves.toBeNull();
  });

  it('starts with an empty list', async () => {
    await expect(repo.list()).resolves.toEqual([]);
  });

  it('round trips a pattern through storage', async () => {
    const pattern = createSamplePattern();
    await repo.save(pattern);
    await expect(repo.get(pattern.id)).resolves.toEqual(pattern);
  });

  it('indexes a saved pattern', async () => {
    const pattern = createSamplePattern();
    await repo.save(pattern);
    await expect(repo.list()).resolves.toEqual([
      {
        id: pattern.id,
        name: pattern.name,
        width: pattern.width,
        height: pattern.height,
        updatedAt: pattern.updatedAt,
      },
    ]);
  });

  it('does not duplicate the index entry on re-save', async () => {
    const pattern = createSamplePattern();
    await repo.save(pattern);
    await repo.save(pattern);
    await expect(repo.list()).resolves.toHaveLength(1);
  });

  it('lists most recently updated first', async () => {
    await repo.save({ ...createSamplePattern('older'), updatedAt: '2026-01-01T00:00:00.000Z' });
    await repo.save({ ...createSamplePattern('newer'), updatedAt: '2026-06-01T00:00:00.000Z' });
    const ids = (await repo.list()).map((entry) => entry.id);
    expect(ids).toEqual(['newer', 'older']);
  });

  it('refuses to store an invalid pattern', async () => {
    const broken = { ...createSamplePattern(), width: -1 } as Pattern;
    await expect(repo.save(broken)).rejects.toBeInstanceOf(DomainParseError);
    await expect(repo.list()).resolves.toEqual([]);
  });

  it('updates and stamps updatedAt', async () => {
    const pattern = createSamplePattern();
    await repo.save(pattern);
    const updated = await repo.update(pattern.id, { name: 'Renamed' }, NOW);
    expect(updated.name).toBe('Renamed');
    expect(updated.updatedAt).toBe(NOW);
    expect(updated.createdAt).toBe(pattern.createdAt);
    await expect(repo.get(pattern.id)).resolves.toEqual(updated);
  });

  it('refuses to update a pattern that is not stored', async () => {
    await expect(repo.update('missing', { name: 'x' }, NOW)).rejects.toBeInstanceOf(RangeError);
  });

  it('removes a pattern and its index entry', async () => {
    const pattern = createSamplePattern();
    await repo.save(pattern);
    await repo.remove(pattern.id);
    await expect(repo.get(pattern.id)).resolves.toBeNull();
    await expect(repo.list()).resolves.toEqual([]);
  });

  it('survives a corrupt index without losing the patterns', async () => {
    const storage = new InMemoryStorageAdapter();
    const corrupted = new PatternRepository({ storage });
    const pattern = createSamplePattern();
    await corrupted.save(pattern);
    await storage.setItem('stitchmap:patterns:index', '{not json');

    await expect(corrupted.list()).resolves.toEqual([]);
    // The pattern itself is stored under its own key and is still readable.
    await expect(corrupted.get(pattern.id)).resolves.toEqual(pattern);
  });
});

describe('PatternRepository, write-through', () => {
  let remote: FakeRemote;
  let repo: PatternRepository;

  beforeEach(() => {
    remote = new FakeRemote();
    repo = new PatternRepository({ storage: new InMemoryStorageAdapter(), remote });
  });

  it('writes through on save', async () => {
    const pattern = createSamplePattern();
    await repo.save(pattern);
    expect(remote.saved).toHaveLength(1);
    expect(remote.saved[0].id).toBe(pattern.id);
  });

  it('keeps the local copy when the remote write fails', async () => {
    const pattern = createSamplePattern();
    remote.failNext = true;

    await expect(repo.save(pattern)).rejects.toBeInstanceOf(RemoteSyncError);
    // Local-first: the data is safe even though sync is behind.
    await expect(repo.get(pattern.id)).resolves.toEqual(pattern);
    await expect(repo.list()).resolves.toHaveLength(1);
  });

  it('names the pattern in the sync error', async () => {
    const pattern = createSamplePattern();
    remote.failNext = true;
    await expect(repo.save(pattern)).rejects.toThrow(pattern.id);
  });

  it('writes through on remove', async () => {
    const pattern = createSamplePattern();
    await repo.save(pattern);
    await repo.remove(pattern.id);
    expect(remote.removed).toEqual([pattern.id]);
  });

  it('removes locally even when the remote delete fails', async () => {
    const pattern = createSamplePattern();
    await repo.save(pattern);
    remote.failNext = true;

    await expect(repo.remove(pattern.id)).rejects.toBeInstanceOf(RemoteSyncError);
    await expect(repo.get(pattern.id)).resolves.toBeNull();
  });

  it('fetches a pattern absent locally and caches it', async () => {
    const pattern = createSamplePattern();
    await remote.save(pattern);

    await expect(repo.get(pattern.id)).resolves.toBeNull();
    await expect(repo.fetch(pattern.id)).resolves.toEqual(pattern);
    // Cached, so a second read needs no remote call.
    await expect(repo.get(pattern.id)).resolves.toEqual(pattern);
  });

  it('returns null when fetching something the remote does not have', async () => {
    await expect(repo.fetch('missing')).resolves.toBeNull();
  });

  it('replaces the local index from the remote listing', async () => {
    await remote.save(createSamplePattern('remote-only'));
    const summaries = await repo.syncIndexFromRemote();
    expect(summaries.map((entry) => entry.id)).toEqual(['remote-only']);
    await expect(repo.list()).resolves.toHaveLength(1);
  });
});
