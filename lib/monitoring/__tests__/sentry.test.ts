jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  wrap: jest.fn(<T>(component: T) => component),
}));

describe('initSentry', () => {
  const ORIGINAL_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

  afterEach(() => {
    if (ORIGINAL_DSN === undefined) {
      delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    } else {
      process.env.EXPO_PUBLIC_SENTRY_DSN = ORIGINAL_DSN;
    }
  });

  it('does not initialize Sentry when no DSN is configured', () => {
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Sentry = require('@sentry/react-native');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { initSentry } = require('../sentry');

      expect(initSentry()).toBe(false);
      expect(Sentry.init).not.toHaveBeenCalled();
    });
  });

  it('treats an empty DSN as not configured', () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = '';

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Sentry = require('@sentry/react-native');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { initSentry } = require('../sentry');

      expect(initSentry()).toBe(false);
      expect(Sentry.init).not.toHaveBeenCalled();
    });
  });

  it('initializes Sentry with the DSN when one is configured', () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://public@example.ingest.sentry.io/1';

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Sentry = require('@sentry/react-native');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { initSentry } = require('../sentry');

      expect(initSentry()).toBe(true);
      expect(Sentry.init).toHaveBeenCalledTimes(1);
      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: 'https://public@example.ingest.sentry.io/1',
        }),
      );
    });
  });

  it('only initializes Sentry once across repeated calls', () => {
    process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://public@example.ingest.sentry.io/1';

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Sentry = require('@sentry/react-native');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { initSentry } = require('../sentry');

      expect(initSentry()).toBe(true);
      expect(initSentry()).toBe(true);
      expect(Sentry.init).toHaveBeenCalledTimes(1);
    });
  });
});
