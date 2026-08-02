/**
 * Provides the repositories to the app, scoped to the signed-in user.
 *
 * A context rather than a module-level singleton because the repositories need
 * the Firebase `uid`, which does not exist at module load. Making them a
 * provider also means tests can inject fakes without touching the module graph.
 *
 * The repositories are rebuilt when the user changes, so signing in as a
 * different account cannot read the previous user's remote store. Local storage
 * is shared across accounts on the device, which is fine while the app is
 * single-user; a per-user key prefix is the change to make if that stops being
 * true.
 */

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { useAuth } from '../auth/useAuth';
import { getFirestoreDb } from '../firebase/firestore';
import { FirestorePatternStore } from './firestorePatternStore';
import { FirestoreProjectStore } from './firestoreProjectStore';
import { PatternRepository } from './patternRepository';
import { ProjectRepository } from './projectRepository';
import { createStorageAdapter } from '../storage/createStorageAdapter';
import type { StorageAdapter } from '../storage/StorageAdapter';

export interface Repositories {
  readonly patterns: PatternRepository;
  readonly projects: ProjectRepository;
}

const RepositoryContext = createContext<Repositories | null>(null);

export interface RepositoryProviderProps {
  readonly children: ReactNode;
  /** Injected by tests. Defaults to the platform-resolved adapter. */
  readonly storage?: StorageAdapter;
  /** Injected by tests to bypass Firestore entirely. */
  readonly repositories?: Repositories;
}

export function RepositoryProvider({ children, storage, repositories }: RepositoryProviderProps) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  // useState's lazy initializer rather than a ref: the adapter is read during
  // render, and refs must not be. The initializer still runs exactly once per
  // mount, so the IndexedDB handle and MMKV instance are created only once.
  const [adapter] = useState<StorageAdapter>(() => storage ?? createStorageAdapter());

  const value = useMemo<Repositories | null>(() => {
    if (repositories !== undefined) {
      return repositories;
    }
    if (uid === null) {
      // Signed out: no repositories. Screens behind auth never render in this
      // state, and handing out a repository with no remote store would quietly
      // write data that never syncs.
      return null;
    }

    const db = getFirestoreDb();
    const projects = new ProjectRepository({
      storage: adapter,
      remote: new FirestoreProjectStore(db, uid),
      onSyncError: (error) => {
        // A debounced write fails after the caller's await has resolved, so
        // there is nobody left to throw to. Logging is the floor; surfacing it
        // in the UI is a later story.
        console.warn('[sync] project write failed, will retry', error.message);
      },
    });

    return {
      patterns: new PatternRepository({
        storage: adapter,
        remote: new FirestorePatternStore(db, uid),
      }),
      projects,
    };
  }, [uid, adapter, repositories]);

  // Pending progress must reach the server before the repositories are torn
  // down or replaced. Without this, the last few seconds of stitching before a
  // sign-out or account switch are lost from the account, though they survive
  // locally. Reading the ref inside an effect is fine; only render is not.
  const projectsRef = useRef<ProjectRepository | null>(null);
  useEffect(() => {
    const previous = projectsRef.current;
    if (previous !== null && previous !== value?.projects) {
      void previous.flush().catch((error: unknown) => {
        console.warn('[sync] final flush failed', error);
      });
    }
    projectsRef.current = value?.projects ?? null;
  }, [value]);

  return <RepositoryContext.Provider value={value}>{children}</RepositoryContext.Provider>;
}

/**
 * Repositories for the signed-in user.
 *
 * @throws Error when called outside the provider, or while signed out. Screens
 *   that can render signed out should use `useOptionalRepositories`.
 */
export function useRepositories(): Repositories {
  const value = useContext(RepositoryContext);
  if (value === null) {
    throw new Error('useRepositories requires a signed-in user inside <RepositoryProvider>');
  }
  return value;
}

/** Null while signed out, rather than throwing. */
export function useOptionalRepositories(): Repositories | null {
  return useContext(RepositoryContext);
}
