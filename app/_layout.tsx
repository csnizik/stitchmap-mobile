import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { AuthProvider } from '../lib/auth/AuthProvider';
import { useAuth } from '../lib/auth/useAuth';

import '../global.css';

function RootNavigator() {
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

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
