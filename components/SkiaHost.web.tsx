import { Text } from 'react-native';
import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

// On web, CanvasKit is a 2.9 MB WASM binary loaded asynchronously, so the
// component has to be deferred until it is ready. It also must live outside
// app/, because Expo Router evaluates that directory before CanvasKit loads.
export default function SkiaHost() {
  return (
    <WithSkiaWeb
      getComponent={() => import('./SkiaSmokeTest')}
      fallback={<Text>Loading Skia...</Text>}
    />
  );
}
