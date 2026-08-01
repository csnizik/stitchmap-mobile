/**
 * Firestore implementation of `RemotePatternStore`, following the ADR-005
 * schema and write protocol.
 *
 * Write order is chunks, then parent, then stale-chunk cleanup. The parent is
 * the commit point: if chunks fail, the parent still points at the previous
 * complete set; if cleanup fails, extra chunks are ignored by readers and the
 * next successful write clears them.
 */

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  writeBatch,
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

import { parsePattern } from '../domain/serialization';
import type { Pattern } from '../domain/types';
import {
  chunkDocumentId,
  packGrid,
  packItems,
  shouldSpill,
  unpackGrid,
  unpackItems,
} from '../firestore/chunking';
import type { GridChunk, ItemChunk } from '../firestore/chunking';
import {
  patternChunksPath,
  patternLineChunksPath,
  patternPath,
  patternPointChunksPath,
  patternsPath,
} from '../firestore/paths';
import type { PatternSummary, RemotePatternStore } from './patternRepository';

/** Firestore caps a batch at 500 operations. */
const BATCH_LIMIT = 500;

interface PatternDocument {
  schemaVersion: number;
  id: string;
  name: string;
  width: number;
  height: number;
  palette: unknown[];
  /** JSON, because `Placement[][]` is an array of arrays. */
  cellContents: string;
  lines?: unknown[];
  points?: unknown[];
  linesCount: number;
  pointsCount: number;
  linesChunkCount: number;
  pointsChunkCount: number;
  cellChunkCount: number;
  createdAt: string;
  updatedAt: string;
}

function chunkFields(chunk: GridChunk): Record<string, unknown> {
  return {
    index: chunk.index,
    startRow: chunk.startRow,
    rowCount: chunk.rowCount,
    data: chunk.data,
  };
}

function itemChunkFields(chunk: ItemChunk): Record<string, unknown> {
  return {
    index: chunk.index,
    start: chunk.start,
    count: chunk.count,
    data: chunk.data,
  };
}

export class FirestorePatternStore implements RemotePatternStore {
  private readonly db: Firestore;
  private readonly uid: string;

  constructor(db: Firestore, uid: string) {
    this.db = db;
    this.uid = uid;
  }

  async save(pattern: Pattern): Promise<void> {
    const cellChunks = packGrid(pattern.cells);

    const linesSpill = shouldSpill(pattern.lines);
    const pointsSpill = shouldSpill(pattern.points);
    const lineChunks = linesSpill ? packItems(pattern.lines) : [];
    const pointChunks = pointsSpill ? packItems(pattern.points) : [];

    // 1. Chunks first. The parent still points at the old set until step 2.
    await this.writeChunks(
      patternChunksPath(this.uid, pattern.id),
      cellChunks.map((chunk) => [chunkDocumentId(chunk.index), chunkFields(chunk)] as const),
    );
    await this.writeChunks(
      patternLineChunksPath(this.uid, pattern.id),
      lineChunks.map((chunk) => [chunkDocumentId(chunk.index), itemChunkFields(chunk)] as const),
    );
    await this.writeChunks(
      patternPointChunksPath(this.uid, pattern.id),
      pointChunks.map((chunk) => [chunkDocumentId(chunk.index), itemChunkFields(chunk)] as const),
    );

    // 2. Parent. This is the commit point.
    const document: PatternDocument = {
      schemaVersion: pattern.schemaVersion,
      id: pattern.id,
      name: pattern.name,
      width: pattern.width,
      height: pattern.height,
      palette: [...pattern.palette],
      cellContents: JSON.stringify(pattern.cellContents),
      linesCount: pattern.lines.length,
      pointsCount: pattern.points.length,
      linesChunkCount: lineChunks.length,
      pointsChunkCount: pointChunks.length,
      cellChunkCount: cellChunks.length,
      createdAt: pattern.createdAt,
      updatedAt: pattern.updatedAt,
    };
    if (!linesSpill) {
      document.lines = [...pattern.lines];
    }
    if (!pointsSpill) {
      document.points = [...pattern.points];
    }

    const parentBatch = writeBatch(this.db);
    parentBatch.set(doc(this.db, patternPath(this.uid, pattern.id)), document);
    await parentBatch.commit();

    // 3. Stale chunks beyond the new counts. Failure here leaves garbage that
    // readers ignore, not corruption.
    await this.deleteChunksFrom(
      patternChunksPath(this.uid, pattern.id),
      cellChunks.length,
    );
    await this.deleteChunksFrom(
      patternLineChunksPath(this.uid, pattern.id),
      lineChunks.length,
    );
    await this.deleteChunksFrom(
      patternPointChunksPath(this.uid, pattern.id),
      pointChunks.length,
    );
  }

