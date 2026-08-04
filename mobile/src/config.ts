export const config = {
  apiBase: (process.env.EXPO_PUBLIC_MADAR_API_URL || 'https://www.orbitmadar.com').replace(/\/$/, ''),
  releaseChannel: process.env.EXPO_PUBLIC_RELEASE_CHANNEL || 'development',
};
