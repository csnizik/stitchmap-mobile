// Auth state provider backed by Firebase Auth.
//
// Subscribes to `onAuthStateChanged` once and exposes the current user plus
// email/password actions through context. `useAuth` (in ./useAuth) is the
// consumer hook. Action methods set `error` to a friendly, user-facing message
// on failure (see ./errors) rather than throwing, so screens can render it
// directly; on success, the auth-state listener drives navigation.

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import { auth } from '../firebase/auth';

import { getAuthErrorMessage } from './errors';

export interface AuthContextValue {
  /** The signed-in Firebase user, or `null` when signed out. */
  user: User | null;
  /** `true` until the initial auth state has resolved. */
  isLoading: boolean;
  /** User-facing message from the most recent failed action, else `null`. */
  error: string | null;
  /** Signs in with an existing email/password. */
  signIn: (email: string, password: string) => Promise<void>;
  /** Creates a new account with email/password. */
  signUp: (email: string, password: string) => Promise<void>;
  /** Signs the current user out. */
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (caught) {
      setError(getAuthErrorMessage(caught));
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (caught) {
      setError(getAuthErrorMessage(caught));
    }
  }, []);

  const signOut = useCallback(async () => {
    setError(null);
    try {
      await firebaseSignOut(auth);
    } catch (caught) {
      setError(getAuthErrorMessage(caught));
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, error, signIn, signUp, signOut }),
    [user, isLoading, error, signIn, signUp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
