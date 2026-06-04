// Jest configuration using the Expo preset so tests run against the same
// Babel/transform pipeline as the app. The full test harness (RNTL,
// coverage scripts, setup files) is expanded in Story 8; this provides the
// minimum needed to run the Story 6 example-store unit test.
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
};
