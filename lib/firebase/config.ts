// Firebase configuration sourced entirely from environment variables.
//
// Expo inlines any variable prefixed with `EXPO_PUBLIC_` at build time, so
// these values ship in the client bundle — that is expected for a Firebase web
// config (it is not a secret; access is governed by Auth + Security Rules).
// Keeping them in env vars (never committed) lets each environment supply its
// own project without code changes. Populate them in a local `.env` file (see
// `.env.example`) or via CI/EAS secrets.

import { type FirebaseOptions } from 'firebase/app';

/** Firebase web config assembled from `EXPO_PUBLIC_FIREBASE_*` env vars. */
export const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

/**
 * Config keys that must be present for Firebase Auth to initialize. A missing
 * `storageBucket`/`messagingSenderId` only affects Storage/Messaging, so they
 * are intentionally excluded from this Auth-focused check.
 */
export const REQUIRED_FIREBASE_CONFIG_KEYS = [
  'apiKey',
  'authDomain',
  'projectId',
  'appId',
] as const satisfies readonly (keyof FirebaseOptions)[];

/**
 * Returns `true` when every required config key has a non-empty value.
 *
 * Used to fail fast with a clear message instead of surfacing Firebase's
 * opaque `auth/invalid-api-key` error when the env vars are not wired up.
 */
export function isFirebaseConfigured(config: FirebaseOptions = firebaseConfig): boolean {
  return REQUIRED_FIREBASE_CONFIG_KEYS.every((key) => {
    const value = config[key];
    return typeof value === 'string' && value.length > 0;
  });
}
