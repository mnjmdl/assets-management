export interface CompanyApiPreset {
  id: string;
  name: string;
  code: string;
  url: string;
  description: string;
}

export const COMPANY_API_PRESETS: CompanyApiPreset[] = [
  {
    id: 'cmbd',
    name: 'Crystal Martin (CMBD)',
    code: 'CMBD',
    url:
      process.env.EXPO_PUBLIC_CMBD_API_URL ||
      process.env.EXPO_PUBLIC_API_URL ||
      'http://192.168.65.50:3001/api/v1',
    description: 'CMBD Factory Production Server',
  },
  {
    id: 'abl',
    name: 'Apex / ABL Group (ABL)',
    code: 'ABL',
    url:
      process.env.EXPO_PUBLIC_ABL_API_URL ||
      'http://192.168.45.51:3001/api/v1',
    description: 'ABL Factory Operations Server',
  },
  {
    id: 'dev',
    name: 'Local Dev / Testing',
    code: 'DEV',
    url:
      process.env.EXPO_PUBLIC_DEV_API_URL ||
      process.env.EXPO_PUBLIC_LOCAL_API_URL ||
      'http://localhost:3001/api/v1',
    description: 'Local Network or Development Server',
  },
];

export const getCompanyPresetForUrl = (url: string): CompanyApiPreset | undefined => {
  const norm = (url || '').trim().replace(/\/+$/, '').toLowerCase();
  return COMPANY_API_PRESETS.find(
    (p) => p.url.trim().replace(/\/+$/, '').toLowerCase() === norm
  );
};

export const DEFAULT_PRODUCTION_API_URL = COMPANY_API_PRESETS[0].url;
export const DEFAULT_LOCAL_API_URL = COMPANY_API_PRESETS[0].url;

export const INITIAL_API_URL =
  typeof __DEV__ !== 'undefined' && __DEV__
    ? (process.env.EXPO_PUBLIC_LOCAL_API_URL || COMPANY_API_PRESETS[0].url)
    : (process.env.EXPO_PUBLIC_API_URL || COMPANY_API_PRESETS[0].url);

export const DEFAULT_COMPANY_CODE = process.env.EXPO_PUBLIC_COMPANY_CODE || 'CMBD';

export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'cm_access_token',
  REFRESH_TOKEN: 'cm_refresh_token',
  CACHED_USER: 'cm_cached_user',
  SERVER_URL: 'cm_server_url',
  COMPANY_CODE: 'cm_company_code',
  OFFLINE_CREDENTIALS: 'cm_offline_credentials',
} as const;

