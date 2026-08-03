import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { Pattern, Project } from '../../domain/types';
import { InMemoryStorageAdapter } from '../../storage/StorageAdapter';
import { PatternRepository } from '../patternRepository';
import type { PatternSummary, RemotePatternStore } from '../patternRepository';
import { ProjectRepository } from '../projectRepository';
import type { ProjectSummary, RemoteProjectStore } from '../projectRepository';
import { useHydrateOnSignIn } from '../useHydrateOnSignIn';

const PATTERN_SUMMARY: PatternSummary = {
  id: 'remote-pattern',
  name: 'Remote',
  width: 8,
  height: 8,
  updatedAt: '2026-08-03T00:00:00.000Z',
};

const PROJECT_SUMMARY: ProjectSummary = {
  id: 'remote-project',
  patternId: 'remote-pattern',
  updatedAt: '2026-08-03T00:00:00.000Z',
};

class FakePatternStore implements RemotePatternStore {
  failList = false;
  listCalls = 0;

  save(): Promise<void> {
    return Promise.resolve();
  }
  load(): Promise<Pattern | null> {
    return Promise.resolve(null);
  }
  list(): Promise<PatternSummary[]> {
    this.listCalls += 1;
    return this.failList
      ? Promise.reject(new Error('network down'))
      : Promise.resolve([PATTERN_SUMMARY]);
  }
  remove(): Promise<void> {
    return Promise.resolve();
  }
}

class FakeProjectStore implements RemoteProjectStore {
  failList = false;
  listCalls = 0;

  save(): Promise<void> {
    return Promise.resolve();
  }
  load(): Promise<Project | null> {
    return Promise.resolve(null);
  }
  list(): Promise<ProjectSummary[]> {
    this.listCalls += 1;
    return this.failList
      ? Promise.reject(new Error('network down'))
      : Promise.resolve([PROJECT_SUMMARY]);
  }
  remove(): Promise<void> {
    return Promise.resolve();
  }
}

interface Repositories {
  readonly patterns: PatternRepository;
  readonly projects: ProjectRepository;
  readonly patternStore: FakePatternStore;
  readonly projectStore: FakeProjectStore;
}

function makeRepositories(
  patternStore = new FakePatternStore(),
  projectStore = new FakeProjectStore(),
): Repositories {
  const storage = new InMemoryStorageAdapter();
  return {
    patterns: new PatternRepository({ storage, remote: patternStore }),
    projects: new ProjectRepository({ storage, remote: projectStore }),
    patternStore,
    projectStore,
  };
}

describe('useHydrateOnSignIn', () => {
  it('stays idle while signed out', () => {
    const { result } = renderHook(() => useHydrateOnSignIn({ patterns: null, projects: null }));
    expect(result.current.status).toBe('idle');
  });

  it('pulls both indexes once repositories exist', async () => {
    const { patterns, projects, patternStore, projectStore } = makeRepositories();
    const { result } = renderHook(() => useHydrateOnSignIn({ patterns, projects }));

    await waitFor(() => {
      expect(result.current.status).toBe('synced');
    });
    expect(patternStore.listCalls).toBe(1);
    expect(projectStore.listCalls).toBe(1);
  });

  it('writes the remote listing into local storage', async () => {
    const { patterns, projects } = makeRepositories();
    const { result } = renderHook(() => useHydrateOnSignIn({ patterns, projects }));

    await waitFor(() => {
      expect(result.current.status).toBe('synced');
    });
    await expect(patterns.list()).resolves.toEqual([PATTERN_SUMMARY]);
    await expect(projects.list()).resolves.toEqual([PROJECT_SUMMARY]);
  });

  it('does not fetch pattern contents', async () => {
    // Only metadata. A chart is over a megabyte, so eager fetching would make
    // sign-in slow and spend read quota on data the user may never open.
    const patternStore = new FakePatternStore();
    const loadSpy = jest.spyOn(patternStore, 'load');
    const { patterns, projects } = makeRepositories(patternStore);
    const { result } = renderHook(() => useHydrateOnSignIn({ patterns, projects }));

    await waitFor(() => {
      expect(result.current.status).toBe('synced');
    });
    expect(loadSpy).not.toHaveBeenCalled();
  });

  it('reports failure without throwing', async () => {
    const patternStore = new FakePatternStore();
    patternStore.failList = true;
    const errors: Error[] = [];
    const { patterns, projects } = makeRepositories(patternStore);

    const { result } = renderHook(() =>
      useHydrateOnSignIn({
        patterns,
        projects,
        onSyncError: (error) => errors.push(error as Error),
      }),
    );

    await waitFor(() => {
      expect(result.current.status).toBe('failed');
    });
    expect(errors).toHaveLength(1);
    expect(result.current.error?.message).toContain('network down');
  });

  it('leaves local data usable after a failed hydration', async () => {
    // Local-first: an unreachable server degrades to offline, not to nothing.
    const patternStore = new FakePatternStore();
    const { patterns, projects } = makeRepositories(patternStore);
    await patterns.list();
    patternStore.failList = true;

    const { result } = renderHook(() => useHydrateOnSignIn({ patterns, projects }));
    await waitFor(() => {
      expect(result.current.status).toBe('failed');
    });
    await expect(patterns.list()).resolves.toEqual([]);
  });

  it('re-hydrates when the repositories change', async () => {
    const first = makeRepositories();
    // Props are typed on the callback rather than as explicit generics on
    // renderHook: in a .tsx file the parser reads those angle brackets as JSX.
    const { result, rerender } = renderHook(
      (props: { patterns: PatternRepository; projects: ProjectRepository }) =>
        useHydrateOnSignIn({ patterns: props.patterns, projects: props.projects }),
      { initialProps: { patterns: first.patterns, projects: first.projects } },
    );

    await waitFor(() => {
      expect(result.current.status).toBe('synced');
    });

    // Signing in as a different account rebuilds the repositories.
    const second = makeRepositories();
    act(() => {
      rerender({ patterns: second.patterns, projects: second.projects });
    });

    await waitFor(() => {
      expect(second.patternStore.listCalls).toBe(1);
    });
  });
});
