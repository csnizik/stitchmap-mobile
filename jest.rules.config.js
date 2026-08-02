/**
 * Jest config for emulator tests only.
 *
 * These need the Firestore emulator running, so they are kept out of the main
 * `npm test` run and out of CI. Invoke via `npm run test:rules`, which starts
 * the emulator around them.
 *
 * maxWorkers is 1 because every suite here shares one emulator and calls
 * clearFirestore() between tests. Run in parallel, one suite wipes another
 * suite's data mid-test.
 */
module.exports = {
  displayName: 'rules',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/firestore-tests/**/*.test.ts'],
  transform: {
    '^.+\\.[jt]sx?$': ['babel-jest', { configFile: './babel.config.js' }],
  },
  testTimeout: 20000,
  maxWorkers: 1,
};
