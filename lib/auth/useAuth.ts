// Consumer hook for the Firebase-backed auth context.
//
// Replaces the Story 4 stub. Returns the live auth state and actions
// (`{ user, isLoading, error, signIn, signUp, signOut }`) supplied by
// `AuthProvider`, which must wrap any component that calls this hook.

import { useContext } from 'react';

import { AuthContext, type AuthContextValue } from './AuthProvider';

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth must be used within an <AuthProvider>.');
  }

  return context;
}
