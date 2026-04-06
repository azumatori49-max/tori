module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      // react-native-worklets babel plugin is required for Reanimated 4 worklets
      'react-native-worklets/plugin',
    ],
  };
};
