/**
 * Structural validation for the domain model.
 *
 * Every invariant in ADR-004 section 8 is enforced here. Each `collect*Issues`
 * function returns human-readable problems; each `is*` predicate is that
 * function returning nothing. Serialization surfaces the issues, which is what
 * makes a rejected pattern debuggable rather than merely rejected.
 *
 * Unknown *properties* are tolerated, so adding an optional field later stays
 * backward compatible for old readers. Unknown *kinds* are rejected, because a
 * reader that cannot represent a stitch must fail loudly rather than silently
 * drop it on round trip.
 */

import { cellKey, comparePlacements } from './cells';
import { isStitchId } from './ids';
import {
  COORDINATE_STEP,
  LINE_STITCH_KINDS,
  MAX_PLACEMENTS_PER_CELL,
  POINT_STITCH_KINDS,
  SCHEMA_VERSION,
} from './types';
import type {
  CellContent,
  Corner,
  Grid,
  LineStitch,
  PaletteEntry,
  Pattern,
  Placement,
  Point,
  PointStitch,
  Project,
  Run,
  Slant,
} from './types';

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const MAX_UINT32 = 0xffffffff;

const CORNER_VALUES: readonly string[] = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];
const SLANT_VALUES: readonly string[] = ['forward', 'backward'];

/* ------------------------------------------------------------------ *
 * Primitives
 * ------------------------------------------------------------------ */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isPositiveInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

/** Coordinates must be whole multiples of COORDINATE_STEP. */
function isOnCoordinateGrid(value: number): boolean {
  return Number.isInteger(value / COORDINATE_STEP);
}

/* ------------------------------------------------------------------ *
 * Palette
 * ------------------------------------------------------------------ */

export function collectPaletteEntryIssues(value: unknown, path: string, issues: string[]): void {
  if (!isRecord(value)) {
    issues.push(`${path} is not an object`);
    return;
  }
  if (!isNonEmptyString(value.key)) issues.push(`${path}.key must be a non-empty string`);
  if (!isNonEmptyString(value.symbol)) issues.push(`${path}.symbol must be a non-empty string`);
  if (typeof value.color !== 'string' || !HEX_COLOR.test(value.color)) {
    issues.push(`${path}.color must match #rrggbb`);
  }
  if (typeof value.brand !== 'string') issues.push(`${path}.brand must be a string`);
  if (typeof value.code !== 'string') issues.push(`${path}.code must be a string`);
  if (typeof value.label !== 'string') issues.push(`${path}.label must be a string`);
}

export function isPaletteEntry(value: unknown): value is PaletteEntry {
  const issues: string[] = [];
  collectPaletteEntryIssues(value, 'entry', issues);
  return issues.length === 0;
}

/* ------------------------------------------------------------------ *
 * Placements and cell contents
 * ------------------------------------------------------------------ */

export function collectPlacementIssues(value: unknown, path: string, issues: string[]): void {
  if (!isRecord(value)) {
    issues.push(`${path} is not an object`);
    return;
  }
  if (!isNonEmptyString(value.thread)) {
    issues.push(`${path}.thread must be a non-empty string`);
  }
  switch (value.kind) {
    case 'full':
      return;
    case 'half':
      if (!SLANT_VALUES.includes(value.slant as Slant)) {
        issues.push(`${path}.slant must be forward or backward`);
      }
      return;
    case 'quarter':
    case 'threeQuarter':
      if (!CORNER_VALUES.includes(value.corner as Corner)) {
        issues.push(`${path}.corner must be one of ${CORNER_VALUES.join(', ')}`);
      }
      return;
    default:
      issues.push(
        `${path}.kind is unsupported: ${JSON.stringify(value.kind)}. ` +
          `A reader that cannot represent a stitch must reject it rather than drop it.`,
      );
  }
}

export function isPlacement(value: unknown): value is Placement {
  const issues: string[] = [];
  collectPlacementIssues(value, 'placement', issues);
  return issues.length === 0;
}

