import { render, screen } from '@testing-library/react-native';

import { APP_NAME, APP_VERSION } from '../../../constants/app';
import HomeScreen from '../index';

jest.mock('../../../lib/auth/useAuth', () => ({
  useAuth: () => ({
    user: null,
    isLoading: false,
    error: null,
    signIn: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
  }),
}));

describe('HomeScreen', () => {
  it('renders the app name and version', () => {
    render(<HomeScreen />);

    expect(screen.getByText(APP_NAME)).toBeOnTheScreen();
    expect(screen.getByText(`v${APP_VERSION}`)).toBeOnTheScreen();
  });
});
