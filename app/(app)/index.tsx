import { StatusBar } from 'expo-status-bar';
import { Pressable, Text, View } from 'react-native';

import { APP_NAME, APP_VERSION } from '../../constants/app';
import { useAuth } from '../../lib/auth/useAuth';

export default function HomeScreen() {
  const { user, signOut } = useAuth();

  return (
    <View className="flex-1 items-center justify-center bg-surface-light px-lg">
      <Text className="text-title font-semibold text-brand-700">{APP_NAME}</Text>
      <Text className="mt-sm text-body text-muted">v{APP_VERSION}</Text>

      {user?.email ? (
        <Text className="mt-md text-body text-muted">Signed in as {user.email}</Text>
      ) : null}

      <Pressable
        className="mt-lg items-center rounded-md bg-brand-600 px-md py-sm active:opacity-80"
        onPress={() => {
          void signOut();
        }}
        accessibilityRole="button"
        accessibilityLabel="Log out"
      >
        <Text className="text-body font-semibold text-white">Log out</Text>
      </Pressable>

      <StatusBar style="auto" />
    </View>
  );
}
