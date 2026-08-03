/**
 * Flushes pending progress when the app leaves the foreground.
 *
 * Progress writes are debounced by 5 seconds idle, 30 seconds maximum, so at
 * any moment up to half a minute of stitching may exist only on the device. If
 * the user backgrounds the app inside that window and the OS later kills it,
 * that work never reaches their account.
 *
 * Backgrounding is the last reliable moment to write. On iOS the app may be
 * suspended shortly after, and terminated without further notice.
 */

import { useEffect } from 'react';
import { AppState } from 'react-native';
import type { AppStateStatus } from 'react-native';

import type { ProjectRepository } from './projectRepository';

export function useFlushOnBackground(projects: ProjectRepository | null): void {
  useEffect(() => {
    if (projects === null) {
      return;
    }

    const handleChange = (status: AppStateStatus): void => {
      // 'inactive' is a transient iOS state (app switcher, incoming call) that
      // often precedes 'background'. Flushing on it too is harmless, since a
      // flush with nothing pending is a no-op, and it catches the case where
      // the app never reaches 'background' before being killed.
      if (status === 'background' || status === 'inactive') {
        void projects.flush().catch((error: unknown) => {
          // Nothing to surface to: the user is no longer looking at the app.
          // The write stays queued and retries on the next flush.
          console.warn('[sync] flush on background failed', error);
        });
      }
    };

    const subscription = AppState.addEventListener('change', handleChange);
    return () => {
      subscription.remove();
    };
  }, [projects]);
}
