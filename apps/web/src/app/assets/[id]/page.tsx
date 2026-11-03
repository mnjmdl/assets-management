'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import {
  ArrowLeft,
  Network,
  QrCode,
  Calendar,
  DollarSign,
  ShieldCheck,
  Wrench,
  Clock,
  User,
  Share2,
  Printer,
  Loader2,
  AlertCircle,
  Layers,
  FileSpreadsheet,
  Download,
  ExternalLink,
  ArrowLeftRight,
  Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { createPlacardPng } from '@/lib/qr-placard';
import { EditAssetModal } from '@/components/assets/edit-asset-modal';

interface LocationNode {
  id: string;
  name: string;
  code: string;
  type: string;
  parent?: LocationNode | null;
}

interface AssetDetail {
  id: string;
  name: string;
  assetCode: string;
  sapAssetCode: string;
  description?: string;
  status: string;
  category?: { id: string; name: string; code: string };
  location?: LocationNode;
  department?: { id: string; name: string };
  vendor?: { id: string; name: string };
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  condition?: string;
  purchaseDate?: string;
  purchaseCost?: number | string;
  currentValue?: number | string;
  depreciationMethod?: string;
  usefulLifeYears?: number;
  warrantyExpiry?: string;
  qrCode?: string;
  createdAt: string;
  updatedAt: string;
  assignments?: Array<{
    id: string;
    assignedToUser?: { name: string; email: string };
    assignedToDept?: { name: string };
    assignedAt: string;
  }>;
}