/** Validates shape, canonical ordering, duplicate freedom, and size cap. */
export function collectCellContentIssues(value: unknown, path: string, issues: string[]): void {
  if (!Array.isArray(value)) {
    issues.push(`${path} is not an array`);
    return;
  }
  if (value.length > MAX_PLACEMENTS_PER_CELL) {
    issues.push(
      `${path} holds ${value.length} placements, the maximum is ${MAX_PLACEMENTS_PER_CELL}`,
    );
  }

  const before = issues.length;
  value.forEach((placement, index) => {
    collectPlacementIssues(placement, `${path}[${index}]`, issues);
  });
  if (issues.length !== before) return;

  const placements = value as Placement[];
  for (let i = 1; i < placements.length; i += 1) {
    const order = comparePlacements(placements[i - 1], placements[i]);
    if (order === 0) {
      issues.push(`${path}[${i}] duplicates the previous placement`);
    } else if (order > 0) {
      issues.push(`${path}[${i}] is out of canonical order`);
    }
  }
}

export function isCellContent(value: unknown): value is CellContent {
  const issues: string[] = [];
  collectCellContentIssues(value, 'cell', issues);
  return issues.length === 0;
}

/* ------------------------------------------------------------------ *
 * Points and stitches
 * ------------------------------------------------------------------ */

export function collectPointIssues(
  value: unknown,
  width: number,
  height: number,
  path: string,
  issues: string[],
): void {
  if (!isRecord(value)) {
    issues.push(`${path} is not an object`);
    return;
  }
  const { x, y } = value;
  if (typeof x !== 'number' || !Number.isFinite(x)) {
    issues.push(`${path}.x must be a finite number`);
  } else if (!isOnCoordinateGrid(x)) {
    issues.push(`${path}.x must be a multiple of ${COORDINATE_STEP}`);
  } else if (x < 0 || x > width) {
    issues.push(`${path}.x must be within [0, ${width}]`);
  }
  if (typeof y !== 'number' || !Number.isFinite(y)) {
    issues.push(`${path}.y must be a finite number`);
  } else if (!isOnCoordinateGrid(y)) {
    issues.push(`${path}.y must be a multiple of ${COORDINATE_STEP}`);
  } else if (y < 0 || y > height) {
    issues.push(`${path}.y must be within [0, ${height}]`);
  }
}

export function isPoint(value: unknown, width: number, height: number): value is Point {
  const issues: string[] = [];
  collectPointIssues(value, width, height, 'point', issues);
  return issues.length === 0;
}

