import * as Sentry from '@sentry/react-native';

// Tracks whether `Sentry.init` has already run so repeated calls (e.g. across
// fast refresh or multiple imports) are no-ops.
let initialized = false;

/**
 * Initialize Sentry error tracking.
 *
 * Initialization is guarded by the `EXPO_PUBLIC_SENTRY_DSN` env var: when it is
 * absent (e.g. local development without a Sentry project) we skip `Sentry.init`
 * entirely so the app boots normally and never crashes. The `EXPO_PUBLIC_`
 * prefix lets Expo inline the value at build time.
 *
 * @returns `true` if Sentry was (or had already been) initialized, `false` when
 * no DSN is configured.
 */
export function initSentry(): boolean {
  if (initialized) {
    return true;
  }

  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    return false;
  }

  Sentry.init({
    dsn,
    // Avoid sending personally identifiable information by default.
    sendDefaultPii: false,
  });

  initialized = true;
  return true;
}
