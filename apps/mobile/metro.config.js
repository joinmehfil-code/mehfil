// Metro config for a monorepo (npm workspaces) Expo app.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch all files in the monorepo.
config.watchFolders = [workspaceRoot];

// Resolve modules from both the app and the workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

/**
 * Force a single instance of react-native / react across the monorepo.
 *
 * `@expo/vector-icons` (a transitive dep of `expo`) declares `react-native` and
 * `react` as peer deps with a `*` range. npm auto-installs those peers at the
 * LATEST version (react-native 0.88.x / react 19) nested under
 * `node_modules/expo/node_modules`, which is incompatible with Expo SDK 51
 * (react-native 0.74.5) and crashes the Metro parser. npm `overrides` do not
 * reliably rewrite auto-installed peers, so we pin resolution here instead:
 * any import of react-native/react (including subpaths) always resolves to this
 * app's own copies.
 */
const forcedSingleInstance = {
  'react-native': path.resolve(projectRoot, 'node_modules/react-native'),
  react: path.resolve(projectRoot, 'node_modules/react'),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  for (const [name, dir] of Object.entries(forcedSingleInstance)) {
    if (moduleName === name || moduleName.startsWith(name + '/')) {
      const subPath = moduleName.slice(name.length); // '' or '/Libraries/...'
      const redirect = path.join(dir, subPath);
      return context.resolveRequest(context, redirect, platform);
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
