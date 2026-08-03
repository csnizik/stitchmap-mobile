/**
 * Pointer and wheel interaction on web.
 *
 * Gesture Handler does not translate trackpad or wheel input into pinch
 * gestures on web, so this uses DOM events directly.
 *
 * Listeners are attached imperatively rather than through React props because
 * `wheel` must be non-passive to call preventDefault, and React attaches wheel
 * handlers passively. Without preventDefault, a pinch zooms the whole browser
 * page instead of the chart.
 */

import { useEffect, useRef } from 'react';
import { View } from 'react-native';

import { clampTranslation, zoomAround } from './viewport';
import type { CanvasInteractionProps } from './viewport';

/** Movement beyond this during a press is a drag, not a click. */
const CLICK_SLOP_PX = 5;

/**
 * Trackpad pinch arrives as a wheel event with ctrlKey set, with deltas an
 * order of magnitude smaller than a scroll wheel's. This converts either into
 * a scale factor.
 */
function wheelToScaleFactor(deltaY: number): number {
  return Math.exp(-deltaY / 200);
}

export default function CanvasInteraction({
  values,
  bounds,
  baseCellSize,
  onTap,
  width,
  height,
  children,
}: CanvasInteractionProps) {
  const containerRef = useRef<View | null>(null);

  // The listeners below are registered once and must not close over stale
  // props. Synced in an effect rather than during render, because writing to a
  // ref while rendering is not safe under concurrent rendering.
  const latest = useRef({ values, bounds, baseCellSize, onTap });
  useEffect(() => {
    latest.current = { values, bounds, baseCellSize, onTap };
  }, [values, bounds, baseCellSize, onTap]);

  useEffect(() => {
    // On react-native-web a View ref is the underlying DOM element.
    const node = containerRef.current as unknown as HTMLElement | null;
    if (node === null) {
      return;
    }

    const canvasPoint = (event: { clientX: number; clientY: number }) => {
      const rect = node.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const handleWheel = (event: WheelEvent): void => {
      // Stops the browser zooming the page or scrolling the document.
      event.preventDefault();
      const { values: v, bounds: b, baseCellSize: cell } = latest.current;
      const point = canvasPoint(event);

      if (event.ctrlKey) {
        // Trackpad pinch, or ctrl+wheel on a mouse.
        const next = zoomAround(
          {
            scale: v.scale.value,
            translateX: v.translateX.value,
            translateY: v.translateY.value,
          },
          point.x,
          point.y,
          v.scale.value * wheelToScaleFactor(event.deltaY),
          b,
          cell,
        );
        v.scale.value = next.scale;
        v.translateX.value = next.translateX;
        v.translateY.value = next.translateY;
        return;
      }

      // Two-finger scroll pans.
      const next = clampTranslation(
        {
          scale: v.scale.value,
          translateX: v.translateX.value - event.deltaX,
          translateY: v.translateY.value - event.deltaY,
        },
        b,
      );
      v.translateX.value = next.translateX;
      v.translateY.value = next.translateY;
    };

    let dragging = false;
    let moved = 0;
    let originX = 0;
    let originY = 0;

    const handlePointerDown = (event: PointerEvent): void => {
      const { values: v } = latest.current;
      dragging = true;
      moved = 0;
      originX = event.clientX;
      originY = event.clientY;
      v.startX.value = v.translateX.value;
      v.startY.value = v.translateY.value;
      node.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: PointerEvent): void => {
      if (!dragging) {
        return;
      }
      const { values: v, bounds: b } = latest.current;
      const dx = event.clientX - originX;
      const dy = event.clientY - originY;
      moved = Math.max(moved, Math.hypot(dx, dy));

      const next = clampTranslation(
        {
          scale: v.scale.value,
          translateX: v.startX.value + dx,
          translateY: v.startY.value + dy,
        },
        b,
      );
      v.translateX.value = next.translateX;
      v.translateY.value = next.translateY;
    };

    const handlePointerUp = (event: PointerEvent): void => {
      if (!dragging) {
        return;
      }
      dragging = false;
      node.releasePointerCapture(event.pointerId);

      // A press that barely moved is a click, not a pan.
      if (moved <= CLICK_SLOP_PX) {
        const { values: v, onTap: tap } = latest.current;
        const point = canvasPoint(event);
        tap(point.x, point.y, {
          scale: v.scale.value,
          translateX: v.translateX.value,
          translateY: v.translateY.value,
        });
      }
    };

    node.addEventListener('wheel', handleWheel, { passive: false });
    node.addEventListener('pointerdown', handlePointerDown);
    node.addEventListener('pointermove', handlePointerMove);
    node.addEventListener('pointerup', handlePointerUp);
    node.addEventListener('pointercancel', handlePointerUp);

    return () => {
      node.removeEventListener('wheel', handleWheel);
      node.removeEventListener('pointerdown', handlePointerDown);
      node.removeEventListener('pointermove', handlePointerMove);
      node.removeEventListener('pointerup', handlePointerUp);
      node.removeEventListener('pointercancel', handlePointerUp);
    };
  }, []);

  return (
    <View ref={containerRef} style={{ width, height, touchAction: 'none' } as never}>
      {children}
    </View>
  );
}
