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
    id: 'cetbd',
    name: 'CETBD Enterprise (CETBD)',
    code: 'CETBD',
    url:
      process.env.EXPO_PUBLIC_CETBD_API_URL ||
      'http://192.168.65.50:3001/api/v1',
    description: 'CETBD Factory Operations Server',
  },
  {
    id: 'abl',
    name: 'Crystal / ABL Group (ABL)',
    code: 'ABL',
    url:
      process.env.EXPO_PUBLIC_ABL_API_URL ||
      'http://192.168.45.51:3001/api/v1',
    description: 'ABL Factory Operations Server',
  },
];

export const getCompanyPresetForUrl = (url: string, code?: string): CompanyApiPreset | undefined => {
  const norm = (url || '').trim().replace(/\/+$/, '').toLowerCase();
  if (code) {
    const exact = COMPANY_API_PRESETS.find(
      (p) =>
        p.code.toLowerCase() === code.trim().toLowerCase() &&
        p.url.trim().replace(/\/+$/, '').toLowerCase() === norm
    );
    if (exact) return exact;
    const byCode = COMPANY_API_PRESETS.find(
      (p) => p.code.toLowerCase() === code.trim().toLowerCase()
    );
    if (byCode) return byCode;
  }
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
  LAST_ACTIVE_COMPANY: 'cm_last_active_company',
  OFFLINE_CREDENTIALS: 'cm_offline_credentials',
} as const;

