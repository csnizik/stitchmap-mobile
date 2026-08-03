/**
 * Touch interaction on iOS and Android, via Gesture Handler.
 *
 * Split from the web implementation because Gesture Handler does not map
 * trackpad or wheel input on web, and its pointer handling does not reach
 * through the Skia canvas element there. Rendering stays shared; only input
 * differs.
 */

/* eslint-disable react-hooks/immutability --
 * React Compiler's immutability rule does not model reanimated shared values.
 * Assigning to `.value` is the entire point of a SharedValue: it is how the UI
 * thread is updated without a React re-render, and it is what keeps these
 * gestures off the JS thread. The rule sees a mutation of something reached
 * through props and objects, which is a false positive here.
 */

import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';

import { clampTranslation, zoomAround } from './viewport';
import type { CanvasInteractionProps } from './viewport';

export default function CanvasInteraction({
  values,
  bounds,
  baseCellSize,
  onTap,
  width,
  height,
  children,
}: CanvasInteractionProps) {
  const { scale, translateX, translateY, startScale, startX, startY } = values;

  const pan = Gesture.Pan()
    .onStart(() => {
      // Deltas are relative to where the gesture began, not the previous frame,
      // so a clamped edge does not accumulate drift.
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((event) => {
      const next = clampTranslation(
        {
          scale: scale.value,
          translateX: startX.value + event.translationX,
          translateY: startY.value + event.translationY,
        },
        bounds,
      );
      translateX.value = next.translateX;
      translateY.value = next.translateY;
    });

  const pinch = Gesture.Pinch()
    .onStart(() => {
      startScale.value = scale.value;
    })
    .onUpdate((event) => {
      const next = zoomAround(
        { scale: scale.value, translateX: translateX.value, translateY: translateY.value },
        event.focalX,
        event.focalY,
        startScale.value * event.scale,
        bounds,
        baseCellSize,
      );
      scale.value = next.scale;
      translateX.value = next.translateX;
      translateY.value = next.translateY;
    });

  const tap = Gesture.Tap()
    // A drag past this distance is a pan, not a tap. Without it, marking a
    // stitch every time the chart is repositioned would be maddening.
    .maxDistance(10)
    .onEnd((event) => {
      // scheduleOnRN, not runOnJS: Reanimated 4 moved worklet scheduling into
      // react-native-worklets and takes arguments directly rather than curried.
      scheduleOnRN(onTap, event.x, event.y, {
        scale: scale.value,
        translateX: translateX.value,
        translateY: translateY.value,
      });
    });

  const gesture = Gesture.Exclusive(Gesture.Simultaneous(pan, pinch), tap);

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ width, height }}>{children}</View>
    </GestureDetector>
  );
}
