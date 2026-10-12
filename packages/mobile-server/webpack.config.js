// Proxy /api and /ws to server-core at 3000 so Expo web at 8081 can use same-origin fetch (expo for everything from browser POV)
// Browser sees only 8081, server-core runs hidden at 3000. Restart Expo: npx expo start --web --host lan --clear --port 8081
const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(
    {
      ...env,
      babel: { dangerouslyAddModulePathsToTranspile: ['@ui-kitten/components'] },
    },
    argv
  );
  // Ensure devServer proxy for API (fallback if Expo API files not served on web)
  if (!config.devServer) config.devServer = {};
  config.devServer.proxy = {
    ...(config.devServer.proxy || {}),
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true,
      secure: false,
      logLevel: 'silent',
    },
    '/ws': {
      target: 'ws://localhost:3000',
      ws: true,
      changeOrigin: true,
      logLevel: 'silent',
    },
  };
  return config;
};
