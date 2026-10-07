const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const coresRoot = path.resolve(projectRoot, 'ranobelib-epub/src/cores');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// The source cores stay in ranobelib-epub. Metro has to watch that folder
// and resolve their packages (fflate, node-html-parser) from this app.
config.watchFolders = [...new Set([...(config.watchFolders ?? []), coresRoot])];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];
config.resolver.disableHierarchicalLookup = true;

const fflateBrowser = path.resolve(projectRoot, 'node_modules/fflate/esm/browser.js');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'fflate') {
    return { type: 'sourceFile', filePath: fflateBrowser };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
