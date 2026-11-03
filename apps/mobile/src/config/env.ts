export const DEFAULT_PRODUCTION_API_URL =
  process.env.EXPO_PUBLIC_API_URL || 'https://app.bd.crystal-martin.com/assets/api/v1';

export const DEFAULT_LOCAL_API_URL =
  process.env.EXPO_PUBLIC_LOCAL_API_URL || 'http://localhost:3001/api/v1';

export const INITIAL_API_URL =
  typeof __DEV__ !== 'undefined' && __DEV__
    ? DEFAULT_LOCAL_API_URL
    : DEFAULT_PRODUCTION_API_URL;

export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'cm_access_token',
  REFRESH_TOKEN: 'cm_refresh_token',
  CACHED_USER: 'cm_cached_user',
  SERVER_URL: 'cm_server_url',
  OFFLINE_CREDENTIALS: 'cm_offline_credentials',
} as const;

