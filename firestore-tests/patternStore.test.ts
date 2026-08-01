/**
 * FirestorePatternStore against the local Firestore emulator.
 *
 *   npm run test:rules
 *
 * These cover the parts of the ADR-005 write protocol that unit tests cannot:
 * real batching, real subcollection reads, real document ordering, and the
 * nested-array constraint that shaped the schema in the first place.
 *
 * Kept out of `npm test` alongside the rules tests, since CI has no emulator.
 */

import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

import { buildCellGrid } from '../lib/domain/cells';
import { SCHEMA_VERSION } from '../lib/domain/types';
import type { LineStitch, Pattern, Placement } from '../lib/domain/types';
import { CHUNK_BUDGET_BYTES } from '../lib/firestore/chunking';
import { FirestorePatternStore } from '../lib/repositories/firestorePatternStore';
import { createSamplePattern } from '../lib/samples/samplePattern';

/** Must match the --project flag in the test:rules script. */
const PROJECT_ID = 'demo-stitchmap';
const UID = 'user-owner';

let testEnv: RulesTestEnvironment;
let db: Firestore;
let store: FirestorePatternStore;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { host: '127.0.0.1', port: 8080 },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  db = testEnv.authenticatedContext(UID).firestore() as unknown as Firestore;
  store = new FirestorePatternStore(db, UID);
});

/* ------------------------------------------------------------------ *
 * Fixtures large enough to force chunking
 * ------------------------------------------------------------------ */

const FULL: Placement = { kind: 'full', thread: 'navy' };

/**
 * A pattern whose grid exceeds the chunk budget. Alternating cells defeat
 * run-length encoding on purpose, so every cell is its own run and the encoded
 * size grows predictably.
 */
function makeMultiChunkPattern(id: string, width: number, height: number): Pattern {
  const cells: Placement[][] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      cells.push((x + y) % 2 === 0 ? [FULL] : []);
    }
  }
  const built = buildCellGrid(width, height, cells);
  return {
    schemaVersion: SCHEMA_VERSION,
    id,
    name: 'Large',
    width,
    height,
    palette: [
      { key: 'navy', symbol: 'N', color: '#1b2a4a', brand: 'DMC', code: '336', label: 'Navy' },
    ],
    cellContents: built.cellContents,
    cells: built.cells,
    lines: [],
    points: [],
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  };
}

/** Enough backstitch to push the lines list out of the parent document. */
function withSpilledLines(pattern: Pattern, count: number): Pattern {
  const lines: LineStitch[] = [];
  for (let i = 0; i < count; i += 1) {
    const y = i % pattern.height;
    lines.push({
      id: `line-${i}`,
      kind: 'backstitch',
      from: { x: 0, y },
      to: { x: pattern.width, y },
      thread: 'navy',
    });
  }
  return { ...pattern, lines };
}

async function chunkCount(patternId: string, subcollection: string): Promise<number> {
  const snapshot = await getDocs(
    collection(db, `users/${UID}/patterns/${patternId}/${subcollection}`),
  );
  return snapshot.size;
}

/* ------------------------------------------------------------------ *
 * Tests
 * ------------------------------------------------------------------ */

describe('single chunk patterns', () => {
  it('round trips the sample pattern intact', async () => {
    const pattern = createSamplePattern();
    await store.save(pattern);
    await expect(store.load(pattern.id)).resolves.toEqual(pattern);
  });

  it('preserves all three stitch layers through the round trip', async () => {
    const pattern = createSamplePattern();
    await store.save(pattern);
    const loaded = await store.load(pattern.id);

    expect(loaded?.lines).toEqual(pattern.lines);
    expect(loaded?.points).toEqual(pattern.points);
    expect(loaded?.cellContents).toEqual(pattern.cellContents);
  });

  it('writes one chunk for a small grid', async () => {
    const pattern = createSamplePattern();
    await store.save(pattern);
    await expect(chunkCount(pattern.id, 'chunks')).resolves.toBe(1);
  });

  it('keeps small line and point lists inline, with no spill subcollections', async () => {
    const pattern = createSamplePattern();
    await store.save(pattern);

    const parent = await getDoc(doc(db, `users/${UID}/patterns/${pattern.id}`));
    const data = parent.data() as { lines?: unknown[]; linesChunkCount: number };
    expect(data.linesChunkCount).toBe(0);
    expect(Array.isArray(data.lines)).toBe(true);
    await expect(chunkCount(pattern.id, 'lineChunks')).resolves.toBe(0);
  });

  it('stores cellContents as a JSON string, since Firestore rejects nested arrays', async () => {
    const pattern = createSamplePattern();
    await store.save(pattern);

    const parent = await getDoc(doc(db, `users/${UID}/patterns/${pattern.id}`));
    expect(typeof (parent.data() as { cellContents: unknown }).cellContents).toBe('string');
  });

  it('returns null for a pattern that does not exist', async () => {
    await expect(store.load('missing')).resolves.toBeNull();
  });
});

