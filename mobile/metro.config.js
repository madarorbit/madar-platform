/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// The official MADAR identity assets live in the platform's public directory.
// Expo's project root is /mobile, so Metro must explicitly watch the repo root.
config.watchFolders = [path.resolve(__dirname, '..')];

module.exports = config;
