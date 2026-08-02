/**
 * FirestoreProjectStore against the local Firestore emulator.
 *
 *   npm run test:rules
 *
 * Same coverage shape as patternStore.test.ts, since both follow the ADR-005
 * write protocol.
 */

import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDocs } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

import { createEmptyProject, markCell, markLine } from '../lib/domain/progress';
import { filledGrid } from '../lib/domain/grid';
import { SCHEMA_VERSION } from '../lib/domain/types';
import type { Pattern, Project } from '../lib/domain/types';
import { FirestoreProjectStore } from '../lib/repositories/firestoreProjectStore';
import { createSamplePattern } from '../lib/samples/samplePattern';

const PROJECT_ID = 'demo-stitchmap';
const UID = 'user-owner';
const NOW = '2026-08-01T00:00:00.000Z';
const LATER = '2026-08-01T01:00:00.000Z';

let testEnv: RulesTestEnvironment;
let db: Firestore;
let store: FirestoreProjectStore;
let pattern: Pattern;
let project: Project;

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
  store = new FirestoreProjectStore(db, UID);
  pattern = createSamplePattern();
  project = createEmptyProject({ id: 'project-1', pattern, now: NOW });
});

/** A progress grid large enough to exceed the chunk budget. */
function makeLargeProject(id: string, width: number, height: number): Project {
  const rows = [];
  for (let y = 0; y < height; y += 1) {
    const row = [];
    for (let x = 0; x < width; x += 1) {
      row.push({ value: (x + y) % 2, count: 1 });
    }
    rows.push(row);
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    id,
    patternId: 'large-pattern',
    width,
    height,
    cellProgress: { width, height, rows },
    lineProgress: [],
    pointProgress: [],
    createdAt: NOW,
    updatedAt: NOW,
  };
}

async function chunkCount(projectId: string): Promise<number> {
  const snapshot = await getDocs(collection(db, `users/${UID}/projects/${projectId}/chunks`));
  return snapshot.size;
}

describe('round trip', () => {
  it('saves and loads an empty project intact', async () => {
    await store.save(project);
    await expect(store.load(project.id)).resolves.toEqual(project);
  });

  it('preserves progress across all three layers', async () => {
    let current = markCell(pattern, project, 1, 0, true, LATER);
    current = markLine(current, 0, true, LATER);
    await store.save(current);

    const loaded = await store.load(current.id);
    expect(loaded).toEqual(current);
  });

  it('stores an untouched grid compactly, one run per row', async () => {
    await store.save(project);
    const snapshot = await getDocs(collection(db, `users/${UID}/projects/${project.id}/chunks`));
    const data = JSON.parse((snapshot.docs[0].data() as { data: string }).data) as number[][];
    // Every row is a single run of zeros: value 0, count width.
    expect(data.every((row) => row.length === 2 && row[0] === 0)).toBe(true);
  });

  it('returns null for a project that does not exist', async () => {
    await expect(store.load('missing')).resolves.toBeNull();
  });
});

describe('chunking', () => {
  const WIDTH = 200;
  const HEIGHT = 300;

  it('splits a large progress grid', async () => {
    const large = makeLargeProject('large', WIDTH, HEIGHT);
    await store.save(large);
    await expect(chunkCount(large.id)).resolves.toBeGreaterThan(1);
  });

  it('round trips a chunked progress grid exactly', async () => {
    const large = makeLargeProject('large', WIDTH, HEIGHT);
    await store.save(large);
    await expect(store.load(large.id)).resolves.toEqual(large);
  });

  it('deletes chunks a smaller rewrite no longer needs', async () => {
    const large = makeLargeProject('shrinking', WIDTH, HEIGHT);
    await store.save(large);
    expect(await chunkCount(large.id)).toBeGreaterThan(1);

    const small: Project = {
      ...large,
      width: 8,
      height: 8,
      cellProgress: filledGrid(8, 8, 0),
    };
    await store.save(small);

    await expect(chunkCount(small.id)).resolves.toBe(1);
    await expect(store.load(small.id)).resolves.toEqual(small);
  });

  it('detects a missing trailing chunk on load', async () => {
    const large = makeLargeProject('tampered', WIDTH, HEIGHT);
    await store.save(large);

    const count = await chunkCount(large.id);
    const lastId = String(count - 1).padStart(4, '0');
    await deleteDoc(doc(db, `users/${UID}/projects/${large.id}/chunks/${lastId}`));

    await expect(store.load(large.id)).rejects.toBeInstanceOf(RangeError);
  });
});

describe('listing and deletion', () => {
  it('returns an empty list for an account with no projects', async () => {
    await expect(store.list()).resolves.toEqual([]);
  });

  it('orders by updatedAt, most recent first', async () => {
    await store.save({ ...project, id: 'older', updatedAt: '2026-01-01T00:00:00.000Z' });
    await store.save({ ...project, id: 'newer', updatedAt: '2026-06-01T00:00:00.000Z' });

    const ids = (await store.list()).map((entry) => entry.id);
    expect(ids).toEqual(['newer', 'older']);
  });

  it('removes the project and its chunks', async () => {
    const large = makeLargeProject('doomed', 200, 300);
    await store.save(large);
    expect(await chunkCount(large.id)).toBeGreaterThan(1);

    await store.remove(large.id);

    await expect(store.load(large.id)).resolves.toBeNull();
    await expect(chunkCount(large.id)).resolves.toBe(0);
  });
});

describe('repeated saves, the debounce target', () => {
  it('overwrites rather than accumulating documents', async () => {
    let current = project;
    for (let x = 0; x < pattern.width; x += 1) {
      current = markCell(pattern, current, x, 0, true, LATER);
      await store.save(current);
    }

    await expect(chunkCount(project.id)).resolves.toBe(1);
    const loaded = await store.load(project.id);
    expect(loaded).toEqual(current);
  });
});
