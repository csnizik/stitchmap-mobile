/**
 * Firestore implementation of `RemoteProjectStore`.
 *
 * Same ADR-005 write protocol as the pattern store: chunks first, then the
 * parent as the commit point, then stale-chunk cleanup. Only the progress grid
 * chunks; the line and point run lists are short by construction, because they
 * are run-length encoded over the pattern's stitch lists rather than per stitch.
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

import { collectProjectIssues } from '../domain/guards';
import { DomainParseError } from '../domain/serialization';
import type { Project, Run } from '../domain/types';
import { chunkDocumentId, packGrid, unpackGrid } from '../firestore/chunking';
import type { GridChunk } from '../firestore/chunking';
import {
  projectChunksPath,
  projectPath,
  projectsPath,
} from '../firestore/paths';
import type { ProjectSummary, RemoteProjectStore } from './projectRepository';

/** Firestore caps a batch at 500 operations. */
const BATCH_LIMIT = 500;

interface ProjectDocument {
  schemaVersion: number;
  id: string;
  patternId: string;
  width: number;
  height: number;
  /** Arrays of flat maps, so these are native fields. */
  lineProgress: Run<boolean>[];
  pointProgress: Run<boolean>[];
  progressChunkCount: number;
  createdAt: string;
  updatedAt: string;
}

export class FirestoreProjectStore implements RemoteProjectStore {
  private readonly db: Firestore;
  private readonly uid: string;

  constructor(db: Firestore, uid: string) {
    this.db = db;
    this.uid = uid;
  }

  async save(project: Project): Promise<void> {
    const chunks = packGrid(project.cellProgress);

    // 1. Chunks. The parent still points at the previous set until step 2.
    await this.writeChunks(project.id, chunks);

    // 2. Parent. Commit point.
    const document: ProjectDocument = {
      schemaVersion: project.schemaVersion,
      id: project.id,
      patternId: project.patternId,
      width: project.width,
      height: project.height,
      lineProgress: [...project.lineProgress],
      pointProgress: [...project.pointProgress],
      progressChunkCount: chunks.length,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
    const batch = writeBatch(this.db);
    batch.set(doc(this.db, projectPath(this.uid, project.id)), document);
    await batch.commit();

    // 3. Stale chunks. Failure here leaves garbage readers ignore.
    await this.deleteChunksFrom(project.id, chunks.length);
  }

  async load(projectId: string): Promise<Project | null> {
    const snapshot = await getDoc(doc(this.db, projectPath(this.uid, projectId)));
    if (!snapshot.exists()) {
      return null;
    }
    const document = snapshot.data() as ProjectDocument;

    const chunks = await this.readChunks(projectId, document.progressChunkCount);
    const cellProgress = unpackGrid(document.width, document.height, chunks);

    const project = {
      schemaVersion: document.schemaVersion,
      id: document.id,
      patternId: document.patternId,
      width: document.width,
      height: document.height,
      cellProgress,
      lineProgress: document.lineProgress,
      pointProgress: document.pointProgress,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };

    // Validate the reassembled project rather than trusting the wire format.
    const issues = collectProjectIssues(project);
    if (issues.length > 0) {
      throw new DomainParseError('project', issues);
    }
    return project as Project;
  }

  async list(): Promise<ProjectSummary[]> {
    const snapshot = await getDocs(
      query(collection(this.db, projectsPath(this.uid)), orderBy('updatedAt', 'desc')),
    );
    return snapshot.docs.map((entry) => {
      const document = entry.data() as ProjectDocument;
      return {
        id: document.id,
        patternId: document.patternId,
        updatedAt: document.updatedAt,
      };
    });
  }

  async remove(projectId: string): Promise<void> {
    // Subcollections are not deleted with their parent.
    await this.deleteChunksFrom(projectId, 0);
    await deleteDoc(doc(this.db, projectPath(this.uid, projectId)));
  }

  /* ---------------- helpers ---------------- */

  private async writeChunks(projectId: string, chunks: readonly GridChunk[]): Promise<void> {
    const path = projectChunksPath(this.uid, projectId);
    for (let i = 0; i < chunks.length; i += BATCH_LIMIT) {
      const batch = writeBatch(this.db);
      for (const chunk of chunks.slice(i, i + BATCH_LIMIT)) {
        batch.set(doc(this.db, `${path}/${chunkDocumentId(chunk.index)}`), {
          index: chunk.index,
          startRow: chunk.startRow,
          rowCount: chunk.rowCount,
          data: chunk.data,
        });
      }
      await batch.commit();
    }
  }

  private async deleteChunksFrom(projectId: string, keepCount: number): Promise<void> {
    const snapshot = await getDocs(
      collection(this.db, projectChunksPath(this.uid, projectId)),
    );
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

  private async readChunks(projectId: string, expected: number): Promise<GridChunk[]> {
    const snapshot = await getDocs(
      query(collection(this.db, projectChunksPath(this.uid, projectId)), orderBy('index')),
    );
    if (snapshot.docs.length !== expected) {
      throw new RangeError(
        `expected ${expected} progress chunks for project "${projectId}" but found ${snapshot.docs.length}`,
      );
    }
    return snapshot.docs.map((entry) => entry.data() as GridChunk);
  }
}
