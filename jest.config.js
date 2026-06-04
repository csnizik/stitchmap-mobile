// Jest configuration using the Expo preset so tests run against the same
// Babel/transform pipeline as the app. This wires up the full test harness:
// the jest-expo preset, React Native Testing Library matchers (via the
// setup file), coverage collection, and ESM transforms for zustand/immer.
const expoPreset = require('jest-expo/jest-preset');

// `zustand` and `immer` ship ESM that must be transformed by Babel; add them
// to the Expo preset's first (allow-list) transformIgnorePattern so Jest does
// not skip them as untransformed node_modules.
const [allowList, ...restPatterns] = expoPreset.transformIgnorePatterns;
const transformIgnorePatterns = [
  allowList.replace('native-base', 'native-base|zustand|immer'),
  ...restPatterns,
];

module.exports = {
  ...expoPreset,
  transformIgnorePatterns,
  // Runs after the test framework is set up; registers React Native Testing
  // Library matchers and configures the global test environment.
  setupFilesAfterEnv: [...(expoPreset.setupFilesAfterEnv ?? []), '<rootDir>/jest.setup.js'],
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    '!**/__tests__/**',
    '!**/*.d.ts',
  ],
};
