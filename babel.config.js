module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }]],
    // react-native-worklets/plugin must be listed last.
    plugins: ['nativewind/babel','react-native-worklets/plugin'],
  };
};