function samePoint(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

export function collectLineStitchIssues(
  value: unknown,
  width: number,
  height: number,
  path: string,
  issues: string[],
): void {
  if (!isRecord(value)) {
    issues.push(`${path} is not an object`);
    return;
  }
  if (!isStitchId(value.id)) issues.push(`${path}.id must be a non-empty string`);
  if (!LINE_STITCH_KINDS.includes(value.kind as never)) {
    issues.push(`${path}.kind is unsupported: ${JSON.stringify(value.kind)}`);
  }
  if (!isNonEmptyString(value.thread)) {
    issues.push(`${path}.thread must be a non-empty string`);
  }
  const before = issues.length;
  collectPointIssues(value.from, width, height, `${path}.from`, issues);
  collectPointIssues(value.to, width, height, `${path}.to`, issues);
  if (issues.length === before && samePoint(value.from as Point, value.to as Point)) {
    issues.push(`${path} has zero length: from and to are the same point`);
  }
}

export function collectPointStitchIssues(
  value: unknown,
  width: number,
  height: number,
  path: string,
  issues: string[],
): void {
  if (!isRecord(value)) {
    issues.push(`${path} is not an object`);
    return;
  }
  if (!isStitchId(value.id)) issues.push(`${path}.id must be a non-empty string`);
  if (!POINT_STITCH_KINDS.includes(value.kind as never)) {
    issues.push(`${path}.kind is unsupported: ${JSON.stringify(value.kind)}`);
  }
  if (!isNonEmptyString(value.thread)) {
    issues.push(`${path}.thread must be a non-empty string`);
  }
  collectPointIssues(value.at, width, height, `${path}.at`, issues);
}

/* ------------------------------------------------------------------ *
 * Grids and run lists
 * ------------------------------------------------------------------ */

type ValueCheck = (value: unknown, path: string, issues: string[]) => void;

/**
 * Validates dimensions, the row-bounded invariant, positive run counts, and
 * that no two adjacent runs share a value (a canonical encoding has none).
 */
export function collectGridIssues(
  value: unknown,
  width: number,
  height: number,
  path: string,
  checkValue: ValueCheck,
  issues: string[],
): void {
  if (!isRecord(value)) {
    issues.push(`${path} is not an object`);
    return;
  }
  if (value.width !== width) {
    issues.push(`${path}.width is ${String(value.width)}, expected ${width}`);
  }
  if (value.height !== height) {
    issues.push(`${path}.height is ${String(value.height)}, expected ${height}`);
  }
  if (!Array.isArray(value.rows)) {
    issues.push(`${path}.rows is not an array`);
    return;
  }
  if (value.rows.length !== height) {
    issues.push(`${path}.rows has ${value.rows.length} rows, expected ${height}`);
  }

  value.rows.forEach((row: unknown, y: number) => {
    const rowPath = `${path}.rows[${y}]`;
    if (!Array.isArray(row)) {
      issues.push(`${rowPath} is not an array`);
      return;
    }
    let total = 0;
    let previous: unknown;
    let hasPrevious = false;
    row.forEach((run: unknown, i: number) => {
      const runPath = `${rowPath}[${i}]`;
      if (!isRecord(run)) {
        issues.push(`${runPath} is not an object`);
        return;
      }
      if (!isPositiveInt(run.count)) {
        issues.push(`${runPath}.count must be a positive integer`);
      } else {
        total += run.count;
      }
      checkValue(run.value, `${runPath}.value`, issues);
      if (hasPrevious && previous === run.value) {
        issues.push(`${runPath} repeats the previous run's value; runs must be coalesced`);
      }
      previous = run.value;
      hasPrevious = true;
    });
    if (total !== width) {
      issues.push(`${rowPath} expands to ${total} cells, expected ${width}`);
    }
  });
}

/** Validates a boolean run list and returns the number of entries it covers. */
export function collectRunListIssues(value: unknown, path: string, issues: string[]): number {
  if (!Array.isArray(value)) {
    issues.push(`${path} is not an array`);
    return 0;
  }
  let total = 0;
  let previous: boolean | undefined;
  value.forEach((run: unknown, i: number) => {
    const runPath = `${path}[${i}]`;
    if (!isRecord(run)) {
      issues.push(`${runPath} is not an object`);
      return;
    }
    if (typeof run.value !== 'boolean') {
      issues.push(`${runPath}.value must be a boolean`);
    }
    if (!isPositiveInt(run.count)) {
      issues.push(`${runPath}.count must be a positive integer`);
    } else {
      total += run.count;
    }
    if (previous !== undefined && previous === run.value) {
      issues.push(`${runPath} repeats the previous run's value; runs must be coalesced`);
    }
    previous = run.value as boolean;
  });
  return total;
}

function checkContentIndex(contentCount: number): ValueCheck {
  return (value, path, issues) => {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
      issues.push(`${path} must be a non-negative integer`);
    } else if (value >= contentCount) {
      issues.push(`${path} is ${value}, outside the ${contentCount} interned cell contents`);
    }
  };
}

const checkMask: ValueCheck = (value, path, issues) => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > MAX_UINT32) {
    issues.push(`${path} must be an integer in [0, ${MAX_UINT32}]`);
  }
};

/* ------------------------------------------------------------------ *
 * Pattern
 * ------------------------------------------------------------------ */

