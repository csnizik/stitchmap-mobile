// Global Jest setup, loaded via `setupFilesAfterEnv` in jest.config.js after
// the test framework is installed but before each test file runs.
//
// Importing React Native Testing Library here registers its built-in Jest
// matchers (`toBeOnTheScreen`, `toHaveTextContent`, `toBeVisible`, …) against
// the global `expect`, so every test suite can use them without importing the
// extend-expect entrypoint itself.
import '@testing-library/react-native';

// Default to the `test` environment for any code that branches on NODE_ENV.
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
