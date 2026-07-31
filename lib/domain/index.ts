/**
 * Public surface of the domain model.
 *
 * Design and invariants: docs/decisions/adr-004-domain-model.md
 * Overview: docs/data-model.md
 */

export type {
  CellContent,
  CellGrid,
  Corner,
  FullPlacement,
  Grid,
  HalfPlacement,
  LineStitch,
  LineStitchKind,
  PaletteEntry,
  Pattern,
  Placement,
  PlacementKind,
  Point,
  PointStitch,
  PointStitchKind,
  ProgressGrid,
  Project,
  QuarterPlacement,
  Run,
  SchemaVersion,
  Slant,
  StitchId,
  ThreadKey,
  ThreeQuarterPlacement,
} from './types';

export {
  BLANK_CELL_INDEX,
  COORDINATE_STEP,
  CORNERS,
  LINE_STITCH_KINDS,
  MAX_PLACEMENTS_PER_CELL,
  PLACEMENT_KINDS,
  POINT_STITCH_KINDS,
  SCHEMA_VERSION,
  SLANTS,
} from './types';

export { createStitchId, isStitchId } from './ids';
export type { RandomSource } from './ids';

export {
  chunkRows,
  countCells,
  decodeRow,
  encodeRow,
  filledGrid,
  getCell,
  getRow,
  gridFromRows,
  gridToCells,
  joinChunks,
  makeGrid,
  mapGrid,
  reduceRuns,
  rowLength,
  setCell,
  sliceRows,
} from './grid';
export type { Equals } from './grid';

export {
  ALL_CORNERS,
  ALL_SLANTS,
  buildCellGrid,
  canonicalizeCell,
  cellContentAt,
  cellKey,
  cellsEqual,
  comparePlacements,
  internCells,
  placementCountAt,
} from './cells';
export type { BuiltCellGrid, InternedCells } from './cells';

export {
  completeMask,
  countCompletedPlacements,
  countCompletedRuns,
  countPlacements,
  createEmptyProject,
  emptyRunList,
  getRunListValue,
  isPlacementComplete,
  markCell,
  markLine,
  markPlacement,
  markPoint,
  popcount,
  runListLength,
  setPlacementComplete,
  setRunListValue,
  summarizeProgress,
  togglePlacement,
} from './progress';
export type { CreateProjectInput, ProgressCount, ProgressSummary } from './progress';

export {
  collectCellContentIssues,
  collectGridIssues,
  collectLineStitchIssues,
  collectPaletteEntryIssues,
  collectPatternIssues,
  collectPlacementIssues,
  collectPointIssues,
  collectPointStitchIssues,
  collectProjectAgainstPatternIssues,
  collectProjectIssues,
  collectRunListIssues,
  isCellContent,
  isPaletteEntry,
  isPattern,
  isPlacement,
  isPoint,
  isProject,
  projectMatchesPattern,
} from './guards';

export {
  DomainParseError,
  parsePattern,
  parsePatternJson,
  parseProject,
  parseProjectJson,
  serializePattern,
  serializeProject,
} from './serialization';
