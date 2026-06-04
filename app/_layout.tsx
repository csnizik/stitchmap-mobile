import * as Sentry from '@sentry/react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from '../lib/auth/useAuth';
import { initSentry } from '../lib/monitoring/sentry';

import '../global.css';

// Initialize Sentry as early as possible so errors thrown during boot are
// captured. This is a no-op when EXPO_PUBLIC_SENTRY_DSN is not configured.
initSentry();

function RootLayout() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading || (segments as string[]).length === 0) {
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

  const inAuthGroup = segments[0] === '(auth)';
  const shouldRedirectToLogin = !user && !inAuthGroup;
  const shouldRedirectToApp = !!user && inAuthGroup;

  if (shouldRedirectToLogin || shouldRedirectToApp) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
    </Stack>
  );
}

// Wrap the root layout so Sentry can capture render errors and (when enabled)
// touch/navigation events. The wrapper is a safe pass-through when Sentry is
// not initialized.
export default Sentry.wrap(RootLayout);
