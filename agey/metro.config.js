const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// .tflite モデルをアセットとしてバンドル
config.resolver.assetExts = [...config.resolver.assetExts, 'tflite'];

module.exports = withNativeWind(config, { input: './global.css' });