describe('multi chunk patterns', () => {
  // 200 wide by 300 tall with alternating cells encodes to roughly 240 KB,
  // which is above the 200 KB budget and so must split.
  const WIDTH = 200;
  const HEIGHT = 300;

  it('splits a large grid across chunks', async () => {
    const pattern = makeMultiChunkPattern('large', WIDTH, HEIGHT);
    await store.save(pattern);
    await expect(chunkCount(pattern.id, 'chunks')).resolves.toBeGreaterThan(1);
  });

  it('round trips a chunked grid exactly', async () => {
    const pattern = makeMultiChunkPattern('large', WIDTH, HEIGHT);
    await store.save(pattern);
    await expect(store.load(pattern.id)).resolves.toEqual(pattern);
  });

  it('keeps every chunk under the budget', async () => {
    const pattern = makeMultiChunkPattern('large', WIDTH, HEIGHT);
    await store.save(pattern);

    const snapshot = await getDocs(collection(db, `users/${UID}/patterns/${pattern.id}/chunks`));
    for (const entry of snapshot.docs) {
      expect((entry.data() as { data: string }).data.length).toBeLessThanOrEqual(
        CHUNK_BUDGET_BYTES,
      );
    }
  });

  it('names chunks with zero padded ids so they sort correctly', async () => {
    const pattern = makeMultiChunkPattern('large', WIDTH, HEIGHT);
    await store.save(pattern);

    const snapshot = await getDocs(collection(db, `users/${UID}/patterns/${pattern.id}/chunks`));
    const ids = snapshot.docs.map((entry) => entry.id).sort();
    expect(ids[0]).toBe('0000');
    // Firestore returns documents in id order, so a lexicographic sort must
    // match the numeric chunk order.
    ids.forEach((id, i) => {
      expect(id).toBe(String(i).padStart(4, '0'));
    });
  });
});

describe('spilled line and point lists', () => {
  it('moves an oversized lines list into its own subcollection', async () => {
    const base = makeMultiChunkPattern('spilled', 100, 20);
    const pattern = withSpilledLines(base, 3000);
    await store.save(pattern);

    const parent = await getDoc(doc(db, `users/${UID}/patterns/${pattern.id}`));
    const data = parent.data() as { lines?: unknown[]; linesChunkCount: number };
    expect(data.linesChunkCount).toBeGreaterThan(0);
    // Inline copy is omitted entirely when spilled, so the parent stays small.
    expect(data.lines).toBeUndefined();
    await expect(chunkCount(pattern.id, 'lineChunks')).resolves.toBe(data.linesChunkCount);
  });

  it('round trips a spilled lines list in order', async () => {
    const base = makeMultiChunkPattern('spilled', 100, 20);
    const pattern = withSpilledLines(base, 3000);
    await store.save(pattern);

    const loaded = await store.load(pattern.id);
    expect(loaded?.lines).toHaveLength(3000);
    expect(loaded?.lines).toEqual(pattern.lines);
  });
});

