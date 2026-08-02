/**
 * Debounced write scheduler.
 *
 * ADR-005 section 8: under naive write-through, every marked stitch is one
 * Firestore write, so a single 500-stitch session would spend 500 of the 20,000
 * daily writes on the free tier. Coalescing marks into periodic flushes is what
 * makes progress persistence affordable.
 *
 * Two windows, because either alone fails:
 *
 *   - **Idle (5s).** Flushes shortly after the user stops stitching, so a pause
 *     persists work promptly.
 *   - **Maximum (30s).** Bounds how much work is at risk during continuous
 *     stitching, where the idle timer would otherwise never fire.
 *
 * Only the remote write is debounced. Local writes stay immediate.
 *
 * Coalescing happens in the flush callback, not here: this schedules *when* to
 * write, the callback decides *what*. That keeps this class free of any
 * knowledge of what is being written.
 */

export const DEFAULT_IDLE_MS = 5_000;
export const DEFAULT_MAX_WAIT_MS = 30_000;

export interface FlushSchedulerOptions {
  /** Flush this long after the last change. */
  readonly idleMs?: number;
  /** Flush at most this long after the first change in a batch. */
  readonly maxWaitMs?: number;
  /** Injected so tests can drive time rather than wait for it. */
  readonly setTimeoutFn?: (handler: () => void, ms: number) => unknown;
  readonly clearTimeoutFn?: (handle: unknown) => void;
  readonly now?: () => number;
}

export class FlushScheduler {
  private readonly idleMs: number;
  private readonly maxWaitMs: number;
  private readonly setTimeoutFn: (handler: () => void, ms: number) => unknown;
  private readonly clearTimeoutFn: (handle: unknown) => void;
  private readonly now: () => number;
  private readonly flush: () => Promise<void>;

  private handle: unknown;
  /** When the current batch of pending changes began. */
  private batchStartedAt: number | null = null;
  private pending = false;
  /** Non-null while a flush is in flight, so two never overlap. */
  private running: Promise<void> | null = null;

  constructor(flush: () => Promise<void>, options: FlushSchedulerOptions = {}) {
    this.flush = flush;
    this.idleMs = options.idleMs ?? DEFAULT_IDLE_MS;
    this.maxWaitMs = options.maxWaitMs ?? DEFAULT_MAX_WAIT_MS;
    this.setTimeoutFn =
      options.setTimeoutFn ?? ((handler, ms) => setTimeout(handler, ms) as unknown);
    this.clearTimeoutFn =
      options.clearTimeoutFn ?? ((handle) => clearTimeout(handle as never));
    this.now = options.now ?? (() => Date.now());
  }

  /** True while changes are waiting to be written. */
  get hasPending(): boolean {
    return this.pending;
  }

  /**
   * Record that something changed. Restarts the idle timer, but never pushes
   * the flush past `maxWaitMs` from the start of the batch.
   *
   * Safe to call during a flush: it simply opens the next batch.
   */
  schedule(): void {
    this.pending = true;
    if (this.batchStartedAt === null) {
      this.batchStartedAt = this.now();
    }

    const elapsed = this.now() - this.batchStartedAt;
    const remainingMaxWait = Math.max(0, this.maxWaitMs - elapsed);
    const delay = Math.min(this.idleMs, remainingMaxWait);

    this.cancelTimer();
    this.handle = this.setTimeoutFn(() => {
      // A scheduled flush has no caller to reject to. The flush callback is
      // responsible for reporting its own failures.
      void this.run().catch(() => undefined);
    }, delay);
  }

  /**
   * Write immediately, if anything is pending. Call on sign-out, on app
   * background, and before teardown.
   *
   * Rejects if the flush callback rejects, so the caller can decide what to do.
   */
  async flushNow(): Promise<void> {
    this.cancelTimer();
    await this.run();
  }

  /** Drop pending changes without writing. For teardown after an explicit flush. */
  cancel(): void {
    this.cancelTimer();
    this.pending = false;
    this.batchStartedAt = null;
  }

  private cancelTimer(): void {
    if (this.handle !== undefined) {
      this.clearTimeoutFn(this.handle);
      this.handle = undefined;
    }
  }

  private async run(): Promise<void> {
    // Wait out any in-flight flush rather than overlapping with it, then take
    // the pending work if there is still some. Returning here instead would
    // drop changes that arrived while the previous flush was running.
    while (this.running !== null) {
      await this.running;
    }
    if (!this.pending) {
      return;
    }

    // Cleared before awaiting, so changes arriving mid-flush open a new batch
    // instead of being folded into one that has already been snapshotted.
    this.pending = false;
    this.batchStartedAt = null;

    const run = this.flush();
    this.running = run;
    try {
      await run;
    } finally {
      this.running = null;
    }
  }
}
