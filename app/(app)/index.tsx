/**
 * The workspace. Seeds the sample pattern on first launch, renders it, and
 * marks stitches as the user taps them.
 *
 * In development it also carries a size picker and frame-rate readout, for the
 * rendering work in #44. Both are compiled out of release builds.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Text, View, useWindowDimensions } from 'react-native';

import DevOverlay from '../../components/DevOverlay';
import type { PatternSizeKey } from '../../components/DevOverlay';
import PatternHost from '../../components/PatternHost';
import { placementCountAt } from '../../lib/domain/cells';
import { getCell } from '../../lib/domain/grid';
import { countPlacements, createEmptyProject, markCell } from '../../lib/domain/progress';
import type { Pattern, Project } from '../../lib/domain/types';
import { useOptionalRepositories } from '../../lib/repositories/RepositoryProvider';
import { seedSampleData } from '../../lib/repositories/seedSampleData';
import { PERFORMANCE_SIZES, generatePattern } from '../../lib/samples/generatePattern';

/**
 * Cell size at scale 1. The viewport transform handles fitting and zooming, so
 * this does not vary with pattern size; it is the unit the zoom limits and the
 * hit test are expressed in.
 */
const BASE_CELL_SIZE = 20;

type LoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'ready'; readonly pattern: Pattern; readonly project: Project };

interface Layout {
  readonly width: number;
  readonly height: number;
}

export default function Workspace() {
  // Optional, not required: the root layout renders the navigator before the
  // redirect to /login lands, so this screen mounts for one frame while signed
  // out. Throwing there would crash a legitimate transient state.
  const repositories = useOptionalRepositories();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  /**
   * Development only. A generated chart replaces the stored one in memory
   * without touching a repository: persisting 1.1 MB per size change would
   * measure storage rather than rendering. Progress on a generated chart is
   * therefore lost on switch, which is fine for a measurement harness.
   */
  const [sizeKey, setSizeKey] = useState<PatternSizeKey>('sample');
  const [generated, setGenerated] = useState<{
    readonly pattern: Pattern;
    readonly project: Project;
  } | null>(null);

  const containerRef = useRef<View | null>(null);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [layout, setLayout] = useState<Layout | null>(null);

  // Measured from the mounted node rather than onLayout, which does not fire
  // reliably on react-native-web, and rather than the window, which is taller
  // than the canvas: passing the window height made "the whole chart fits"
  // mean "the chart runs off the bottom".
  useEffect(() => {
    const node = containerRef.current as unknown as {
      getBoundingClientRect?: () => DOMRect;
    } | null;
    const rect = node?.getBoundingClientRect?.();
    if (rect !== undefined && rect.width > 0 && rect.height > 0) {
      setLayout({ width: rect.width, height: rect.height });
      return;
    }
    // Native, where there is no DOM node to measure.
    setLayout({ width: windowWidth, height: windowHeight });
  }, [windowWidth, windowHeight, state.status]);

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

  const handleSelectSize = useCallback((key: PatternSizeKey) => {
    setSizeKey(key);
    if (key === 'sample') {
      setGenerated(null);
      return;
    }
    const now = new Date().toISOString();
    const pattern = generatePattern({ ...PERFORMANCE_SIZES[key] });
    setGenerated({
      pattern,
      project: createEmptyProject({ id: `${pattern.id}-project`, pattern, now }),
    });
  }, []);

  // The generated chart takes precedence when one is loaded.
  const active = useMemo(() => {
    if (generated !== null) {
      return generated;
    }
    return state.status === 'ready' ? { pattern: state.pattern, project: state.project } : null;
  }, [generated, state]);

  const stats = useMemo(() => {
    if (active === null) {
      return undefined;
    }
    return {
      placements: countPlacements(active.pattern),
      runs: active.pattern.cells.rows.reduce((total, row) => total + row.length, 0),
    };
  }, [active]);

  const handleCellPress = useCallback(
    (x: number, y: number) => {
      if (active === null) {
        return;
      }
      const { pattern, project } = active;

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
      const now = new Date().toISOString();

      // Generated charts are in-memory only, so they update state directly
      // rather than going through the repository.
      if (generated !== null) {
        setGenerated({
          pattern,
          project: markCell(pattern, project, x, y, complete, now),
        });
        return;
      }

      if (repositories === null) {
        return;
      }

      void repositories.projects
        .markCell(pattern, project, x, y, complete, now)
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
    [active, generated, repositories],
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

  return (
    <View ref={containerRef} className="flex-1">
      {layout !== null && active !== null && (
        <PatternHost
          // Remounting on a size change resets the viewport, so a new chart
          // opens fitted rather than inheriting the previous transform.
          pattern={active.pattern}
          project={active.project}
          baseCellSize={BASE_CELL_SIZE}
          viewWidth={layout.width}
          viewHeight={layout.height}
          onCellPress={handleCellPress}
        />
      )}
      {__DEV__ && <DevOverlay selected={sizeKey} onSelect={handleSelectSize} stats={stats} />}
    </View>
  );
}
