/**
 * Seeds the sample pattern on first launch.
 *
 * Pattern import is deferred (S3-1 out of scope), so the app needs something to
 * render. This writes the sample through the normal repository path rather than
 * a special case, which means the seed exercises the same code real import will.
 *
 * Idempotent: relaunching must not duplicate the pattern or reset progress. The
 * check is for an existing project, not an existing pattern, because progress is
 * the thing that would hurt to lose.
 */

import { createEmptyProject } from '../domain/progress';
import type { Pattern, Project } from '../domain/types';
import { createSamplePattern, SAMPLE_PATTERN_ID } from '../samples/samplePattern';
import type { Repositories } from './RepositoryProvider';

/** Derived from the pattern id, so seeding twice targets the same project. */
export const SAMPLE_PROJECT_ID = `${SAMPLE_PATTERN_ID}-project`;

export interface SeedResult {
  readonly pattern: Pattern;
  readonly project: Project;
  /** False when an existing project was found and left untouched. */
  readonly seeded: boolean;
}

/**
 * Ensure the sample pattern and its project exist locally.
 *
 * @param now ISO 8601 timestamp, injected so callers control the clock.
 */
export async function seedSampleData(
  { patterns, projects }: Repositories,
  now: string,
): Promise<SeedResult> {
  const existingProject = await projects.get(SAMPLE_PROJECT_ID);
  const existingPattern = await patterns.get(SAMPLE_PATTERN_ID);

  if (existingProject !== null && existingPattern !== null) {
    return { pattern: existingPattern, project: existingProject, seeded: false };
  }

  // The pattern is content, not user data, so rewriting it is safe. Progress is
  // not, which is why the project below is only created when absent.
  const pattern = existingPattern ?? createSamplePattern();
  if (existingPattern === null) {
    await patterns.save(pattern);
  }

  const project = existingProject ?? createEmptyProject({ id: SAMPLE_PROJECT_ID, pattern, now });
  if (existingProject === null) {
    // Immediate rather than debounced: project creation is rare, and a project
    // that exists locally but never reaches the server would resurface as a
    // duplicate on another device.
    await projects.saveImmediately(project);
  }

  return { pattern, project, seeded: true };
}
