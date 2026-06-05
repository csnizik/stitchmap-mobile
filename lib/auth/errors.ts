// Translates Firebase Auth error codes into short, user-facing messages.
//
// Firebase throws `FirebaseError`s whose `.code` is a stable string such as
// `auth/invalid-credential`. The raw `.message` is developer-oriented (and may
// leak implementation details), so screens display the mapped copy instead.

import { FirebaseError } from 'firebase/app';

/** Fallback shown when an error has no specific mapping. */
export const DEFAULT_AUTH_ERROR_MESSAGE = 'Something went wrong. Please try again.';

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/invalid-email': 'That email address is not valid.',
  'auth/missing-email': 'Please enter your email address.',
  'auth/missing-password': 'Please enter your password.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/user-not-found': 'No account found for that email.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/email-already-in-use': 'An account already exists for that email.',
  'auth/weak-password': 'Password should be at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Please try again later.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
  'auth/operation-not-allowed': 'Email/password sign-in is not enabled.',
};

/**
 * Returns a friendly message for an unknown error thrown by a Firebase Auth
 * call. Non-Firebase errors fall back to {@link DEFAULT_AUTH_ERROR_MESSAGE}.
 */
export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    return AUTH_ERROR_MESSAGES[error.code] ?? DEFAULT_AUTH_ERROR_MESSAGE;
  }

  return DEFAULT_AUTH_ERROR_MESSAGE;
}
