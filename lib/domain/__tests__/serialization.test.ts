import {
  deserializePattern,
  deserializeProject,
  DomainParseError,
  serializePattern,
  serializeProject,
} from '../serialization';
import type { Pattern, Project } from '../types';

const pattern: Pattern = {
  id: 'p1',
  name: 'Tiny heart',
  width: 2,
  height: 2,
  palette: [{ key: 'a', symbol: 'X', color: '#000000', brand: 'DMC', code: '310', label: 'Black' }],
  grid: {
    width: 2,
    height: 2,
    runs: [
      { value: 'a', count: 2 },
      { value: null, count: 2 },
    ],
  },
  createdAt: '2026-06-05T00:00:00.000Z',
  updatedAt: '2026-06-05T01:00:00.000Z',
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
  totalCount: 2,
  createdAt: '2026-06-05T00:00:00.000Z',
  updatedAt: '2026-06-05T01:00:00.000Z',
};

describe('pattern serialization', () => {
  it('round-trips through serialize/deserialize', () => {
    expect(deserializePattern(serializePattern(pattern))).toEqual(pattern);
  });

  it('throws DomainParseError on invalid JSON', () => {
    expect(() => deserializePattern('{not json')).toThrow(DomainParseError);
  });

  it('throws DomainParseError on valid JSON that is not a Pattern', () => {
    expect(() => deserializePattern(JSON.stringify({ id: 'p1' }))).toThrow(DomainParseError);
  });
});

describe('project serialization', () => {
  it('round-trips through serialize/deserialize', () => {
    expect(deserializeProject(serializeProject(project))).toEqual(project);
  });

  it('throws DomainParseError on invalid JSON', () => {
    expect(() => deserializeProject('nope')).toThrow(DomainParseError);
  });

  it('throws DomainParseError on valid JSON that is not a Project', () => {
    expect(() => deserializeProject(serializePattern(pattern))).toThrow(DomainParseError);
  });
});
