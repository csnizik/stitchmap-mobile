import { FirebaseError } from 'firebase/app';

import { DEFAULT_AUTH_ERROR_MESSAGE, getAuthErrorMessage } from '../errors';

describe('getAuthErrorMessage', () => {
  it('maps known Firebase auth error codes to friendly copy', () => {
    expect(getAuthErrorMessage(new FirebaseError('auth/invalid-credential', 'x'))).toBe(
      'Incorrect email or password.',
    );
    expect(getAuthErrorMessage(new FirebaseError('auth/email-already-in-use', 'x'))).toBe(
      'An account already exists for that email.',
    );
    expect(getAuthErrorMessage(new FirebaseError('auth/network-request-failed', 'x'))).toBe(
      'Network error. Check your connection and try again.',
    );
  });

  it('falls back to the default message for unknown Firebase codes', () => {
    expect(getAuthErrorMessage(new FirebaseError('auth/some-new-code', 'x'))).toBe(
      DEFAULT_AUTH_ERROR_MESSAGE,
    );
  });

  it('falls back to the default message for non-Firebase errors', () => {
    expect(getAuthErrorMessage(new Error('boom'))).toBe(DEFAULT_AUTH_ERROR_MESSAGE);
    expect(getAuthErrorMessage('nope')).toBe(DEFAULT_AUTH_ERROR_MESSAGE);
    expect(getAuthErrorMessage(undefined)).toBe(DEFAULT_AUTH_ERROR_MESSAGE);
  });
});
