// Public surface of the domain model. Import from `lib/domain` rather than
// reaching into individual modules.

export type {
  Grid,
  PaletteEntry,
  Pattern,
  Project,
  ProgressGrid,
  Run,
  StitchCell,
  StitchGrid,
  ThreadKey,
} from './types';

export {
  countCells,
  getCell,
  gridCellCount,
  gridToCells,
  makeGrid,
  runLengthDecode,
  runLengthEncode,
} from './grid';

export {
  isPaletteEntry,
  isPattern,
  isProgressGrid,
  isProject,
  isStitchCell,
  isStitchGrid,
  isThreadKey,
} from './guards';

export {
  deserializePattern,
  deserializeProject,
  DomainParseError,
  serializePattern,
  serializeProject,
} from './serialization';
