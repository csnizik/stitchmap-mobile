import {
  isPaletteEntry,
  isPattern,
  isProgressGrid,
  isProject,
  isStitchCell,
  isStitchGrid,
  isThreadKey,
} from '../guards';
import type { Pattern, Project } from '../types';

const palette = [
  { key: 'a', symbol: 'X', color: '#000000', brand: 'DMC', code: '310', label: 'Black' },
  { key: 'b', symbol: 'O', color: '#FFFFFF', brand: 'DMC', code: 'B5200', label: 'Snow White' },
];

const pattern: Pattern = {
  id: 'p1',
  name: 'Tiny heart',
  width: 2,
  height: 2,
  palette,
  grid: {
    width: 2,
    height: 2,
    runs: [
      { value: 'a', count: 1 },
      { value: 'b', count: 2 },
      { value: null, count: 1 },
    ],
  },
  createdAt: '2026-06-05T00:00:00.000Z',
  updatedAt: '2026-06-05T00:00:00.000Z',
};

const project: Project = {
  id: 'j1',
  patternId: 'p1',
  progress: {
    width: 2,
    height: 2,
    runs: [
      { value: true, count: 1 },
      { value: false, count: 3 },
    ],
  },
  completedCount: 1,
  totalCount: 3,
  createdAt: '2026-06-05T00:00:00.000Z',
  updatedAt: '2026-06-05T00:00:00.000Z',
};

describe('primitive guards', () => {
  it('isThreadKey accepts strings only', () => {
    expect(isThreadKey('a')).toBe(true);
    expect(isThreadKey(1)).toBe(false);
    expect(isThreadKey(null)).toBe(false);
  });

  it('isStitchCell accepts a thread key or null', () => {
    expect(isStitchCell('a')).toBe(true);
    expect(isStitchCell(null)).toBe(true);
    expect(isStitchCell(undefined)).toBe(false);
    expect(isStitchCell(2)).toBe(false);
  });

  it('isPaletteEntry validates every required field', () => {
    expect(isPaletteEntry(palette[0])).toBe(true);
    expect(isPaletteEntry({ ...palette[0], color: 5 })).toBe(false);
    const { label, ...withoutLabel } = palette[0];
    void label;
    expect(isPaletteEntry(withoutLabel)).toBe(false);
  });
});

describe('isStitchGrid / isProgressGrid', () => {
  it('accepts well-formed grids', () => {
    expect(isStitchGrid(pattern.grid)).toBe(true);
    expect(isProgressGrid(project.progress)).toBe(true);
  });

  it('rejects grids whose runs do not cover width * height', () => {
    expect(isStitchGrid({ width: 2, height: 2, runs: [{ value: 'a', count: 3 }] })).toBe(false);
  });

  it('rejects runs with a non-positive count', () => {
    expect(isStitchGrid({ width: 1, height: 1, runs: [{ value: 'a', count: 0 }] })).toBe(false);
  });

  it('rejects cells of the wrong type for the grid', () => {
    // booleans are not valid stitch cells, strings are not valid progress cells
    expect(isStitchGrid({ width: 1, height: 1, runs: [{ value: true, count: 1 }] })).toBe(false);
    expect(isProgressGrid({ width: 1, height: 1, runs: [{ value: 'a', count: 1 }] })).toBe(false);
  });
});

describe('isPattern', () => {
  it('accepts a valid pattern', () => {
    expect(isPattern(pattern)).toBe(true);
  });

  it('rejects non-objects and missing fields', () => {
    expect(isPattern(null)).toBe(false);
    expect(isPattern('nope')).toBe(false);
    const { name, ...withoutName } = pattern;
    void name;
    expect(isPattern(withoutName)).toBe(false);
  });

  it('rejects a pattern whose grid dimensions disagree with its own', () => {
    expect(isPattern({ ...pattern, width: 3 })).toBe(false);
  });

  it('rejects a pattern with an invalid palette entry', () => {
    expect(isPattern({ ...pattern, palette: [{ key: 'a' }] })).toBe(false);
  });
});

describe('isProject', () => {
  it('accepts a valid project', () => {
    expect(isProject(project)).toBe(true);
  });

  it('rejects negative counts and missing fields', () => {
    expect(isProject({ ...project, completedCount: -1 })).toBe(false);
    const { patternId, ...withoutPatternId } = project;
    void patternId;
    expect(isProject(withoutPatternId)).toBe(false);
  });
});
