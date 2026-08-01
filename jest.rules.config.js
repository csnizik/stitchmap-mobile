/**
 * Jest config for security rules tests only.
 *
 * These need the Firestore emulator running, so they are kept out of the main
 * `npm test` run and out of CI. Invoke via `npm run test:rules`, which starts
 * the emulator around them.
 */
module.exports = {
  displayName: 'rules',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/firestore-tests/**/*.test.ts'],
  transform: {
    '^.+\\.[jt]sx?$': ['babel-jest', { configFile: './babel.config.js' }],
  },
  testTimeout: 20000,
};