export function collectPatternIssues(value: unknown): string[] {
  const issues: string[] = [];

  if (!isRecord(value)) {
    return ['pattern is not an object'];
  }
  if (value.schemaVersion !== SCHEMA_VERSION) {
    issues.push(
      `pattern.schemaVersion is ${String(value.schemaVersion)}, this reader supports ${SCHEMA_VERSION}`,
    );
  }
  if (!isNonEmptyString(value.id)) issues.push('pattern.id must be a non-empty string');
  if (typeof value.name !== 'string') issues.push('pattern.name must be a string');
  if (!isNonEmptyString(value.createdAt))
    issues.push('pattern.createdAt must be a non-empty string');
  if (!isNonEmptyString(value.updatedAt))
    issues.push('pattern.updatedAt must be a non-empty string');

  const width = value.width;
  const height = value.height;
  if (!isPositiveInt(width)) issues.push('pattern.width must be a positive integer');
  if (!isPositiveInt(height)) issues.push('pattern.height must be a positive integer');

  // Palette, and the key set every layer is checked against.
  const threadKeys = new Set<string>();
  if (!Array.isArray(value.palette)) {
    issues.push('pattern.palette is not an array');
  } else {
    value.palette.forEach((entry: unknown, i: number) => {
      const before = issues.length;
      collectPaletteEntryIssues(entry, `pattern.palette[${i}]`, issues);
      if (issues.length === before) {
        const key = (entry as PaletteEntry).key;
        if (threadKeys.has(key)) {
          issues.push(`pattern.palette[${i}].key duplicates an earlier entry: ${key}`);
        }
        threadKeys.add(key);
      }
    });
  }

  // Interned cell contents.
  let contentCount = 0;
  if (!Array.isArray(value.cellContents)) {
    issues.push('pattern.cellContents is not an array');
  } else {
    contentCount = value.cellContents.length;
    if (contentCount === 0) {
      issues.push('pattern.cellContents must contain at least the blank cell');
    }
    const seen = new Map<string, number>();
    value.cellContents.forEach((content: unknown, i: number) => {
      const path = `pattern.cellContents[${i}]`;
      const before = issues.length;
      collectCellContentIssues(content, path, issues);
      if (issues.length !== before) return;

      const placements = content as CellContent;
      if (i === 0 && placements.length !== 0) {
        issues.push('pattern.cellContents[0] must be the blank cell');
      }
      if (i > 0 && placements.length === 0) {
        issues.push(`${path} is blank; only index 0 may be blank`);
      }
      const key = cellKey(placements);
      const earlier = seen.get(key);
      if (earlier !== undefined) {
        issues.push(`${path} duplicates pattern.cellContents[${earlier}]`);
      } else {
        seen.set(key, i);
      }
      for (const placement of placements) {
        if (threadKeys.size > 0 && !threadKeys.has(placement.thread)) {
          issues.push(
            `${path} references thread "${placement.thread}", which is not in the palette`,
          );
        }
      }
    });
  }

  // Cell grid.
  if (isPositiveInt(width) && isPositiveInt(height)) {
    collectGridIssues(
      value.cells,
      width,
      height,
      'pattern.cells',
      checkContentIndex(contentCount),
      issues,
    );
  }

  // Line and point layers, with combined id uniqueness.
  const ids = new Set<string>();
  const w = isPositiveInt(width) ? width : 0;
  const h = isPositiveInt(height) ? height : 0;

  if (!Array.isArray(value.lines)) {
    issues.push('pattern.lines is not an array');
  } else {
    value.lines.forEach((line: unknown, i: number) => {
      const path = `pattern.lines[${i}]`;
      const before = issues.length;
      collectLineStitchIssues(line, w, h, path, issues);
      if (issues.length !== before) return;
      const stitch = line as LineStitch;
      if (ids.has(stitch.id)) issues.push(`${path}.id duplicates another stitch id`);
      ids.add(stitch.id);
      if (threadKeys.size > 0 && !threadKeys.has(stitch.thread)) {
        issues.push(`${path} references thread "${stitch.thread}", which is not in the palette`);
      }
    });
  }

  if (!Array.isArray(value.points)) {
    issues.push('pattern.points is not an array');
  } else {
    value.points.forEach((point: unknown, i: number) => {
      const path = `pattern.points[${i}]`;
      const before = issues.length;
      collectPointStitchIssues(point, w, h, path, issues);
      if (issues.length !== before) return;
      const stitch = point as PointStitch;
      if (ids.has(stitch.id)) issues.push(`${path}.id duplicates another stitch id`);
      ids.add(stitch.id);
      if (threadKeys.size > 0 && !threadKeys.has(stitch.thread)) {
        issues.push(`${path} references thread "${stitch.thread}", which is not in the palette`);
      }
    });
  }

  return issues;
}

export function isPattern(value: unknown): value is Pattern {
  return collectPatternIssues(value).length === 0;
}

/* ------------------------------------------------------------------ *
 * Project
 * ------------------------------------------------------------------ */

