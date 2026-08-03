/**
 * Firestore instance for the app.
 *
 * Both the app and the Firestore handle are created lazily. Config comes from
 * env vars that are absent in tests, so importing this module must not require
 * them; nothing initializes until something actually asks for the database.
 *
 * `getApps()` makes initialization idempotent, so this is safe regardless of
 * whether the auth layer has already created the app.
 */

import { getApp, getApps, initializeApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

import { firebaseConfig, isFirebaseConfigured } from './config';

function resolveApp(): FirebaseApp {
  return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
}

let db: Firestore | null = null;

/**
 * @throws Error when Firebase env vars are missing. Failing here beats letting
 *   the SDK fail later with a less obvious message.
 */
export function getFirestoreDb(): Firestore {
  if (db === null) {
    if (!isFirebaseConfigured()) {
      throw new Error(
        'Firebase is not configured. Set the EXPO_PUBLIC_FIREBASE_* variables in .env.local.',
      );
    }
    db = getFirestore(resolveApp());
  }
  return db;
}
