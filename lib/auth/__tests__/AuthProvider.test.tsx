import { FirebaseError } from 'firebase/app';
import { useEffect } from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { AuthProvider, type AuthContextValue } from '../AuthProvider';
import { useAuth } from '../useAuth';

// Stub the initialized Auth instance so importing the provider does not spin up
// a real Firebase app during the test run.
jest.mock('../../firebase/auth', () => ({ auth: { __mock: 'auth' } }));

const authListeners: ((user: unknown) => void)[] = [];
const mockSignIn = jest.fn();
const mockSignUp = jest.fn();
const mockSignOut = jest.fn();

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, callback: (user: unknown) => void) => {
    authListeners.push(callback);
    return () => {};
  },
  signInWithEmailAndPassword: (...args: unknown[]) => mockSignIn(...args),
  createUserWithEmailAndPassword: (...args: unknown[]) => mockSignUp(...args),
  signOut: (...args: unknown[]) => mockSignOut(...args),
}));

// Surfaces the live context value to the test via the `onChange` callback (run
// in an effect, so the mutation happens in test scope — not during render).
function Capture({ onChange }: { onChange: (value: AuthContextValue) => void }) {
  const auth = useAuth();
  useEffect(() => {
    onChange(auth);
  });
  return null;
}

const captured: { value: AuthContextValue | null } = { value: null };

function value(): AuthContextValue {
  if (captured.value === null) {
    throw new Error('Capture has not rendered yet.');
  }
  return captured.value;
}

function render() {
  let renderer: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <AuthProvider>
        <Capture
          onChange={(next) => {
            captured.value = next;
          }}
        />
      </AuthProvider>,
    );
  });
  return () => act(() => renderer.unmount());
}

beforeEach(() => {
  captured.value = null;
  authListeners.length = 0;
  mockSignIn.mockReset();
  mockSignUp.mockReset();
  mockSignOut.mockReset();
});

describe('AuthProvider', () => {
  it('starts loading until the first auth state resolves', () => {
    const cleanup = render();

    expect(value().isLoading).toBe(true);
    expect(value().user).toBeNull();

    act(() => authListeners[0](null));

    expect(value().isLoading).toBe(false);
    expect(value().user).toBeNull();

    cleanup();
  });

  it('exposes the signed-in user from onAuthStateChanged', () => {
    const cleanup = render();
    const user = { uid: 'u1', email: 'a@b.com' };

    act(() => authListeners[0](user));

    expect(value().user).toEqual(user);
    cleanup();
  });

  it('calls signInWithEmailAndPassword on signIn', async () => {
    mockSignIn.mockResolvedValueOnce({});
    const cleanup = render();

    await act(async () => {
      await value().signIn('a@b.com', 'secret');
    });

    expect(mockSignIn).toHaveBeenCalledWith({ __mock: 'auth' }, 'a@b.com', 'secret');
    expect(value().error).toBeNull();
    cleanup();
  });

  it('surfaces a friendly error message when sign in fails', async () => {
    mockSignIn.mockRejectedValueOnce(new FirebaseError('auth/invalid-credential', 'bad'));
    const cleanup = render();

    await act(async () => {
      await value().signIn('a@b.com', 'wrong');
    });

    expect(value().error).toBe('Incorrect email or password.');
    cleanup();
  });

  it('calls createUserWithEmailAndPassword on signUp', async () => {
    mockSignUp.mockResolvedValueOnce({});
    const cleanup = render();

    await act(async () => {
      await value().signUp('new@b.com', 'secret');
    });

    expect(mockSignUp).toHaveBeenCalledWith({ __mock: 'auth' }, 'new@b.com', 'secret');
    cleanup();
  });

  it('calls signOut on signOut', async () => {
    mockSignOut.mockResolvedValueOnce(undefined);
    const cleanup = render();

    await act(async () => {
      await value().signOut();
    });

    expect(mockSignOut).toHaveBeenCalledWith({ __mock: 'auth' });
    cleanup();
  });
});

describe('useAuth', () => {
  it('throws when used outside of an AuthProvider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      act(() => {
        TestRenderer.create(<Capture onChange={() => {}} />);
      }),
    ).toThrow('useAuth must be used within an <AuthProvider>.');
    spy.mockRestore();
  });
});
