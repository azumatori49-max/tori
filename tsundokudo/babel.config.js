module.exports = function (api) {
  api.cache(true);

  const isWeb = process.env.EXPO_OS === 'web' || process.env.BABEL_ENV === 'web';

  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      // react-native-worklets babel plugin is required for Reanimated 4 worklets
      // Skip on web as worklets are native-only
      ...(!isWeb ? ['react-native-worklets/plugin'] : []),
    ],
  };
};
