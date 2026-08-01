/**
 * Firestore storage layer.
 *
 * Schema, chunking strategy, rules, and budget: docs/decisions/ADR-005-firestore-schema.md
 */

export {
  CHUNK_BUDGET_BYTES,
  CHUNK_ID_DIGITS,
  MAX_CHUNKS,
  MAX_ROW_BYTES,
  chunkDocumentId,
  decodePairsToRuns,
  encodeRunsToPairs,
  encodedSize,
  packGrid,
  packItems,
  shouldSpill,
  unpackGrid,
  unpackItems,
} from './chunking';
export type { GridChunk, ItemChunk } from './chunking';

export {
  COLLECTIONS,
  assertValidId,
  patternChunksPath,
  patternLineChunksPath,
  patternPath,
  patternPointChunksPath,
  patternsPath,
  projectChunksPath,
  projectPath,
  projectsPath,
  userPath,
} from './paths';