export default function AssetDetailPage({ params }: { params: { id: string } }) {
  const [asset, setAsset] = useState<AssetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [downloadPlacardUrl, setDownloadPlacardUrl] = useState<string>('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Generate a real scannable QR Code and complete downloadable placard PNG
  useEffect(() => {
    let isCancelled = false;
    const qrPayload = asset?.sapAssetCode || asset?.assetCode;
    if (qrPayload) {
      QRCode.toDataURL(qrPayload, {
        width: 400,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then(async (rawUrl) => {
          if (isCancelled) return;
          setQrDataUrl(rawUrl);
          if (asset) {
            const placard = await createPlacardPng({
              qrDataUrl: rawUrl,
              titleCode: asset.assetCode,
              subtitle: asset.sapAssetCode ? `SAP: ${asset.sapAssetCode}` : undefined,
            });
            if (!isCancelled) setDownloadPlacardUrl(placard);
          }
        })
        .catch((err) => console.error('Failed to generate QR:', err));
    } else {
      setQrDataUrl('');
      setDownloadPlacardUrl('');
    }

    return () => {
      isCancelled = true;
    };
  }, [asset?.sapAssetCode, asset?.assetCode, asset?.id]);

  const fetchAsset = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/assets/${encodeURIComponent(params.id)}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(
          errJson.message ||
            (res.status === 404
              ? `Asset '${params.id}' not found in database.`
              : 'Failed to load asset details from backend.'),
        );
      }
      const json = await res.json();
      // Crucial fix: Unpack json.data from NestJS TransformInterceptor wrapper
      const item = json?.data !== undefined ? json.data : json;
      if (!item || (!item.id && !item.assetCode)) {
        throw new Error('Received empty or invalid asset data.');
      }
      setAsset(item);
    } catch (err: any) {
      setError(err.message || 'Error loading asset.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAsset();
  }, [params.id]);

  const formatCost = (val?: number | string | null) => {
    if (val === null || val === undefined || val === '') return '—';
    const num = Number(val);
    if (isNaN(num)) return '—';
    return `BDT ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (val?: string | null) => {
    if (!val) return '—';
    const d = new Date(val);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const buildLocationHierarchy = (loc?: LocationNode | null): string[] => {
    if (!loc) return ['Apex ABL Manufacturing'];
    const chain: string[] = [];
    let curr: LocationNode | null | undefined = loc;
    while (curr) {
      chain.unshift(`${curr.name} (${curr.code})`);
      curr = curr.parent;
    }
    return chain;
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
        <p className="text-sm text-muted-foreground">Loading asset details from database...</p>
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="max-w-md mx-auto py-12 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold">Unable to Load Asset</h2>
          <p className="text-xs text-muted-foreground">{error || `No asset found with ID ${params.id}`}</p>
        </div>
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={fetchAsset}>
            Retry
          </Button>
          <Link href="/assets">
            <Button size="sm">
              Back to Assets
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const assignedCustody =
    asset.assignments && asset.assignments.length > 0 ? asset.assignments[0] : null;
  const locationChain = buildLocationHierarchy(asset.location);

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-10">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link href="/assets">
          <Button variant="ghost" size="sm" className="gap-1.5 -ml-2">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Assets</span>
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditModalOpen(true)}
            className="gap-1.5 text-xs border-primary/30 text-foreground hover:bg-muted"
          >
            <Pencil className="w-3.5 h-3.5 text-primary" />
            <span>Edit Asset</span>
          </Button>
          <Link href={`/transfers?assetId=${asset.id}&code=${asset.assetCode}`}>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs border-blue-200 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-blue-600" />
              <span>Transfer Asset</span>
            </Button>
          </Link>
          <Link href={`/maintenance?assetId=${asset.id}&code=${asset.assetCode}`}>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
              title="Schedule maintenance or repair for this equipment"
            >
              <Wrench className="w-3.5 h-3.5 text-amber-600" />
              <span>Maintenance</span>
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="gap-1.5 text-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Tag</span>
          </Button>
          <Link href={`/scan?code=${asset.assetCode}`}>
            <Button size="sm" className="gap-1.5 text-xs shadow-sm">
              <QrCode className="w-3.5 h-3.5" />
              <span>Verify / Audit</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Asset Header Card */}
      <Card className="border-primary/20">
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    asset.status === 'ACTIVE'
                      ? 'default'
                      : asset.status === 'IN_MAINTENANCE'
                      ? 'destructive'
                      : 'secondary'
                  }
                  className="gap-1"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{asset.status}</span>
                </Badge>
                {asset.category && (
                  <Badge variant="outline" className="text-xs">
                    {asset.category.name} ({asset.category.code})
                  </Badge>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{asset.name}</h1>
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <span className="font-mono text-sm font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-md">
                  Tag: {asset.assetCode}
                </span>
                {asset.sapAssetCode && (
                  <span className="font-mono text-sm font-semibold bg-secondary px-2.5 py-1 rounded-md border">
                    SAP No: {asset.sapAssetCode}
                  </span>
                )}
              </div>
            </div>

            {/* Printable & Scannable Real QR Code Placard */}
            <div className="print-area shrink-0">
              <div className="print-tag-box flex flex-col items-center gap-2 p-3 bg-white dark:bg-slate-900 border-2 border-primary/20 rounded-xl shadow-xs text-center">
                <div className="w-28 h-28 sm:w-32 sm:h-32 bg-white rounded-lg flex items-center justify-center p-1.5 border">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt={`Scannable QR Code for ${asset.assetCode}`}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-0.5">
                  {/* Visible QR Code Text shows Tagging ID */}
                  <span className="text-[12px] font-mono font-bold text-foreground block">
                    {asset.assetCode}
                  </span>
                  {asset.sapAssetCode && (
                    <span className="text-[10px] font-mono text-muted-foreground block font-semibold">
                      SAP: {asset.sapAssetCode}
                    </span>
                  )}
                </div>
                {qrDataUrl && (
                  <div className="flex items-center gap-2 pt-0.5 no-print">
                    <a
                      href={downloadPlacardUrl || qrDataUrl}
                      download={`TAG-${asset.assetCode}.png`}
                      className="text-[11px] text-primary hover:underline font-medium inline-flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download</span>
                    </a>
                    <span className="text-muted-foreground text-xs">•</span>
                    <Link
                      href={`/scan?code=${encodeURIComponent(asset.sapAssetCode || asset.assetCode)}`}
                      className="text-[11px] text-primary hover:underline font-medium inline-flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Test Scan</span>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Location Hierarchy Box */}
          <div className="p-3.5 rounded-xl bg-muted/30 border space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Enterprise Location Hierarchy (Company &gt; Unit &gt; Block &gt; Line)
            </span>
            <div className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm font-semibold text-foreground">
              <Network className="w-4 h-4 text-primary flex-shrink-0" />
              {locationChain.map((step, idx) => (
                <span key={idx} className="flex items-center gap-1.5">
                  {idx > 0 && <span className="text-muted-foreground font-normal text-xs">&gt;</span>}
                  <span>{step}</span>
                </span>
              ))}
              {asset.location?.type && (
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 ml-1">
                  {asset.location.type}
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground pt-1 flex items-center gap-1.5">
              <span>Stationed Line Code:</span>
              <strong className="text-foreground font-mono">
                {asset.location?.code || 'ABL-CORP'}
              </strong>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid Information Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Specifications & Classification */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              Asset Classification & Tags
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-2 text-xs">
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground">Category Name</span>
              <span className="font-semibold">{asset.category?.name || 'General Equipment'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground">Category Code</span>
              <span className="font-mono">{asset.category?.code || '—'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground">SAP Asset Number</span>
              <span className="font-mono font-bold text-primary">{asset.sapAssetCode || '—'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground">Physical Tagging ID</span>
              <span className="font-mono font-bold text-foreground">{asset.assetCode}</span>
            </div>
            {asset.serialNumber && (
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground">Serial Number</span>
                <span className="font-mono">{asset.serialNumber}</span>
              </div>
            )}
            {asset.model && (
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground">Model</span>
                <span>{asset.model}</span>
              </div>
            )}
            {asset.manufacturer && (
              <div className="flex justify-between py-1.5 border-b">
                <span className="text-muted-foreground">Manufacturer</span>
                <span>{asset.manufacturer}</span>
              </div>
            )}
            <div className="flex justify-between py-1.5">
              <span className="text-muted-foreground">Assigned Custody</span>
              <span className="font-medium">
                {assignedCustody
                  ? assignedCustody.assignedToUser?.name || assignedCustody.assignedToDept?.name || 'Assigned'
                  : 'Unassigned (General Plant Custody)'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Financial & Capitalization */}
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary" />
              Financial & Capitalization
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-2 text-xs">
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground">Original Purchase Cost</span>
              <strong className="text-foreground">{formatCost(asset.purchaseCost)}</strong>
            </div>
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground">Current Book Value</span>
              <strong className="text-emerald-600 dark:text-emerald-400">
                {formatCost(asset.currentValue || asset.purchaseCost)}
              </strong>
            </div>
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground">Capitalization Date</span>
              <span className="font-medium">{formatDate(asset.purchaseDate)}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b">
              <span className="text-muted-foreground">Depreciation Method</span>
              <span className="font-medium">{asset.depreciationMethod || 'STRAIGHT_LINE'}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-muted-foreground">Record Created</span>
              <span className="font-medium">{formatDate(asset.createdAt)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Audit Readiness Banner */}
      <Card className="border-border/60 bg-muted/20">
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-full bg-primary/10 text-primary">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold block text-foreground">
                Active Registry Record
              </span>
              <span className="text-[11px] text-muted-foreground">
                Internal Database ID: <code className="font-mono text-[10px]">{asset.id}</code>
              </span>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            Audit Ready
          </Badge>
        </CardContent>
      </Card>

      {/* Edit Asset Modal */}
      <EditAssetModal
        asset={asset as any}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={(updated) => {
          setAsset((prev) => ({ ...prev, ...(updated as any) }));
          fetchAsset();
        }}
      />
    </div>
  );
}
