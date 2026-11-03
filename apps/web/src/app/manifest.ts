import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  return {
    id: `${basePath}/`,
    name: 'Assets Management & Auditing Platform',
    short_name: 'Assets PWA',
    description: 'Enterprise mobile-first asset management, auditing, and SAP sync PWA',
    start_url: `${basePath}/`,
    scope: `${basePath}/`,
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#2563eb',
    orientation: 'portrait-primary',
    icons: [
      {
        src: `${basePath}/icons/icon-192x192.png`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${basePath}/icons/icon-192x192.png`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: `${basePath}/icons/icon-512x512.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${basePath}/icons/icon-512x512.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'Scan QR / Barcode',
        short_name: 'Scan',
        description: 'Scan and audit physical assets',
        url: `${basePath}/scan`,
      },
      {
        name: 'Asset Inventory',
        short_name: 'Assets',
        description: 'View assets inventory',
        url: `${basePath}/assets`,
      },
      {
        name: 'Location Hierarchy',
        short_name: 'Locations',
        description: 'Company > Unit > Block > Line',
        url: `${basePath}/locations`,
      },
      {
        name: 'Audit Sessions',
        short_name: 'Audits',
        description: 'Audit plans and floor walk sessions',
        url: `${basePath}/audits`,
      },
    ],
  };
}
