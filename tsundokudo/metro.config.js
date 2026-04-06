const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Web 環境ではネイティブ専用モジュールを空モックに差し替え
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    // react-native-worklets は Web 非対応 → スタブシムに差し替え
    if (moduleName === 'react-native-worklets') {
      return {
        type: 'sourceFile',
        filePath: path.resolve(__dirname, 'lib/worklets-web-shim.js'),
      };
    }
    if (moduleName === 'react-native-worklets/package.json') {
      // Reanimated が version を読むので、実際の package.json を返す
      const realPkg = path.resolve(__dirname, 'node_modules/react-native-worklets/package.json');
      try {
        require('fs').accessSync(realPkg);
        return { type: 'sourceFile', filePath: realPkg };
      } catch {
        return {
          type: 'sourceFile',
          filePath: path.resolve(__dirname, 'lib/worklets-pkg.json'),
        };
      }
    }
    if (moduleName.startsWith('react-native-worklets/')) {
      return {
        type: 'sourceFile',
        filePath: path.resolve(__dirname, 'lib/emptyModule.js'),
      };
    }
    // @shopify/flash-list は Web 非対応 → FlatList シムに差し替え
    if (moduleName === '@shopify/flash-list') {
      return {
        type: 'sourceFile',
        filePath: path.resolve(__dirname, 'lib/flashlist-web-shim.tsx'),
      };
    }
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
