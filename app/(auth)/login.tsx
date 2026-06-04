import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { useAuth } from '../../lib/auth/useAuth';

export default function LoginScreen() {
  const { signIn, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (submitting) {
      return;
    }
    setSubmitting(true);
    await signIn(email.trim(), password);
    setSubmitting(false);
  };

  return (
    <View className="flex-1 justify-center bg-surface-light px-lg">
      <Text className="text-title font-semibold text-brand-700">Sign in</Text>
      <Text className="mt-xs text-body text-muted">Welcome back to StitchMap.</Text>

      <TextInput
        className="mt-lg rounded-md border border-brand-100 px-md py-sm text-body"
        placeholder="Email"
        placeholderTextColor="#666666"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        inputMode="email"
        value={email}
        onChangeText={setEmail}
        editable={!submitting}
        accessibilityLabel="Email"
      />
      <TextInput
        className="mt-sm rounded-md border border-brand-100 px-md py-sm text-body"
        placeholder="Password"
        placeholderTextColor="#666666"
        autoCapitalize="none"
        autoComplete="password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        editable={!submitting}
        accessibilityLabel="Password"
      />

      {error ? <Text className="mt-sm text-body text-red-600">{error}</Text> : null}

      <Pressable
        className="mt-lg items-center rounded-md bg-brand-600 px-md py-sm active:opacity-80"
        onPress={handleSubmit}
        disabled={submitting}
        accessibilityRole="button"
        accessibilityLabel="Sign in"
      >
        {submitting ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text className="text-body font-semibold text-white">Sign in</Text>
        )}
      </Pressable>

      <Link href="/register" className="mt-lg text-body text-brand-600">
        Need an account? Register
      </Link>
    </View>
  );
}