export function collectProjectIssues(value: unknown): string[] {
  const issues: string[] = [];

  if (!isRecord(value)) {
    return ['project is not an object'];
  }
  if (value.schemaVersion !== SCHEMA_VERSION) {
    issues.push(
      `project.schemaVersion is ${String(value.schemaVersion)}, this reader supports ${SCHEMA_VERSION}`,
    );
  }
  if (!isNonEmptyString(value.id)) issues.push('project.id must be a non-empty string');
  if (!isNonEmptyString(value.patternId))
    issues.push('project.patternId must be a non-empty string');
  if (!isNonEmptyString(value.createdAt))
    issues.push('project.createdAt must be a non-empty string');
  if (!isNonEmptyString(value.updatedAt))
    issues.push('project.updatedAt must be a non-empty string');

  const width = value.width;
  const height = value.height;
  if (!isPositiveInt(width)) issues.push('project.width must be a positive integer');
  if (!isPositiveInt(height)) issues.push('project.height must be a positive integer');

  if (isPositiveInt(width) && isPositiveInt(height)) {
    collectGridIssues(value.cellProgress, width, height, 'project.cellProgress', checkMask, issues);
  }

  collectRunListIssues(value.lineProgress, 'project.lineProgress', issues);
  collectRunListIssues(value.pointProgress, 'project.pointProgress', issues);

  return issues;
}

export function isProject(value: unknown): value is Project {
  return collectProjectIssues(value).length === 0;
}

/* ------------------------------------------------------------------ *
 * Cross validation
 * ------------------------------------------------------------------ */

/** Walk two same-sized grids together over run boundaries. O(runs). */
function forEachAligned<A, B>(
  a: Grid<A>,
  b: Grid<B>,
  visit: (aValue: A, bValue: B, y: number) => void,
): void {
  for (let y = 0; y < a.height; y += 1) {
    const rowA: readonly Run<A>[] = a.rows[y];
    const rowB: readonly Run<B>[] = b.rows[y];
    let i = 0;
    let j = 0;
    let usedA = 0;
    let usedB = 0;
    while (i < rowA.length && j < rowB.length) {
      visit(rowA[i].value, rowB[j].value, y);
      const step = Math.min(rowA[i].count - usedA, rowB[j].count - usedB);
      usedA += step;
      usedB += step;
      if (usedA === rowA[i].count) {
        i += 1;
        usedA = 0;
      }
      if (usedB === rowB[j].count) {
        j += 1;
        usedB = 0;
      }
    }
  }
}

/**
 * Invariants that need both documents. These are the repository-layer checks
 * from ADR-004 items 12 and 13: run them wherever a project is loaded next to
 * its pattern.
 */
export function collectProjectAgainstPatternIssues(pattern: Pattern, project: Project): string[] {
  const issues: string[] = [];

  if (project.patternId !== pattern.id) {
    issues.push(`project.patternId is "${project.patternId}" but the pattern is "${pattern.id}"`);
  }
  if (project.width !== pattern.width || project.height !== pattern.height) {
    issues.push(
      `project is ${project.width}x${project.height} but the pattern is ${pattern.width}x${pattern.height}`,
    );
    return issues;
  }

  forEachAligned(pattern.cells, project.cellProgress, (contentIndex, mask, y) => {
    const content = pattern.cellContents[contentIndex];
    const placements = content === undefined ? 0 : content.length;
    const allowed =
      placements === MAX_PLACEMENTS_PER_CELL ? MAX_UINT32 : ((1 << placements) - 1) >>> 0;
    if ((mask & ~allowed) >>> 0 !== 0) {
      issues.push(
        `row ${y} marks a stitch that does not exist: mask ${mask} against a cell with ${placements} placements`,
      );
    }
  });

  const lineTotal = project.lineProgress.reduce((sum, run) => sum + run.count, 0);
  if (lineTotal !== pattern.lines.length) {
    issues.push(
      `project.lineProgress covers ${lineTotal} stitches but the pattern has ${pattern.lines.length} lines`,
    );
  }

  const pointTotal = project.pointProgress.reduce((sum, run) => sum + run.count, 0);
  if (pointTotal !== pattern.points.length) {
    issues.push(
      `project.pointProgress covers ${pointTotal} stitches but the pattern has ${pattern.points.length} points`,
    );
  }

  return issues;
}

export function projectMatchesPattern(pattern: Pattern, project: Project): boolean {
  return collectProjectAgainstPatternIssues(pattern, project).length === 0;
}
