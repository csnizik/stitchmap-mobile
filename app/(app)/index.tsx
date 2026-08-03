/**
 * The workspace. Seeds the sample pattern on first launch, renders it, and
 * marks stitches as the user taps them.
 */

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View, useWindowDimensions } from 'react-native';

import PatternHost from '../../components/PatternHost';
import { placementCountAt } from '../../lib/domain/cells';
import { getCell } from '../../lib/domain/grid';
import type { Pattern, Project } from '../../lib/domain/types';
import { useOptionalRepositories } from '../../lib/repositories/RepositoryProvider';
import { seedSampleData } from '../../lib/repositories/seedSampleData';

type LoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'ready'; readonly pattern: Pattern; readonly project: Project };

export default function Workspace() {
  // Optional, not required: the root layout renders the navigator before the
  // redirect to /login lands, so this screen mounts for one frame while signed
  // out. Throwing there would crash a legitimate transient state.
  const repositories = useOptionalRepositories();
  const { width: screenWidth } = useWindowDimensions();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  const load = useCallback(async () => {
    if (repositories === null) {
      return null;
    }
    const { pattern, project } = await seedSampleData(repositories, new Date().toISOString());
    return { pattern, project };
  }, [repositories]);

  useEffect(() => {
    let cancelled = false;

    void load()
      .then((result) => {
        if (!cancelled && result !== null) {
          setState({ status: 'ready', pattern: result.pattern, project: result.project });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            message: error instanceof Error ? error.message : String(error),
          });
        }
      });

    // Repositories are rebuilt when the user changes, so a stale response from
    // a previous account must not overwrite the current one.
    return () => {
      cancelled = true;
    };
  }, [load]);

  const handleCellPress = useCallback(
    (x: number, y: number) => {
      if (repositories === null || state.status !== 'ready') {
        return;
      }
      const { pattern, project } = state;

      // A blank cell has nothing to mark. markCell would be a no-op, but
      // checking here avoids a pointless write and a state update.
      const placements = placementCountAt(pattern.cellContents, getCell(pattern.cells, x, y));
      if (placements === 0) {
        return;
      }

      // Toggle the whole cell: if anything in it is done, clear it; otherwise
      // complete it. Marking individual placements within a shared cell is a
      // Phase 3 tool.
      const complete = getCell(project.cellProgress, x, y) === 0;

      void repositories.projects
        .markCell(pattern, project, x, y, complete, new Date().toISOString())
        .then((next) => {
          setState({ status: 'ready', pattern, project: next });
        })
        .catch((error: unknown) => {
          // The remote write is debounced and reports separately via
          // onSyncError, so a rejection here means the local write failed,
          // which is a real storage problem rather than a sync one.
          console.warn('[progress] failed to mark cell', error);
        });
    },
    [repositories, state],
  );

  if (state.status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  if (state.status === 'error') {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Text className="text-center text-red-700">{state.message}</Text>
      </View>
    );
  }

  // Fit the chart to the screen with a small margin. Pan and zoom are #43;
  // until then the whole pattern has to be visible at once.
  const cellSize = Math.max(4, Math.floor((screenWidth - 32) / state.pattern.width));

  return (
    <View className="flex-1 items-center justify-center">
      <PatternHost
        pattern={state.pattern}
        project={state.project}
        cellSize={cellSize}
        onCellPress={handleCellPress}
      />
    </View>
  );
}
