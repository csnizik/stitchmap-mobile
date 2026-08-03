/**
 * The workspace screen: seeding, rendering, and marking.
 *
 * Repositories are injected through RepositoryProvider rather than mocked
 * piecemeal, so this exercises the real seeding and progress code against
 * in-memory storage. Only Skia is mocked, since it cannot render here.
 *
 * The PatternHost mock returns null and captures the tap callback instead of
 * rendering: jest forbids referencing out-of-scope values such as `Text`
 * inside a mock factory, and calling the captured callback tests the same
 * thing a simulated press would, without the indirection.
 */

import { render, waitFor } from '@testing-library/react-native';

import { summarizeProgress } from '../../../lib/domain/progress';
import type { Pattern, Project } from '../../../lib/domain/types';
import { PatternRepository } from '../../../lib/repositories/patternRepository';
import { ProjectRepository } from '../../../lib/repositories/projectRepository';
import { RepositoryProvider } from '../../../lib/repositories/RepositoryProvider';
import type { Repositories } from '../../../lib/repositories/RepositoryProvider';
import { SAMPLE_PROJECT_ID } from '../../../lib/repositories/seedSampleData';
import { SAMPLE_PATTERN_ID } from '../../../lib/samples/samplePattern';
import { InMemoryStorageAdapter } from '../../../lib/storage/StorageAdapter';

/** Captures the props the screen passes down, including the tap handler. */
const mockHostProps: { current: { onCellPress?: (x: number, y: number) => void } | null } = {
  current: null,
};

jest.mock('../../../components/PatternHost', () => ({
  __esModule: true,
  default: (props: { onCellPress?: (x: number, y: number) => void }) => {
    mockHostProps.current = props;
    return null;
  },
}));

jest.mock('../../../lib/auth/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'test-user' }, isLoading: false }),
}));

// eslint-disable-next-line import/first
import Workspace from '../index';

function makeRepositories(): Repositories {
  const storage = new InMemoryStorageAdapter();
  return {
    patterns: new PatternRepository({ storage }),
    projects: new ProjectRepository({ storage }),
  };
}

function renderWorkspace(repositories: Repositories) {
  return render(
    <RepositoryProvider repositories={repositories}>
      <Workspace />
    </RepositoryProvider>,
  );
}

/** Wait for seeding to finish and the canvas to receive its props. */
async function waitForCanvas(): Promise<void> {
  await waitFor(() => {
    expect(mockHostProps.current).not.toBeNull();
  });
}

/**
 * Tap a cell and wait for the screen to re-render with the result.
 *
 * Waiting on storage alone is not enough: `onCellPress` closes over component
 * state, and the storage write resolves before React flushes the re-render. A
 * second tap taken too early would run against a stale project and compute the
 * wrong toggle direction. Waiting for the callback identity to change proves
 * the new state has landed.
 */
async function pressCell(x: number, y: number): Promise<void> {
  const before = mockHostProps.current?.onCellPress;
  before?.(x, y);
  await waitFor(() => {
    expect(mockHostProps.current?.onCellPress).not.toBe(before);
  });
}

async function readStored(
  repositories: Repositories,
): Promise<{ pattern: Pattern; project: Project }> {
  const pattern = await repositories.patterns.get(SAMPLE_PATTERN_ID);
  const project = await repositories.projects.get(SAMPLE_PROJECT_ID);
  if (pattern === null || project === null) {
    throw new Error('expected the sample pattern and project to be stored');
  }
  return { pattern, project };
}

async function completedCount(repositories: Repositories): Promise<number> {
  const { pattern, project } = await readStored(repositories);
  return summarizeProgress(pattern, project).completed;
}

beforeEach(() => {
  mockHostProps.current = null;
});

describe('workspace', () => {
  it('seeds the sample pattern and project on first render', async () => {
    const repositories = makeRepositories();
    renderWorkspace(repositories);
    await waitForCanvas();

    const { pattern, project } = await readStored(repositories);
    expect(pattern.id).toBe(SAMPLE_PATTERN_ID);
    expect(project.patternId).toBe(SAMPLE_PATTERN_ID);
  });

  it('renders the pattern once seeding completes', async () => {
    const repositories = makeRepositories();
    renderWorkspace(repositories);
    await waitForCanvas();

    expect(mockHostProps.current?.onCellPress).toBeInstanceOf(Function);
  });

  it('starts with nothing stitched', async () => {
    const repositories = makeRepositories();
    renderWorkspace(repositories);
    await waitForCanvas();

    await expect(completedCount(repositories)).resolves.toBe(0);
  });

  it('marks a cell when it is tapped', async () => {
    const repositories = makeRepositories();
    renderWorkspace(repositories);
    await waitForCanvas();

    // (0,0) is a cream stitch in the sample's top band.
    await pressCell(0, 0);

    await expect(completedCount(repositories)).resolves.toBe(1);
  });

  it('clears the cell when it is tapped again', async () => {
    const repositories = makeRepositories();
    renderWorkspace(repositories);
    await waitForCanvas();

    await pressCell(0, 0);
    await expect(completedCount(repositories)).resolves.toBe(1);

    await pressCell(0, 0);
    await expect(completedCount(repositories)).resolves.toBe(0);
  });

  it('marks every placement in a shared cell', async () => {
    const repositories = makeRepositories();
    renderWorkspace(repositories);
    await waitForCanvas();

    // (3,4) holds a three-quarter and a quarter of different threads, which is
    // the case a single-value cell model could not represent.
    await pressCell(3, 4);

    await expect(completedCount(repositories)).resolves.toBe(2);
  });

  it('ignores a tap on a blank cell', async () => {
    const repositories = makeRepositories();
    renderWorkspace(repositories);
    await waitForCanvas();

    // (0,1) is blank in the sample. No state change means no re-render, so
    // this deliberately calls the handler directly rather than via pressCell.
    mockHostProps.current?.onCellPress?.(0, 1);

    await expect(completedCount(repositories)).resolves.toBe(0);
  });
});
