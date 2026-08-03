import { Text } from 'react-native';
import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

import type { PatternCanvasProps } from './PatternCanvas';

/**
 * On web, Skia runs on CanvasKit: a 2.9 MB WebAssembly binary loaded
 * asynchronously. Anything importing Skia must therefore be deferred until
 * CanvasKit is ready, which is what WithSkiaWeb does.
 *
 * The deferred component must live outside `app/`, because Expo Router
 * evaluates that directory before CanvasKit finishes loading.
 */
export default function PatternHost(props: PatternCanvasProps) {
  return (
    <WithSkiaWeb
      getComponent={() => import('./PatternCanvas')}
      componentProps={props}
      fallback={<Text>Loading canvas...</Text>}
    />
  );
}
