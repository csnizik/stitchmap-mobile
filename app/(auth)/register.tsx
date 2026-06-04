import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';

import { useAuth } from '../../lib/auth/useAuth';

export default function RegisterScreen() {
  const { signUp, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (submitting) {
      return;
    }
    setLocalError(null);

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    await signUp(email.trim(), password);
    setSubmitting(false);
  };

  // Local validation takes precedence over the (older) provider error.
  const message = localError ?? error;

  return (
    <View className="flex-1 justify-center bg-surface-light px-lg">
      <Text className="text-title font-semibold text-brand-700">Create account</Text>
      <Text className="mt-xs text-body text-muted">Start mapping your stitches.</Text>

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
        autoComplete="new-password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        editable={!submitting}
        accessibilityLabel="Password"
      />
      <TextInput
        className="mt-sm rounded-md border border-brand-100 px-md py-sm text-body"
        placeholder="Confirm password"
        placeholderTextColor="#666666"
        autoCapitalize="none"
        autoComplete="new-password"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        editable={!submitting}
        accessibilityLabel="Confirm password"
      />

      {message ? <Text className="mt-sm text-body text-red-600">{message}</Text> : null}

      <Pressable
        className="mt-lg items-center rounded-md bg-brand-600 px-md py-sm active:opacity-80"
        onPress={handleSubmit}
        disabled={submitting}
        accessibilityRole="button"
        accessibilityLabel="Create account"
      >
        {submitting ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text className="text-body font-semibold text-white">Create account</Text>
        )}
      </Pressable>

      <Link href="/login" className="mt-lg text-body text-brand-600">
        Already have an account? Sign in
      </Link>
    </View>
  );
}
