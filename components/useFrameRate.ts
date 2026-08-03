/**
 * Samples the frame rate.
 *
 * The #44 acceptance criteria call for a stated frame rate rather than an
 * impression, so this exists to produce a number. It counts animation frames
 * over a fixed window, which measures how fast the app is able to present
 * frames while something is driving them.
 *
 * A caveat worth stating whenever a number from this is quoted: an idle app
 * schedules no work, so a high reading while nothing is happening means
 * nothing. Read it *during* a pan or zoom.
 */

import { useEffect, useRef, useState } from 'react';

/** How often to report. Long enough to be stable, short enough to feel live. */
const SAMPLE_WINDOW_MS = 500;

export interface FrameRateSample {
  /** Frames per second over the last window. */
  readonly fps: number;
  /** The lowest window seen since mounting: where stutter shows up. */
  readonly worst: number;
}

export function useFrameRate(enabled = true): FrameRateSample {
  const [sample, setSample] = useState<FrameRateSample>({
    fps: 0,
    worst: Number.POSITIVE_INFINITY,
  });
  const worstRef = useRef(Number.POSITIVE_INFINITY);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let frames = 0;
    let windowStart = performance.now();
    let handle = 0;
    let cancelled = false;

    const tick = (now: number): void => {
      if (cancelled) {
        return;
      }
      frames += 1;
      const elapsed = now - windowStart;

      if (elapsed >= SAMPLE_WINDOW_MS) {
        const fps = Math.round((frames * 1000) / elapsed);
        // Ignore the first window: it includes mount work and is not
        // representative of steady-state rendering.
        if (worstRef.current !== Number.POSITIVE_INFINITY || frames > 1) {
          worstRef.current = Math.min(worstRef.current, fps);
        }
        setSample({ fps, worst: worstRef.current });
        frames = 0;
        windowStart = now;
      }

      handle = requestAnimationFrame(tick);
    };

    handle = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(handle);
    };
  }, [enabled]);

  return sample;
}
