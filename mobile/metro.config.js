// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

module.exports = {
  ...config,
  watchFolders: [path.resolve(__dirname, '..')],
  resolver: {
    ...config.resolver,
    sourceExts: [...config.resolver.sourceExts, 'ts', 'tsx'],
  },
};