  async load(patternId: string): Promise<Pattern | null> {
    const snapshot = await getDoc(doc(this.db, patternPath(this.uid, patternId)));
    if (!snapshot.exists()) {
      return null;
    }
    const document = snapshot.data() as PatternDocument;

    const cellChunks = await this.readGridChunks(
      patternChunksPath(this.uid, patternId),
      document.cellChunkCount,
    );
    const cells = unpackGrid(document.width, document.height, cellChunks);

    const lines =
      document.linesChunkCount > 0
        ? unpackItems(
            await this.readItemChunks(
              patternLineChunksPath(this.uid, patternId),
              document.linesChunkCount,
            ),
            document.linesCount,
          )
        : (document.lines ?? []);

    const points =
      document.pointsChunkCount > 0
        ? unpackItems(
            await this.readItemChunks(
              patternPointChunksPath(this.uid, patternId),
              document.pointsChunkCount,
            ),
            document.pointsCount,
          )
        : (document.points ?? []);

    // Validate the reassembled pattern rather than trusting the wire format.
    return parsePattern({
      schemaVersion: document.schemaVersion,
      id: document.id,
      name: document.name,
      width: document.width,
      height: document.height,
      palette: document.palette,
      cellContents: JSON.parse(document.cellContents),
      cells,
      lines,
      points,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    });
  }

  async list(): Promise<PatternSummary[]> {
    const snapshot = await getDocs(
      query(collection(this.db, patternsPath(this.uid)), orderBy('updatedAt', 'desc')),
    );
    return snapshot.docs.map((entry) => {
      const document = entry.data() as PatternDocument;
      return {
        id: document.id,
        name: document.name,
        width: document.width,
        height: document.height,
        updatedAt: document.updatedAt,
      };
    });
  }

  async remove(patternId: string): Promise<void> {
    // Subcollections are not deleted with their parent, so chunks go first.
    await this.deleteChunksFrom(patternChunksPath(this.uid, patternId), 0);
    await this.deleteChunksFrom(patternLineChunksPath(this.uid, patternId), 0);
    await this.deleteChunksFrom(patternPointChunksPath(this.uid, patternId), 0);
    await deleteDoc(doc(this.db, patternPath(this.uid, patternId)));
  }

  /* ---------------- helpers ---------------- */

  private async writeChunks(
    path: string,
    entries: readonly (readonly [string, Record<string, unknown>])[],
  ): Promise<void> {
    for (let i = 0; i < entries.length; i += BATCH_LIMIT) {
      const batch = writeBatch(this.db);
      for (const [id, fields] of entries.slice(i, i + BATCH_LIMIT)) {
        batch.set(doc(this.db, `${path}/${id}`), fields);
      }
      await batch.commit();
    }
  }

  /** Delete every chunk whose index is at or beyond `keepCount`. */
  private async deleteChunksFrom(path: string, keepCount: number): Promise<void> {
    const snapshot = await getDocs(collection(this.db, path));
    const stale = snapshot.docs.filter((entry) => {
      const index = (entry.data() as { index?: number }).index;
      return typeof index === 'number' && index >= keepCount;
    });

    for (let i = 0; i < stale.length; i += BATCH_LIMIT) {
      const batch = writeBatch(this.db);
      for (const entry of stale.slice(i, i + BATCH_LIMIT)) {
        batch.delete(entry.ref);
      }
      await batch.commit();
    }
  }

  private async readGridChunks(path: string, expected: number): Promise<GridChunk[]> {
    const snapshot = await getDocs(query(collection(this.db, path), orderBy('index')));
    if (snapshot.docs.length !== expected) {
      throw new RangeError(
        `expected ${expected} chunks at ${path} but found ${snapshot.docs.length}`,
      );
    }
    return snapshot.docs.map((entry) => entry.data() as GridChunk);
  }

  private async readItemChunks(path: string, expected: number): Promise<ItemChunk[]> {
    const snapshot = await getDocs(query(collection(this.db, path), orderBy('index')));
    if (snapshot.docs.length !== expected) {
      throw new RangeError(
        `expected ${expected} chunks at ${path} but found ${snapshot.docs.length}`,
      );
    }
    return snapshot.docs.map((entry) => entry.data() as ItemChunk);
  }
}
