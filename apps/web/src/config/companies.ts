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
      process.env.NEXT_PUBLIC_CMBD_API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'http://192.168.65.50:3001/api/v1',
    description: 'CMBD Factory Production Server',
  },
  {
    id: 'cetbd',
    name: 'CETBD  (CETBD)',
    code: 'CETBD',
    url:
      process.env.NEXT_PUBLIC_CETBD_API_URL ||
      'http://192.168.65.50:3003/api/v1',
    description: 'CETBD Factory Operations Server',
  },
  {
    id: 'abl',
    name: 'Crystal / ABL (ABL)',
    code: 'ABL',
    url:
      process.env.NEXT_PUBLIC_ABL_API_URL ||
      'http://192.168.45.51:3004/api/v1',
    description: 'ABL Factory Operations Server',
  },
];

export const DEFAULT_COMPANY_PRESET = COMPANY_API_PRESETS[0];

export function normalizeApiUrl(rawUrl: string): string {
  let url = (rawUrl || '').trim().replace(/\/+$/, '');
  if (!url) return DEFAULT_COMPANY_PRESET.url;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `http://${url}`;
  }
  if (!url.endsWith('/api/v1')) {
    url = `${url}/api/v1`;
  }
  return url;
}

export function getCompanyPreset(codeOrUrl?: string, code?: string): CompanyApiPreset | undefined {
  if (!codeOrUrl && !code) return undefined;

  if (code) {
    const exact = COMPANY_API_PRESETS.find(
      (p) => p.code.toUpperCase() === code.trim().toUpperCase()
    );
    if (exact) return exact;
  }

  if (codeOrUrl) {
    const byCode = COMPANY_API_PRESETS.find(
      (p) => p.code.toUpperCase() === codeOrUrl.trim().toUpperCase()
    );
    if (byCode) return byCode;

    const normUrl = normalizeApiUrl(codeOrUrl).toLowerCase();
    return COMPANY_API_PRESETS.find(
      (p) => normalizeApiUrl(p.url).toLowerCase() === normUrl
    );
  }

  return undefined;
}
