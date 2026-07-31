/**
 * Serialization for patterns and projects.
 *
 * Two entry points per type: one for plain objects (what Firestore and the
 * StorageAdapter hand back) and one for JSON strings. Both validate before
 * returning, so nothing downstream has to re-check invariants.
 */

import { collectPatternIssues, collectProjectIssues } from './guards';
import type { Pattern, Project } from './types';

/** Thrown when input does not satisfy the domain invariants. */
export class DomainParseError extends Error {
  readonly issues: readonly string[];

  constructor(what: string, issues: readonly string[]) {
    const detail = issues.length > 0 ? `: ${issues.join('; ')}` : '';
    super(`invalid ${what}${detail}`);
    this.name = 'DomainParseError';
    this.issues = issues;
    // Required so `instanceof` survives transpilation to ES5 targets.
    Object.setPrototypeOf(this, DomainParseError.prototype);
  }
}

function parseJson(json: string, what: string): unknown {
  try {
    return JSON.parse(json) as unknown;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new DomainParseError(what, [`not valid JSON: ${reason}`]);
  }
}

/* ------------------------------------------------------------------ *
 * Pattern
 * ------------------------------------------------------------------ */

/**
 * Validate a plain object as a Pattern.
 *
 * @throws DomainParseError listing every invariant that failed.
 */
export function parsePattern(value: unknown): Pattern {
  const issues = collectPatternIssues(value);
  if (issues.length > 0) {
    throw new DomainParseError('pattern', issues);
  }
  return value as Pattern;
}

export function parsePatternJson(json: string): Pattern {
  return parsePattern(parseJson(json, 'pattern'));
}

/**
 * Validate on the way out as well as the way in. A corrupt in-memory pattern
 * should fail here rather than reach storage.
 */
export function serializePattern(pattern: Pattern): string {
  const issues = collectPatternIssues(pattern);
  if (issues.length > 0) {
    throw new DomainParseError('pattern', issues);
  }
  return JSON.stringify(pattern);
}

/* ------------------------------------------------------------------ *
 * Project
 * ------------------------------------------------------------------ */

export function parseProject(value: unknown): Project {
  const issues = collectProjectIssues(value);
  if (issues.length > 0) {
    throw new DomainParseError('project', issues);
  }
  return value as Project;
}

export function parseProjectJson(json: string): Project {
  return parseProject(parseJson(json, 'project'));
}

export function serializeProject(project: Project): string {
  const issues = collectProjectIssues(project);
  if (issues.length > 0) {
    throw new DomainParseError('project', issues);
  }
  return JSON.stringify(project);
}
