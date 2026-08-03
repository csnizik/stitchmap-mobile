/**
 * Hydrates local storage from the account on sign-in.
 *
 * Only the indexes are pulled: pattern and project metadata, no grid chunks. A
 * single chart runs over a megabyte, so fetching every one eagerly would make
 * sign-in slow and burn read quota on data the user may never open. Charts are
 * fetched on demand instead, through the repositories' existing `fetch`.
 *
 * Failure is non-fatal by design. Local-first means an unreachable server
 * degrades to working offline, not to a blank screen, and whatever is already
 * on the device stays usable.
 *
 * Offline queueing and conflict resolution remain out of scope (S3-4).
 */

import { useEffect, useRef, useState } from 'react';

import type { RemoteSyncError } from './errors';
import type { PatternRepository } from './patternRepository';
import type { ProjectRepository } from './projectRepository';

export type HydrationStatus = 'idle' | 'syncing' | 'synced' | 'failed';

export interface Hydration {
  readonly status: HydrationStatus;
  /** Set when the last attempt failed. Local data is still usable. */
  readonly error?: Error;
}

/** Only the outcome needs state; idle and syncing are derivable. */
type Outcome = { readonly done: true } | { readonly failed: Error } | null;

export interface UseHydrateOnSignInOptions {
  readonly patterns: PatternRepository | null;
  readonly projects: ProjectRepository | null;
  /** Reported the same way debounced write failures are. */
  readonly onSyncError?: (error: RemoteSyncError | Error) => void;
}

export function useHydrateOnSignIn({
  patterns,
  projects,
  onSyncError,
}: UseHydrateOnSignInOptions): Hydration {
  // Only the resolution is stored. Setting 'idle' or 'syncing' from inside the
  // effect would be a synchronous setState in an effect body, which triggers a
  // cascading render for a value that can simply be derived below.
  const [outcome, setOutcome] = useState<Outcome>(null);

  /**
   * Held in a ref, and deliberately absent from the effect's dependencies.
   *
   * A caller passing an inline arrow creates a new function every render. With
   * the callback in the dependency array, a failure set state, which
   * re-rendered, which produced a new callback, which re-ran the effect: a test
   * recorded 3,539 hydration attempts before the assertion caught it.
   */
  const onSyncErrorRef = useRef(onSyncError);
  useEffect(() => {
    onSyncErrorRef.current = onSyncError;
  }, [onSyncError]);

  useEffect(() => {
    if (patterns === null || projects === null) {
      return;
    }

    let cancelled = false;

    // Both indexes together: a partial hydration would leave the two listings
    // disagreeing about what exists.
    void Promise.all([patterns.syncIndexFromRemote(), projects.syncIndexFromRemote()])
      .then(() => {
        if (!cancelled) {
          setOutcome({ done: true });
        }
      })
      .catch((error: unknown) => {
        const wrapped = error instanceof Error ? error : new Error(String(error));
        const report = onSyncErrorRef.current;
        if (report !== undefined) {
          report(wrapped);
        }
        if (!cancelled) {
          setOutcome({ failed: wrapped });
        }
      });

    // The repositories are rebuilt when the user changes, so a response for a
    // previous account must not land as this one's state.
    return () => {
      cancelled = true;
      setOutcome(null);
    };
  }, [patterns, projects]);

  if (patterns === null || projects === null) {
    return { status: 'idle' };
  }
  if (outcome === null) {
    return { status: 'syncing' };
  }
  if ('failed' in outcome) {
    return { status: 'failed', error: outcome.failed };
  }
  return { status: 'synced' };
}
