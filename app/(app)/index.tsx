import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';

import { APP_NAME, APP_VERSION } from '../../constants/app';

export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-surface-light">
      <Text className="text-title font-semibold text-brand-700">{APP_NAME}</Text>
      <Text className="mt-sm text-body text-muted">v{APP_VERSION}</Text>
      <StatusBar style="auto" />
    </View>
  );
}
