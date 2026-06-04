// Firebase app + Auth initialization with platform-appropriate persistence.
//
// Native (iOS/Android): `initializeAuth` with `getReactNativePersistence`
// backed by AsyncStorage, so the signed-in session survives app restarts.
// Web: `getAuth`, which uses Firebase's default (IndexedDB/localStorage)
// persistence. Metro resolves the React Native bundle of `firebase/auth` on
// native, where `getReactNativePersistence` is available.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth, type Auth } from 'firebase/auth';
import { Platform } from 'react-native';

import { firebaseConfig, isFirebaseConfigured } from './config';

if (!isFirebaseConfigured()) {
  // Fail loudly during development instead of surfacing Firebase's opaque
  // `auth/invalid-api-key` error later, when the user taps "Sign in".
  console.warn(
    'Firebase is not configured. Set the EXPO_PUBLIC_FIREBASE_* environment ' +
      'variables (see .env.example) so authentication can work.',
  );
}

// Reuse the existing app instance across Fast Refresh / re-imports.
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

function createAuth(): Auth {
  if (Platform.OS === 'web') {
    return getAuth(app);
  }

  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // `initializeAuth` throws if it has already run for this app (e.g. after a
    // Fast Refresh); fall back to the already-initialized instance.
    return getAuth(app);
  }
}

/** Shared Firebase Auth instance used throughout the app. */
export const auth: Auth = createAuth();
