/**
 * Monorepo fix for expo-router + babel-preset-expo hoisting.
 *
 * In this npm-workspaces monorepo, `babel-preset-expo` is hoisted to the repo
 * root (`node_modules/babel-preset-expo`) while `expo-router` is installed
 * under `apps/mobile/node_modules/expo-router`. The preset only registers its
 * expo-router plugin when it can `require.resolve('expo-router')` from its OWN
 * location, which fails across the hoist boundary. Without that plugin,
 * `process.env.EXPO_ROUTER_APP_ROOT` is never inlined into a string literal and
 * Metro throws:
 *   "First argument of `require.context` should be a string".
 *
 * The plugin itself resolves the app root via `resolve-from(projectRoot, ...)`
 * where projectRoot is this app's directory, so registering it explicitly here
 * works regardless of where the packages end up hoisted.
 */
const { expoRouterBabelPlugin } = require('babel-preset-expo/build/expo-router-plugin');

module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Must run so expo-router's require.context gets a literal app root.
      expoRouterBabelPlugin,
      // react-native-reanimated/plugin MUST be listed last.
      'react-native-reanimated/plugin',
    ],
  };
};
