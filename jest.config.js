// Jest configuration using the Expo preset so tests run against the same
// Babel/transform pipeline as the app. This wires up the full test harness:
// the jest-expo preset, React Native Testing Library matchers (via the
// setup file), coverage collection, and ESM transforms for zustand/immer.
const expoPreset = require('jest-expo/jest-preset');

// `zustand`, `immer`, the `firebase`/`@firebase` packages, and
// `@shopify/react-native-skia` all ship ESM that must be transformed by Babel;
// add them to the Expo preset's first (allow-list) transformIgnorePattern so
// Jest does not skip them as untransformed node_modules.
const [allowList, ...restPatterns] = expoPreset.transformIgnorePatterns;
const transformIgnorePatterns = [
  allowList.replace(
    'native-base',
    'native-base|zustand|immer|firebase|@firebase|@shopify/react-native-skia',
  ),
  ...restPatterns,
];

// Some `@firebase/*` packages ship `.mjs` ESM files (e.g. util's postinstall
// helper). The Expo preset only transforms `.[jt]sx?`, so register the same
// Babel transform for `.mjs` (Jest already resolves the `.mjs` extension).
const babelTransform = expoPreset.transform['\\.[jt]sx?$'];
const transform = {
  ...expoPreset.transform,
  '^.+\\.mjs$': babelTransform,
};

module.exports = {
  ...expoPreset,
  transform,
  transformIgnorePatterns,
  // The Skia setup mocks the native module; without it, importing Skia in a
  // test throws because JSI bindings cannot install outside a real runtime.
  setupFilesAfterEnv: [
    ...(expoPreset.setupFilesAfterEnv ?? []),
    '@shopify/react-native-skia/jestSetup.js',
    '<rootDir>/jest.setup.js',
  ],
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    '!**/__tests__/**',
    '!**/*.d.ts',
  ],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/firestore-tests/'],
  testEnvironment: '@shopify/react-native-skia/jestEnv.js',
};
