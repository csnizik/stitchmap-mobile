import {
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
} from '../progress';
import { MAX_PLACEMENTS_PER_CELL } from '../types';
import { LATER, NOW, makePattern } from '../__fixtures__/pattern';

describe('popcount', () => {
  it('counts zero and all ones', () => {
    expect(popcount(0)).toBe(0);
    expect(popcount(0xffffffff)).toBe(32);
  });

  it('counts the high bit, which is negative as a signed int32', () => {
    expect(popcount((1 << 31) >>> 0)).toBe(1);
  });

  it('counts a mixed mask', () => {
    expect(popcount(0b1011)).toBe(3);
  });
});

describe('placement masks', () => {
  it('sets and reads every bit including the last', () => {
    let mask = 0;
    for (let i = 0; i < MAX_PLACEMENTS_PER_CELL; i += 1) {
      mask = setPlacementComplete(mask, i, true);
    }
    expect(mask).toBe(0xffffffff);
    expect(isPlacementComplete(mask, 31)).toBe(true);
  });

  it('keeps masks unsigned', () => {
    const mask = setPlacementComplete(0, 31, true);
    expect(mask).toBeGreaterThan(0);
  });

  it('clears a bit', () => {
    const mask = setPlacementComplete(0xffffffff, 31, false);
    expect(mask).toBe(0x7fffffff);
  });

  it('toggles', () => {
    expect(togglePlacement(togglePlacement(0, 3), 3)).toBe(0);
  });

  it('rejects an out of range index', () => {
    expect(() => setPlacementComplete(0, MAX_PLACEMENTS_PER_CELL, true)).toThrow(RangeError);
    expect(() => isPlacementComplete(0, -1)).toThrow(RangeError);
  });
});

describe('completeMask', () => {
  it('handles the full width case, where 1 << 32 would wrap to 1', () => {
    expect(completeMask(MAX_PLACEMENTS_PER_CELL)).toBe(0xffffffff);
  });

  it('handles an empty cell', () => {
    expect(completeMask(0)).toBe(0);
  });

  it('handles a typical cell', () => {
    expect(completeMask(3)).toBe(0b111);
  });

  it('rejects an impossible count', () => {
    expect(() => completeMask(33)).toThrow(RangeError);
  });
});

describe('boolean run lists', () => {
  it('creates an incomplete list', () => {
    expect(emptyRunList(5)).toEqual([{ value: false, count: 5 }]);
  });

  it('creates nothing for a zero length list', () => {
    expect(emptyRunList(0)).toEqual([]);
  });

  it('reports length and completion', () => {
    const runs = [
      { value: true, count: 2 },
      { value: false, count: 3 },
    ];
    expect(runListLength(runs)).toBe(5);
    expect(countCompletedRuns(runs)).toBe(2);
  });

  it('reads by index', () => {
    const runs = [
      { value: true, count: 2 },
      { value: false, count: 3 },
    ];
    expect(getRunListValue(runs, 1)).toBe(true);
    expect(getRunListValue(runs, 2)).toBe(false);
    expect(() => getRunListValue(runs, 5)).toThrow(RangeError);
  });

  it('splits and recoalesces on write', () => {
    const runs = emptyRunList(5);
    const split = setRunListValue(runs, 2, true);
    expect(split).toHaveLength(3);
    expect(setRunListValue(split, 2, false)).toHaveLength(1);
  });

  it('rejects an out of range write', () => {
    expect(() => setRunListValue(emptyRunList(2), 5, true)).toThrow(RangeError);
  });
});

describe('createEmptyProject', () => {
  const pattern = makePattern();
  const project = createEmptyProject({ id: 'project-1', pattern, now: NOW });

  it('matches the pattern dimensions', () => {
    expect(project.width).toBe(pattern.width);
    expect(project.height).toBe(pattern.height);
  });

  it('starts with nothing stitched', () => {
    expect(countCompletedPlacements(project)).toBe(0);
    expect(project.cellProgress.rows.every((row) => row.length === 1)).toBe(true);
  });

  it('sizes the line and point lists to the pattern', () => {
    expect(runListLength(project.lineProgress)).toBe(pattern.lines.length);
    expect(runListLength(project.pointProgress)).toBe(pattern.points.length);
  });
});

describe('marking', () => {
  const pattern = makePattern();
  const project = createEmptyProject({ id: 'project-1', pattern, now: NOW });

  it('marks one placement in a multi placement cell', () => {
    const next = markPlacement(pattern, project, 1, 0, 1, true, LATER);
    expect(countCompletedPlacements(next)).toBe(1);
    expect(next.updatedAt).toBe(LATER);
  });

  it('leaves the other placement in that cell alone', () => {
    const next = markPlacement(pattern, project, 1, 0, 1, true, LATER);
    expect(countCompletedPlacements(next)).toBe(1);
    const both = markPlacement(pattern, next, 1, 0, 0, true, LATER);
    expect(countCompletedPlacements(both)).toBe(2);
  });

  it('returns the same reference when nothing changes', () => {
    const next = markPlacement(pattern, project, 1, 0, 1, true, LATER);
    expect(markPlacement(pattern, next, 1, 0, 1, true, NOW)).toBe(next);
  });

  it('refuses to mark a placement that does not exist', () => {
    expect(() => markPlacement(pattern, project, 0, 0, 1, true, LATER)).toThrow(RangeError);
  });

  it('refuses to mark anything in a blank cell', () => {
    expect(() => markPlacement(pattern, project, 0, 1, 0, true, LATER)).toThrow(RangeError);
  });

  it('marks a whole cell', () => {
    const next = markCell(pattern, project, 1, 0, true, LATER);
    expect(countCompletedPlacements(next)).toBe(2);
  });

  it('unmarks a whole cell', () => {
    const marked = markCell(pattern, project, 1, 0, true, LATER);
    expect(countCompletedPlacements(markCell(pattern, marked, 1, 0, false, LATER))).toBe(0);
  });

  it('marks line and point stitches', () => {
    const withLine = markLine(project, 0, true, LATER);
    const withPoint = markPoint(withLine, 0, true, LATER);
    expect(countCompletedRuns(withPoint.lineProgress)).toBe(1);
    expect(countCompletedRuns(withPoint.pointProgress)).toBe(1);
  });
});

describe('derived totals', () => {
  const pattern = makePattern();
  const project = createEmptyProject({ id: 'project-1', pattern, now: NOW });

  it('counts every placement in the pattern', () => {
    // (0,0) has 1, (1,0) has 2, (0,1) has 0, (1,1) has 1.
    expect(countPlacements(pattern)).toBe(4);
  });

  it('totals all three layers', () => {
    const summary = summarizeProgress(pattern, project);
    expect(summary.total).toBe(4 + 1 + 1);
    expect(summary.completed).toBe(0);
  });

  it('breaks totals down by layer', () => {
    const marked = markLine(markPlacement(pattern, project, 1, 0, 1, true, LATER), 0, true, LATER);
    const summary = summarizeProgress(pattern, marked);
    expect(summary.cells).toEqual({ completed: 1, total: 4 });
    expect(summary.lines).toEqual({ completed: 1, total: 1 });
    expect(summary.points).toEqual({ completed: 0, total: 1 });
    expect(summary.completed).toBe(2);
  });

  it('cannot drift, because it is computed rather than stored', () => {
    const marked = markCell(pattern, project, 1, 0, true, LATER);
    expect(summarizeProgress(pattern, marked).completed).toBe(countCompletedPlacements(marked));
  });
});
