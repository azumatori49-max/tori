const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// .onnx を Metro バンドラがアセットとして認識するように追加。
// これがないと require('./assets/models/genderage.onnx') が失敗する。
config.resolver.assetExts.push('onnx');

module.exports = withNativeWind(config, { input: './global.css' });
