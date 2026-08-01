/**
 * Firestore collection and document paths.
 *
 * Every path a user owns is rooted at `users/{uid}`, which is what lets the
 * security rules be a single recursive match block. See ADR-005 section 1.
 */

export const COLLECTIONS = {
  users: 'users',
  patterns: 'patterns',
  projects: 'projects',
  /** N-row slices of a pattern's cell grid, or a project's progress grid. */
  chunks: 'chunks',
  /** Line stitches, only when they spill out of the parent document. */
  lineChunks: 'lineChunks',
  /** Point stitches, only when they spill out of the parent document. */
  pointChunks: 'pointChunks',
} as const;

/**
 * Firestore document id rules: not empty, no forward slashes, not `.` or `..`,
 * and not the reserved `__name__` form.
 */
export function assertValidId(id: string, label: string): void {
  if (typeof id !== 'string' || id.length === 0) {
    throw new RangeError(`${label} must be a non-empty string`);
  }
  if (id.includes('/')) {
    throw new RangeError(`${label} must not contain a forward slash: ${id}`);
  }
  if (id === '.' || id === '..') {
    throw new RangeError(`${label} must not be "." or ".."`);
  }
  if (/^__.*__$/.test(id)) {
    throw new RangeError(`${label} must not match the reserved __*__ form: ${id}`);
  }
}

export function userPath(uid: string): string {
  assertValidId(uid, 'uid');
  return `${COLLECTIONS.users}/${uid}`;
}

export function patternsPath(uid: string): string {
  return `${userPath(uid)}/${COLLECTIONS.patterns}`;
}

export function patternPath(uid: string, patternId: string): string {
  assertValidId(patternId, 'patternId');
  return `${patternsPath(uid)}/${patternId}`;
}

export function patternChunksPath(uid: string, patternId: string): string {
  return `${patternPath(uid, patternId)}/${COLLECTIONS.chunks}`;
}

export function patternLineChunksPath(uid: string, patternId: string): string {
  return `${patternPath(uid, patternId)}/${COLLECTIONS.lineChunks}`;
}

export function patternPointChunksPath(uid: string, patternId: string): string {
  return `${patternPath(uid, patternId)}/${COLLECTIONS.pointChunks}`;
}

export function projectsPath(uid: string): string {
  return `${userPath(uid)}/${COLLECTIONS.projects}`;
}

export function projectPath(uid: string, projectId: string): string {
  assertValidId(projectId, 'projectId');
  return `${projectsPath(uid)}/${projectId}`;
}

export function projectChunksPath(uid: string, projectId: string): string {
  return `${projectPath(uid, projectId)}/${COLLECTIONS.chunks}`;
}
