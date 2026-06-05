// `getReactNativePersistence` ships in Firebase's React Native bundle (resolved
// by Metro via the `react-native` export condition) but is omitted from the
// `firebase/auth` package's published TypeScript types. Re-declare it here so
// native code that wires up AsyncStorage persistence type-checks cleanly.
import 'firebase/auth';

declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
  }): import('firebase/auth').Persistence;
}