describe('updates and stale chunk cleanup', () => {
  it('deletes chunks that a smaller rewrite no longer needs', async () => {
    const large = makeMultiChunkPattern('shrinking', 200, 300);
    await store.save(large);
    const before = await chunkCount(large.id, 'chunks');
    expect(before).toBeGreaterThan(1);

    // Same id, far smaller grid.
    const small = makeMultiChunkPattern('shrinking', 8, 8);
    await store.save(small);

    await expect(chunkCount(small.id, 'chunks')).resolves.toBe(1);
    await expect(store.load(small.id)).resolves.toEqual(small);
  });

  it('clears spill subcollections when a list shrinks back inline', async () => {
    const base = makeMultiChunkPattern('unspilling', 100, 20);
    await store.save(withSpilledLines(base, 3000));
    await expect(chunkCount(base.id, 'lineChunks')).resolves.toBeGreaterThan(0);

    await store.save({ ...base, lines: [] });

    await expect(chunkCount(base.id, 'lineChunks')).resolves.toBe(0);
    const loaded = await store.load(base.id);
    expect(loaded?.lines).toEqual([]);
  });

  it('overwrites metadata on re-save', async () => {
    const pattern = createSamplePattern();
    await store.save(pattern);
    await store.save({ ...pattern, name: 'Renamed', updatedAt: '2026-09-01T00:00:00.000Z' });

    const loaded = await store.load(pattern.id);
    expect(loaded?.name).toBe('Renamed');
    expect(loaded?.updatedAt).toBe('2026-09-01T00:00:00.000Z');
  });
});

describe('listing', () => {
  it('returns an empty list for an account with no patterns', async () => {
    await expect(store.list()).resolves.toEqual([]);
  });

  it('summarises patterns without reading chunks', async () => {
    await store.save(createSamplePattern('first'));
    await store.save({ ...createSamplePattern('second'), name: 'Second' });

    const summaries = await store.list();
    expect(summaries).toHaveLength(2);
    expect(summaries.map((entry) => entry.id).sort()).toEqual(['first', 'second']);
  });

  it('orders by updatedAt, most recent first', async () => {
    await store.save({
      ...createSamplePattern('older'),
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    await store.save({
      ...createSamplePattern('newer'),
      updatedAt: '2026-06-01T00:00:00.000Z',
    });

    const ids = (await store.list()).map((entry) => entry.id);
    expect(ids).toEqual(['newer', 'older']);
  });
});

describe('deletion', () => {
  it('removes the parent document', async () => {
    const pattern = createSamplePattern();
    await store.save(pattern);
    await store.remove(pattern.id);
    await expect(store.load(pattern.id)).resolves.toBeNull();
  });

  it('removes chunk subcollections, which Firestore does not cascade', async () => {
    const pattern = makeMultiChunkPattern('doomed', 200, 300);
    await store.save(pattern);
    expect(await chunkCount(pattern.id, 'chunks')).toBeGreaterThan(1);

    await store.remove(pattern.id);

    await expect(chunkCount(pattern.id, 'chunks')).resolves.toBe(0);
  });

  it('removes spilled line chunks too', async () => {
    const base = makeMultiChunkPattern('doomed-lines', 100, 20);
    await store.save(withSpilledLines(base, 3000));
    await store.remove(base.id);
    await expect(chunkCount(base.id, 'lineChunks')).resolves.toBe(0);
  });

  it('drops a pattern from the listing', async () => {
    const pattern = createSamplePattern();
    await store.save(pattern);
    await store.remove(pattern.id);
    await expect(store.list()).resolves.toEqual([]);
  });
});

describe('corruption is detected rather than silently accepted', () => {
  it('rejects a load when a chunk is missing', async () => {
    const pattern = makeMultiChunkPattern('tampered', 200, 300);
    await store.save(pattern);

    // Delete the last chunk behind the store's back. The remaining sequence is
    // still in order and contiguous, so only the parent's height reveals it.
    const count = await chunkCount(pattern.id, 'chunks');
    const lastId = String(count - 1).padStart(4, '0');
    await deleteDoc(doc(db, `users/${UID}/patterns/${pattern.id}/chunks/${lastId}`));

    await expect(store.load(pattern.id)).rejects.toBeInstanceOf(RangeError);
  });
});
