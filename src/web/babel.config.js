// babel.config.js
// Babel configuration for React Native Mint Clone app
// Configures JavaScript/TypeScript transpilation with required plugins

// metro-react-native-babel-preset v0.76.5 - React Native specific Babel preset
// @babel/plugin-proposal-decorators v7.22.0 - Decorator support for TypeScript/MobX
// @babel/plugin-transform-runtime v7.22.0 - Runtime optimization helpers
// react-native-reanimated v3.3.0 - Animation support
// babel-plugin-transform-remove-console v6.9.4 - Console removal in production

module.exports = function(api) {
  api.cache(true);

  return {
    // Base preset for React Native
    presets: ['module:metro-react-native-babel-preset'],

    // Required plugins for functionality
    plugins: [
      // Animation support for React Native
      'react-native-reanimated/plugin',

      // TypeScript/MobX decorator support
      ['@babel/plugin-proposal-decorators', {
        legacy: true
      }],

      // Runtime optimization
      ['@babel/plugin-transform-runtime', {
        helpers: true
      }]
    ],

    // Environment-specific settings
    env: {
      production: {
        plugins: [
          // Remove console.* statements in production
          'transform-remove-console'
        ]
      }
    }
  };
};