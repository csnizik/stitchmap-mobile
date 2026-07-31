import { createEmptyProject, markPlacement } from '../progress';
import {
  DomainParseError,
  parsePattern,
  parsePatternJson,
  parseProject,
  parseProjectJson,
  serializePattern,
  serializeProject,
} from '../serialization';
import { LATER, NOW, makePattern } from '../__fixtures__/pattern';

describe('pattern serialization', () => {
  const pattern = makePattern();

  it('round trips through JSON', () => {
    expect(parsePatternJson(serializePattern(pattern))).toEqual(pattern);
  });

  it('round trips through a plain object, as Firestore hands it back', () => {
    const plain: unknown = JSON.parse(JSON.stringify(pattern));
    expect(parsePattern(plain)).toEqual(pattern);
  });

  it('rejects an invalid pattern on the way in', () => {
    expect(() => parsePattern({ ...pattern, width: -1 })).toThrow(DomainParseError);
  });

  it('rejects an invalid pattern on the way out, before it reaches storage', () => {
    expect(() => serializePattern({ ...pattern, width: -1 })).toThrow(DomainParseError);
  });

  it('rejects malformed JSON', () => {
    expect(() => parsePatternJson('{not json')).toThrow(DomainParseError);
  });
});

describe('project serialization', () => {
  const pattern = makePattern();
  const project = createEmptyProject({ id: 'project-1', pattern, now: NOW });

  it('round trips', () => {
    expect(parseProjectJson(serializeProject(project))).toEqual(project);
  });

  it('round trips after progress is recorded', () => {
    const marked = markPlacement(pattern, project, 1, 0, 1, true, LATER);
    expect(parseProjectJson(serializeProject(marked))).toEqual(marked);
  });

  it('rejects an invalid project', () => {
    expect(() => parseProject({ ...project, id: '' })).toThrow(DomainParseError);
  });
});

describe('DomainParseError', () => {
  const pattern = makePattern();

  it('carries every issue, not just the first', () => {
    try {
      parsePattern({ ...pattern, width: -1, id: '' });
      throw new Error('expected a throw');
    } catch (error) {
      expect(error).toBeInstanceOf(DomainParseError);
      expect((error as DomainParseError).issues.length).toBeGreaterThan(1);
    }
  });

  it('names the issues in its message', () => {
    try {
      parsePattern({ ...pattern, width: -1 });
      throw new Error('expected a throw');
    } catch (error) {
      expect((error as DomainParseError).message).toContain('width');
    }
  });

  it('survives instanceof after transpilation', () => {
    const error = new DomainParseError('pattern', ['a']);
    expect(error instanceof DomainParseError).toBe(true);
    expect(error instanceof Error).toBe(true);
  });
});
