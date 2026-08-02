/**
 * Errors shared by the repositories.
 *
 * `RemoteSyncError` started out in `patternRepository`, carrying a `patternId`.
 * It moved here once the project repository began throwing it too: an error
 * shared by both should not name one of them.
 */

/**
 * Thrown when the local write succeeded but the remote write did not.
 *
 * The distinction matters to callers: the data is durable on device, only sync
 * is behind. Collapsing this into a generic write failure would tell people
 * their work was lost when it was not.
 */
export class RemoteSyncError extends Error {
  /** Id of the pattern or project that failed to sync. */
  readonly id: string;
  readonly cause: unknown;

  constructor(id: string, cause: unknown) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    super(`"${id}" was saved locally but not synced: ${reason}`);
    this.name = 'RemoteSyncError';
    this.id = id;
    this.cause = cause;
    // Required so `instanceof` survives transpilation to ES5 targets.
    Object.setPrototypeOf(this, RemoteSyncError.prototype);
  }
}
