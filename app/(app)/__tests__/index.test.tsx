import { render, screen } from '@testing-library/react-native';

import { APP_NAME, APP_VERSION } from '../../../constants/app';
import HomeScreen from '../index';

describe('HomeScreen', () => {
  it('renders the app name and version', () => {
    render(<HomeScreen />);

    expect(screen.getByText(APP_NAME)).toBeOnTheScreen();
    expect(screen.getByText(`v${APP_VERSION}`)).toBeOnTheScreen();
  });
});
