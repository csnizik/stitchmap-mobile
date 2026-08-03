import * as Sentry from '@sentry/react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { AuthProvider } from '../lib/auth/AuthProvider';
import { useAuth } from '../lib/auth/useAuth';
import { initSentry } from '../lib/monitoring/sentry';

import '../global.css';
import { RepositoryProvider } from '../lib/repositories/RepositoryProvider';

// Initialize Sentry as early as possible so errors thrown during boot are
// captured. This is a no-op when EXPO_PUBLIC_SENTRY_DSN is not configured.
initSentry();

function RootNavigator() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      // Unauthenticated users may only see the auth screens.
      router.replace('/login');
    } else if (user && inAuthGroup) {
      // Authenticated users land on the protected app shell.
      router.replace('/');
    }
  }, [user, isLoading, segments, router]);

  if (isLoading) {
    return null;
  }

  // The Stack always renders once auth has resolved. Returning null here to
  // pre-empt a redirect would deadlock: expo-router only populates `segments`
  // after the navigator mounts, and the effect above needs `segments` to know
  // where to redirect. Blocking the render starves it of that input.
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
    </Stack>
  );
}

function RootLayout() {
  return (
    <AuthProvider>
      <RepositoryProvider>
        <RootNavigator />
      </RepositoryProvider>
    </AuthProvider>
  );
}

// Wrap the root layout so Sentry can capture render errors and (when enabled)
// touch/navigation events. The wrapper is a safe pass-through when Sentry is
// not initialized.
export default Sentry.wrap(RootLayout);
