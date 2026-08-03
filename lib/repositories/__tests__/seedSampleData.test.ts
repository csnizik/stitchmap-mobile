import { summarizeProgress } from '../../domain/progress';
import { SAMPLE_PATTERN_ID } from '../../samples/samplePattern';
import { InMemoryStorageAdapter } from '../../storage/StorageAdapter';
import { PatternRepository } from '../patternRepository';
import { ProjectRepository } from '../projectRepository';
import type { Repositories } from '../RepositoryProvider';
import { seedSampleData, SAMPLE_PROJECT_ID } from '../seedSampleData';

const NOW = '2026-08-02T12:00:00.000Z';
const LATER = '2026-08-02T13:00:00.000Z';

function makeRepositories(): Repositories {
  const storage = new InMemoryStorageAdapter();
  return {
    patterns: new PatternRepository({ storage }),
    projects: new ProjectRepository({ storage }),
  };
}

describe('seedSampleData', () => {
  it('creates the pattern and a project on first run', async () => {
    const repos = makeRepositories();
    const result = await seedSampleData(repos, NOW);

    expect(result.seeded).toBe(true);
    expect(result.pattern.id).toBe(SAMPLE_PATTERN_ID);
    expect(result.project.id).toBe(SAMPLE_PROJECT_ID);
    expect(result.project.patternId).toBe(SAMPLE_PATTERN_ID);
  });

  it('stores both through the repositories', async () => {
    const repos = makeRepositories();
    await seedSampleData(repos, NOW);

    await expect(repos.patterns.get(SAMPLE_PATTERN_ID)).resolves.not.toBeNull();
    await expect(repos.projects.get(SAMPLE_PROJECT_ID)).resolves.not.toBeNull();
  });

  it('starts with nothing stitched', async () => {
    const repos = makeRepositories();
    const { pattern, project } = await seedSampleData(repos, NOW);
    expect(summarizeProgress(pattern, project).completed).toBe(0);
  });

  it('does not seed again on a second run', async () => {
    const repos = makeRepositories();
    await seedSampleData(repos, NOW);
    const second = await seedSampleData(repos, LATER);

    expect(second.seeded).toBe(false);
  });

  it('does not duplicate the pattern in the index', async () => {
    const repos = makeRepositories();
    await seedSampleData(repos, NOW);
    await seedSampleData(repos, LATER);

    await expect(repos.patterns.list()).resolves.toHaveLength(1);
    await expect(repos.projects.list()).resolves.toHaveLength(1);
  });

  it('preserves existing progress across a reseed', async () => {
    // The case that matters: a relaunch must not wipe what the user stitched.
    const repos = makeRepositories();
    const { pattern, project } = await seedSampleData(repos, NOW);

    const marked = await repos.projects.markCell(pattern, project, 0, 0, true, LATER);
    expect(summarizeProgress(pattern, marked).completed).toBeGreaterThan(0);

    const second = await seedSampleData(repos, LATER);
    expect(second.seeded).toBe(false);
    expect(summarizeProgress(pattern, second.project).completed).toBe(
      summarizeProgress(pattern, marked).completed,
    );
  });

  it('recreates a missing project without disturbing the stored pattern', async () => {
    const repos = makeRepositories();
    await seedSampleData(repos, NOW);
    await repos.projects.remove(SAMPLE_PROJECT_ID);

    const second = await seedSampleData(repos, LATER);
    expect(second.seeded).toBe(true);
    await expect(repos.patterns.list()).resolves.toHaveLength(1);
  });
});
