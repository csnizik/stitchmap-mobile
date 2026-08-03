import PatternCanvas from './PatternCanvas';
import type { PatternCanvasProps } from './PatternCanvas';

/**
 * Native needs no CanvasKit loading step, so this renders directly. See
 * PatternHost.web.tsx for why the split exists.
 */
export default function PatternHost(props: PatternCanvasProps) {
  return <PatternCanvas {...props} />;
}
