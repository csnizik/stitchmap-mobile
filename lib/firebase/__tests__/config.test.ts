import { isFirebaseConfigured, REQUIRED_FIREBASE_CONFIG_KEYS } from '../config';

const fullConfig = {
  apiKey: 'key',
  authDomain: 'app.firebaseapp.com',
  projectId: 'app',
  storageBucket: 'app.appspot.com',
  messagingSenderId: '123',
  appId: '1:123:web:abc',
};

describe('isFirebaseConfigured', () => {
  it('returns true when every required key has a value', () => {
    expect(isFirebaseConfigured(fullConfig)).toBe(true);
  });

  it('returns false when a required key is missing', () => {
    for (const key of REQUIRED_FIREBASE_CONFIG_KEYS) {
      const config = { ...fullConfig, [key]: undefined };
      expect(isFirebaseConfigured(config)).toBe(false);
    }
  });

  it('returns false when a required key is an empty string', () => {
    expect(isFirebaseConfigured({ ...fullConfig, apiKey: '' })).toBe(false);
  });

  it('ignores optional keys (storageBucket, messagingSenderId)', () => {
    const config = {
      ...fullConfig,
      storageBucket: undefined,
      messagingSenderId: undefined,
    };
    expect(isFirebaseConfigured(config)).toBe(true);
  });
});
