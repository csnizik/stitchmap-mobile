// Stub auth hook. The real implementation (Firebase Auth) arrives in Story 7.
// To exercise the authenticated flow locally, temporarily change `user` to a
// non-null value (e.g. `{ uid: 'dev' }`).

export interface AuthUser {
  uid: string;
}

export interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
}

export function useAuth(): AuthState {
  return { user: null, isLoading: false };
}
