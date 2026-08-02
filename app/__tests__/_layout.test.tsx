/**
 * Regression test for the white-screen deadlock (issue #38).
 *
 * `useSegments()` returns [] until the navigator mounts. If the layout returns
 * null while waiting to redirect, the navigator never mounts, segments never
 * populate, and the redirect never fires. The app sits on a white screen with
 * no error.
 *
 * The load-bearing assertion is that the navigator mounts when no user is
 * signed in and segments are still empty. That is the exact state a cold start
 * begins in, and nothing else in the suite covers it.
 *
 * The expo-router mock renders no elements: NativeWind's babel plugin rewrites
 * element creation to reference a module-scoped helper, which jest forbids
 * inside a mock factory. Spying on the Stack render is a better assertion
 * regardless, since "the navigator mounted" is what actually matters.
 */

import TestRenderer, { act } from 'react-test-renderer';

const mockStackRender = jest.fn(() => null);
const mockReplace = jest.fn();
const mockState: { segments: string[]; user: unknown; isLoading: boolean } = {
  segments: [],
  user: null,
  isLoading: false,
};

// The layout imports global styles for their side effect; nothing to load here.
jest.mock('../../global.css', () => ({}), { virtual: true });

jest.mock('@sentry/react-native', () => ({
  wrap: (component: unknown) => component,
}));

jest.mock('../../lib/monitoring/sentry', () => ({ initSentry: jest.fn() }));

// The provider is exercised in its own suite; here it only has to pass through.
jest.mock('../../lib/auth/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: unknown }) => children,
}));

jest.mock('../../lib/auth/useAuth', () => ({
  useAuth: () => ({ user: mockState.user, isLoading: mockState.isLoading }),
}));

jest.mock('expo-router', () => {
  function Stack() {
    return mockStackRender();
  }
  function Screen() {
    return null;
  }
  Stack.Screen = Screen;
  return {
    Stack,
    useRouter: () => ({ replace: mockReplace }),
    useSegments: () => mockState.segments,
  };
});

// Imported after the mocks so the module graph resolves against them.
// eslint-disable-next-line import/first
import RootLayout from '../_layout';

function render(): void {
  act(() => {
    TestRenderer.create(<RootLayout />);
  });
}

beforeEach(() => {
  mockStackRender.mockClear();
  mockReplace.mockReset();
  mockState.segments = [];
  mockState.user = null;
  mockState.isLoading = false;
});

describe('root layout', () => {
  it('mounts the navigator on a cold start with no user and no segments', () => {
    // The deadlock: if this render is skipped, segments never populate, so the
    // redirect below can never fire and the app shows a white screen.
    render();
    expect(mockStackRender).toHaveBeenCalled();
  });

  it('redirects an unauthenticated cold start to login', () => {
    render();
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });

  it('renders nothing while auth is still resolving', () => {
    mockState.isLoading = true;
    render();
    expect(mockStackRender).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('leaves an unauthenticated user alone once they are on an auth screen', () => {
    mockState.segments = ['(auth)'];
    render();
    expect(mockStackRender).toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('sends a signed-in user out of the auth group', () => {
    mockState.user = { uid: 'u1' };
    mockState.segments = ['(auth)'];
    render();
    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('leaves a signed-in user alone inside the app group', () => {
    mockState.user = { uid: 'u1' };
    mockState.segments = ['(app)'];
    render();
    expect(mockStackRender).toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
