// ESLint flat config for the Expo + TypeScript + React Native app.
// https://docs.expo.dev/guides/using-eslint/
const expoConfig = require('eslint-config-expo/flat');
const eslintConfigPrettier = require('eslint-config-prettier');

module.exports = [
  ...expoConfig,
  eslintConfigPrettier,
  {
    ignores: ['dist/**', 'node_modules/**', '.expo/**'],
  }
];
