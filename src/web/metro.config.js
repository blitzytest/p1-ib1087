const path = require('path');
const { getDefaultConfig } = require('@react-native/metro-config');

/**
 * Metro configuration for React Native
 * https://facebook.github.io/metro/docs/configuration
 * 
 * @type {import('metro-config').MetroConfig}
 */
const config = async () => {
  const defaultConfig = await getDefaultConfig(__dirname);

  return {
    ...defaultConfig,
    
    // Configure transformer settings
    transformer: {
      getTransformOptions: async () => ({
        transform: {
          experimentalImportSupport: false,
          inlineRequires: true,
        },
      }),
      babelTransformerPath: require.resolve('metro-babel-transformer'),
      assetPlugins: ['asset-resolver-plugin'],
    },

    // Configure resolver for module and asset resolution
    resolver: {
      sourceExts: ['js', 'jsx', 'ts', 'tsx', 'json'],
      assetExts: [
        'png', 'jpg', 'jpeg', 'gif', 'webp',
        'ttf', 'otf', 'svg',
        'mp4', 'wav', 'mp3'
      ],
      platforms: ['ios', 'android'],
      blockList: [
        /\.git\//,
        /\.hg\//,
        'node_modules/react-native/Libraries/Animated/AnimatedWeb.js',
        /__tests__/,
        /__mocks__/,
        /coverage/,
      ],
    },

    // Configure watched directories
    watchFolders: [
      path.resolve(__dirname, '..'), // Root project directory
      path.resolve(__dirname, '../shared'), // Shared components directory
      path.resolve(__dirname, '../assets'), // Assets directory
    ],

    // Configure performance settings
    maxWorkers: Math.max(require('os').cpus().length - 1, 1),

    // Configure development settings
    resetCache: true,
    
    // Configure reporting and source maps
    reporter: {
      type: 'default',
      useSourceMaps: true,
    },
  };
};

module.exports = config;