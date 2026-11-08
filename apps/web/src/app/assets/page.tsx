'use client';

import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import QRCode from 'qrcode';
import {
  Search,
  Plus,
  QrCode,
  Network,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Boxes,
  Loader2,
  Printer,
  Download,
  FileDown,
  ExternalLink,
  X,
  CheckSquare,
  Square,
  ArrowLeftRight,
  Pencil,
  MapPin,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { createPlacardPng } from '@/lib/qr-placard';
import { EditAssetModal } from '@/components/assets/edit-asset-modal';

interface AssetRecord {
  id: string;
  name: string;
  assetCode: string;
  sapAssetCode: string;
  status: string;
  category?: { id: string; name: string };
  location?: { id: string; name: string };
  purchaseCost?: number | string | null;
  createdAt: string;
}

// In-memory cache for fast instant rendering across list
const qrCache = new Map<string, string>();

function AssetQrThumbnail({ code, className }: { code: string; className?: string }) {
  const [url, setUrl] = useState<string>(() => qrCache.get(code) || '');

  useEffect(() => {
    if (!code) return;
    if (qrCache.has(code)) {
      setUrl(qrCache.get(code)!);
      return;
    }

    let isCancelled = false;
    QRCode.toDataURL(code, {
      width: 180,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#0f172a', light: '#ffffff' },
    })
      .then((dataUrl) => {
        qrCache.set(code, dataUrl);
        if (!isCancelled) setUrl(dataUrl);
      })
      .catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, [code]);

  if (!url) {
    return (
      <div
        className={
          className ||
          'w-11 h-11 bg-muted/40 rounded-lg border flex items-center justify-center shrink-0'
        }
      >
        <QrCode className="w-4 h-4 text-muted-foreground animate-pulse" />
      </div>
    );
  }

  return (
    <div
      className={
        className ||
        'w-11 h-11 bg-white p-0.5 rounded-lg border shadow-2xs flex items-center justify-center shrink-0 hover:ring-2 hover:ring-primary/40 transition-all cursor-pointer'
      }
    >
      <img src={url} alt={`QR Code for ${code}`} className="w-full h-full object-contain" />
    </div>
  );
}

export default function AssetsPage() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedLocation, setSelectedLocation] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  // Load reference options (categories and locations)
  const { data: refData } = useSWR('/api/assets/reference-options');
  const categories: Array<{ id: string; name: string }> =
    refData?.data?.categories || refData?.categories || [];
  const locations: Array<{ id: string; name: string; code?: string; type?: string }> =
    refData?.data?.locations || refData?.locations || [];

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const queryString = useMemo(() => {
    const q = new URLSearchParams();
    if (debouncedSearch) q.append('search', debouncedSearch);
    if (selectedStatus !== 'ALL') q.append('status', selectedStatus);
    if (selectedCategory !== 'ALL') q.append('categoryId', selectedCategory);
    if (selectedLocation !== 'ALL') q.append('locationId', selectedLocation);
    q.append('page', String(page));
    q.append('limit', String(limit));
    return q.toString();
  }, [debouncedSearch, selectedStatus, selectedCategory, selectedLocation, page, limit]);

  const { data: assetsRes, isLoading, mutate: mutateAssets } = useSWR(`/api/assets?${queryString}`);

  const assets: AssetRecord[] = assetsRes?.data || [];
  const totalCount = assetsRes?.meta?.total ?? (assetsRes?.data ? assetsRes.data.length : 0);
  const totalPages = assetsRes?.meta?.totalPages ?? Math.max(1, Math.ceil(totalCount / limit));
  const loading = isLoading && !assetsRes;

  const hasActiveFilters =
    selectedCategory !== 'ALL' ||
    selectedLocation !== 'ALL' ||
    selectedStatus !== 'ALL' ||
    Boolean(search);

  const handleResetFilters = () => {
    setSearch('');
    setSelectedStatus('ALL');
    setSelectedCategory('ALL');
    setSelectedLocation('ALL');
    setPage(1);
  };

  // Enlarged QR Placard Modal
  const [selectedQrAsset, setSelectedQrAsset] = useState<AssetRecord | null>(null);
  const [modalQrUrl, setModalQrUrl] = useState<string>('');
  const [downloadPlacardUrl, setDownloadPlacardUrl] = useState<string>('');
  const [editingAsset, setEditingAsset] = useState<AssetRecord | null>(null);

  // Bulk Equipment Tag Printing State
  const [isBulkPrintOpen, setIsBulkPrintOpen] = useState(false);
  const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());
  const [bulkQrMap, setBulkQrMap] = useState<Record<string, string>>({});
  const [bulkGenerating, setBulkGenerating] = useState(false);

  const handleOpenBulkPrint = async () => {
    setIsBulkPrintOpen(true);
    const initialSelected = new Set(assets.map((a) => a.id));
    setBulkSelectedIds(initialSelected);
    setBulkGenerating(true);

    const newMap: Record<string, string> = { ...bulkQrMap };
    await Promise.all(
      assets.map(async (asset) => {
        if (newMap[asset.id]) return;
        const payload = asset.sapAssetCode || asset.assetCode;
        if (qrCache.has(payload)) {
          newMap[asset.id] = qrCache.get(payload)!;
          return;
        }
        try {
          const url = await QRCode.toDataURL(payload, {
            width: 240,
            margin: 1,
            errorCorrectionLevel: 'M',
            color: { dark: '#0f172a', light: '#ffffff' },
          });
          qrCache.set(payload, url);
          newMap[asset.id] = url;
        } catch (e) {
          console.error('Failed to generate QR for asset:', asset.assetCode, e);
        }
      }),
    );

    setBulkQrMap(newMap);
    setBulkGenerating(false);
  };

  const toggleSelectAllBulk = () => {
    if (bulkSelectedIds.size === assets.length) {
      setBulkSelectedIds(new Set());
    } else {
      setBulkSelectedIds(new Set(assets.map((a) => a.id)));
    }
  };

  const toggleAssetBulk = (id: string) => {
    setBulkSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Export Excel State & Handler
  const [isExporting, setIsExporting] = useState(false);

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const query = new URLSearchParams();
      if (search) query.append('search', search);
      if (selectedStatus !== 'ALL') query.append('status', selectedStatus);
      if (selectedCategory !== 'ALL') query.append('categoryId', selectedCategory);
      if (selectedLocation !== 'ALL') query.append('locationId', selectedLocation);

      const res = await fetch(`/api/assets/export-excel?${query.toString()}`);
      if (!res.ok) throw new Error('Failed to export Excel file');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Assets-Inventory-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Export error:', err);
      alert('Failed to export Excel file. Please ensure the backend server is running.');
    } finally {
      setIsExporting(false);
    }
  };

  const statuses = [
    { label: 'All', value: 'ALL' },
    { label: 'Active', value: 'ACTIVE' },
    { label: 'Maintenance', value: 'IN_MAINTENANCE' },
    { label: 'Assigned', value: 'ASSIGNED' },
    { label: 'Draft', value: 'DRAFT' },
  ];

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === page) return;
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | string)[] = [];
    if (page <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i);
      pages.push('...');
      pages.push(totalPages);
    } else if (page >= totalPages - 3) {
      pages.push(1);
      pages.push('...');
      for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      pages.push('...');
      pages.push(page - 1);
      pages.push(page);
      pages.push(page + 1);
      pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  // Generate large high-res QR code and complete printable placard for modal
  useEffect(() => {
    let isCancelled = false;
    if (selectedQrAsset) {
      const qrPayload = selectedQrAsset.sapAssetCode || selectedQrAsset.assetCode;
      QRCode.toDataURL(qrPayload, {
        width: 400,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: { dark: '#0f172a', light: '#ffffff' },
      })
        .then(async (rawUrl) => {
          if (isCancelled) return;
          setModalQrUrl(rawUrl);
          const placard = await createPlacardPng({
            qrDataUrl: rawUrl,
            titleCode: selectedQrAsset.assetCode,
            subtitle: selectedQrAsset.sapAssetCode ? `SAP: ${selectedQrAsset.sapAssetCode}` : undefined,
          });
          if (!isCancelled) setDownloadPlacardUrl(placard);
        })
        .catch(console.error);
    } else {
      setModalQrUrl('');
      setDownloadPlacardUrl('');
    }

    return () => {
      isCancelled = true;
    };
  }, [selectedQrAsset]);

  const formatCost = (val?: number | string | null) => {
    if (val === null || val === undefined || val === '') return '—';
    const num = Number(val);
    if (isNaN(num)) return '—';
    return `BDT ${num.toLocaleString()}`;
  };

  const startItem = totalCount === 0 ? 0 : (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, totalCount);

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Assets Inventory</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {loading
              ? 'Querying records...'
              : totalCount === 0
              ? 'No equipment items found'
              : `Showing ${startItem}–${endItem} of ${totalCount.toLocaleString()} equipment items tracked with scannable QR tags`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/assets/import">
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 shadow-2xs"
              title="Import Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            </Button>
          </Link>
          <Button
            variant="outline"
            size="icon"
            onClick={handleExportExcel}
            disabled={isExporting || totalCount === 0}
            className="h-10 w-10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 shadow-2xs"
            title="Export Excel (.xlsx)"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
            ) : (
              <FileDown className="w-4 h-4 text-emerald-600" />
            )}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={handleOpenBulkPrint}
            disabled={loading || assets.length === 0}
            className="h-10 w-10 border-primary/30 text-primary hover:bg-primary/10 shadow-2xs"
            title="Bulk Print Tags"
          >
            <Printer className="w-4 h-4" />
          </Button>
          <Link href="/scan">
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 shadow-2xs"
              title="Scan QR Code"
            >
              <QrCode className="w-4 h-4" />
            </Button>
          </Link>
          <Link href="/assets/new">
            <Button
              size="icon"
              className="h-10 w-10 shadow-sm"
              title="Register New Asset"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Search & Filters Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5">
        {/* Search Bar */}
        <div className="relative lg:col-span-6">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by equipment name, Tag ID (ABL-...), or SAP Code (1000...)"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-10 pr-9 h-11 bg-card text-xs sm:text-sm"
          />
          {search ? (
            <button
              onClick={() => {
                setSearch('');
                setPage(1);
              }}
              className="absolute right-3 top-3 text-muted-foreground hover:text-foreground p-0.5"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}
        </div>

        {/* Category Filter */}
        <div className="relative lg:col-span-3">
          <Boxes className="absolute left-3 top-3.5 w-4 h-4 text-muted-foreground pointer-events-none" />
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className={`w-full h-11 pl-9 pr-8 text-xs sm:text-sm font-medium bg-card border rounded-md shadow-2xs focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer transition-colors ${
              selectedCategory !== 'ALL'
                ? 'border-primary text-primary font-semibold'
                : 'text-foreground'
            }`}
          >
            <option value="ALL">All Categories ({categories.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-3.5 pointer-events-none text-muted-foreground text-[10px]">
            ▼
          </div>
        </div>

        {/* Location Filter */}
        <div className="relative lg:col-span-3">
          <MapPin className="absolute left-3 top-3.5 w-4 h-4 text-muted-foreground pointer-events-none" />
          <select
            value={selectedLocation}
            onChange={(e) => {
              setSelectedLocation(e.target.value);
              setPage(1);
            }}
            className={`w-full h-11 pl-9 pr-8 text-xs sm:text-sm font-medium bg-card border rounded-md shadow-2xs focus:outline-none focus:ring-2 focus:ring-primary/20 appearance-none cursor-pointer transition-colors ${
              selectedLocation !== 'ALL'
                ? 'border-primary text-primary font-semibold'
                : 'text-foreground'
            }`}
          >
            <option value="ALL">All Locations ({locations.length})</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name} {loc.code ? `(${loc.code})` : ''} {loc.type ? `• ${loc.type}` : ''}
              </option>
            ))}
          </select>
          <div className="absolute right-3 top-3.5 pointer-events-none text-muted-foreground text-[10px]">
            ▼
          </div>
        </div>
      </div>

      {/* Filter Status Pills & Reset Button */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
          {statuses.map((s) => (
            <button
              key={s.value}
              onClick={() => {
                setSelectedStatus(s.value);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                selectedStatus === s.value
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {hasActiveFilters && (
          <button
            onClick={handleResetFilters}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground bg-muted/60 hover:bg-muted px-2.5 py-1.5 rounded-md transition-colors shrink-0 font-medium"
            title="Reset all search & filters"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Filters</span>
          </button>
        )}
      </div>

      {/* Loading Shimmer State */}
      {loading && (
        <div className="p-12 text-center flex flex-col items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span className="text-xs">Loading live assets inventory...</span>
        </div>
      )}

      {/* Live Assets Data Table */}
      {!loading && assets.length > 0 && (
        <Card className="overflow-hidden border shadow-2xs">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14 text-center">QR</TableHead>
                  <TableHead className="w-44">Tagging ID / SAP</TableHead>
                  <TableHead className="min-w-[220px]">Asset Description</TableHead>
                  <TableHead className="w-36">Category</TableHead>
                  <TableHead className="w-44">Location</TableHead>
                  <TableHead className="w-32 text-right">Book Cost</TableHead>
                  <TableHead className="w-28 text-center">Status</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((asset) => (
                  <TableRow key={asset.id} className="group hover:bg-muted/30 transition-colors">
                    {/* QR Code Matrix Thumbnail */}
                    <TableCell className="text-center py-2 px-2.5">
                      <button
                        type="button"
                        onClick={() => setSelectedQrAsset(asset)}
                        title="Click to view, print & download QR tag"
                        className="inline-flex focus:outline-none"
                      >
                        <AssetQrThumbnail code={asset.sapAssetCode || asset.assetCode} />
                      </button>
                    </TableCell>

                    {/* Tagging ID & SAP ERP Code */}
                    <TableCell className="py-2.5">
                      <div className="space-y-0.5">
                        <span className="font-mono text-xs font-bold text-primary block">
                          {asset.assetCode}
                        </span>
                        {asset.sapAssetCode ? (
                          <span className="font-mono text-[11px] text-muted-foreground block font-medium">
                            SAP: {asset.sapAssetCode}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>

                    {/* Asset Name & Capitalization Date */}
                    <TableCell className="py-2.5">
                      <div className="space-y-0.5">
                        <Link
                          href={`/assets/${asset.id}`}
                          className="font-semibold text-xs sm:text-sm text-foreground hover:text-primary transition-colors line-clamp-1 block"
                        >
                          {asset.name}
                        </Link>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>Capitalized {new Date(asset.createdAt).toLocaleDateString()}</span>
                        </span>
                      </div>
                    </TableCell>

                    {/* Category */}
                    <TableCell className="py-2.5">
                      <span className="truncate block font-medium text-xs text-foreground/80">
                        {asset.category?.name || 'General Asset'}
                      </span>
                    </TableCell>

                    {/* Location */}
                    <TableCell className="py-2.5">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Network className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="truncate block">
                          {asset.location?.name || 'Apex ABL Manufacturing'}
                        </span>
                      </div>
                    </TableCell>

                    {/* Book Cost */}
                    <TableCell className="py-2.5 text-right font-mono font-semibold text-xs text-foreground">
                      {formatCost(asset.purchaseCost)}
                    </TableCell>

                    {/* Status */}
                    <TableCell className="py-2.5 text-center">
                      <Badge
                        variant={
                          asset.status === 'ACTIVE'
                            ? 'default'
                            : asset.status === 'IN_MAINTENANCE'
                            ? 'destructive'
                            : 'secondary'
                        }
                        className="text-[10px] py-0 px-2 font-medium"
                      >
                        {asset.status}
                      </Badge>
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditingAsset(asset)}
                          className="h-7 w-7 text-muted-foreground hover:text-amber-600 hover:bg-amber-50"
                          title="Edit Asset Details"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Link href={`/transfers?code=${asset.assetCode}`}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-blue-600 hover:bg-blue-50"
                            title="Initiate Asset Transfer"
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedQrAsset(asset)}
                          className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                          title="View & Print QR Tag"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                        </Button>
                        <Link href={`/assets/${asset.id}`}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                            title="Inspect Details"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* Pagination Controls */}
      {!loading && assets.length > 0 && (
        <Card className="bg-card/70 border shadow-xs">
          <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            {/* Left: Summary & Per-Page Selector */}
            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
              <span className="text-muted-foreground whitespace-nowrap">
                Showing <strong className="text-foreground font-semibold">{startItem}</strong>–<strong className="text-foreground font-semibold">{endItem}</strong> of{' '}
                <strong className="text-foreground font-semibold">{totalCount.toLocaleString()}</strong>
              </span>
              <div className="flex items-center gap-1.5 pl-2 border-l">
                <span className="text-muted-foreground hidden sm:inline">Per page:</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  className="h-8 text-xs rounded-md border border-input bg-background px-2 py-1 font-medium focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            {/* Right: Page Navigation Buttons */}
            <div className="flex items-center gap-1 w-full sm:w-auto justify-center sm:justify-end overflow-x-auto">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => handlePageChange(1)}
                disabled={page <= 1}
                title="First Page"
              >
                <ChevronsLeft className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
                title="Previous Page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>

              <div className="flex items-center gap-1 mx-1">
                {getPageNumbers().map((p, idx) =>
                  typeof p === 'number' ? (
                    <Button
                      key={p}
                      variant={page === p ? 'default' : 'outline'}
                      size="sm"
                      className={`h-8 min-w-8 px-2 text-xs font-semibold ${
                        page === p ? 'shadow-xs' : 'hover:bg-muted'
                      }`}
                      onClick={() => handlePageChange(p)}
                    >
                      {p}
                    </Button>
                  ) : (
                    <span key={`ellipsis-${idx}`} className="px-1 text-muted-foreground select-none font-bold">
                      …
                    </span>
                  ),
                )}
              </div>

              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
                title="Next Page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => handlePageChange(totalPages)}
                disabled={page >= totalPages}
                title="Last Page"
              >
                <ChevronsRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State when Inventory is Clean/Empty */}
      {!loading && assets.length === 0 && (
        <Card className="border-dashed border-2 border-border/80 bg-card">
          <CardContent className="p-8 sm:p-12 text-center flex flex-col items-center justify-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <Boxes className="w-7 h-7" />
            </div>
            <div className="max-w-md space-y-1">
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                No Assets in Inventory
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {hasActiveFilters
                  ? 'No records match your active search, category, location, or status filters.'
                  : 'Your equipment inventory is currently clean. Import your enterprise schedule (FA List ABL 2026.xlsx) to populate real fixed assets.'}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
              {hasActiveFilters ? (
                <Button variant="outline" onClick={handleResetFilters} className="gap-2 h-10 shadow-2xs">
                  <RotateCcw className="w-4 h-4" />
                  <span>Reset All Filters</span>
                </Button>
              ) : (
                <>
                  <Link href="/assets/import">
                    <Button className="gap-2 h-10 shadow-sm">
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>Import Excel List</span>
                    </Button>
                  </Link>
                  <Link href="/assets/new">
                    <Button variant="outline" className="gap-2 h-10">
                      <Plus className="w-4 h-4" />
                      <span>Register Manually</span>
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scannable & Printable QR Placard Modal */}
      {selectedQrAsset && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="w-full max-w-sm border-2 border-primary shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <CardHeader className="flex flex-row items-center justify-between pb-2 no-print">
              <div>
                <CardTitle className="text-base">Physical Equipment QR Tag</CardTitle>
                <CardDescription className="text-xs line-clamp-1">
                  {selectedQrAsset.name}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={() => setSelectedQrAsset(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>

            <CardContent className="space-y-4 pt-2 text-center">
              {/* High-Resolution Scannable QR Container (Only this prints) */}
              <div className="print-area single-tag-center">
                <div className="print-tag-box bg-white dark:bg-slate-900 border-2 border-primary/30 rounded-2xl p-6 flex flex-col items-center justify-center space-y-3 shadow-inner">
                  <div className="w-48 h-48 bg-white p-2 rounded-xl border shadow flex items-center justify-center">
                    {modalQrUrl ? (
                      <img
                        src={modalQrUrl}
                        alt={`Scannable QR Tag for ${selectedQrAsset.assetCode}`}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {/* Visible text shows Tagging ID */}
                    <span className="font-mono text-base font-bold tracking-wider text-foreground block">
                      {selectedQrAsset.assetCode}
                    </span>
                    {selectedQrAsset.sapAssetCode && (
                      <span className="text-xs font-mono text-muted-foreground block font-semibold">
                        SAP: {selectedQrAsset.sapAssetCode}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 no-print">
                <div className="flex gap-2">
                  <Button className="w-full gap-2 shadow" onClick={() => window.print()}>
                    <Printer className="w-4 h-4" />
                    <span>Print Tag Placard</span>
                  </Button>
                  {(downloadPlacardUrl || modalQrUrl) && (
                    <a
                      href={downloadPlacardUrl || modalQrUrl}
                      download={`TAG-${selectedQrAsset.assetCode}.png`}
                      className="inline-flex"
                    >
                      <Button variant="outline" size="icon" title="Download QR PNG">
                        <Download className="w-4 h-4" />
                      </Button>
                    </a>
                  )}
                </div>

                <div className="flex gap-2">
                  <Link
                    href={`/scan?code=${encodeURIComponent(selectedQrAsset.sapAssetCode || selectedQrAsset.assetCode)}`}
                    className="w-1/2"
                  >
                    <Button variant="outline" className="w-full gap-1.5 text-xs">
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Test Scan</span>
                    </Button>
                  </Link>
                  <Link href={`/assets/${selectedQrAsset.id}`} className="w-1/2">
                    <Button variant="secondary" className="w-full gap-1.5 text-xs">
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Full Details</span>
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bulk Equipment Tag Print Modal */}
      {isBulkPrintOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <Card className="w-full max-w-4xl max-h-[92vh] flex flex-col border-2 border-primary shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b no-print shrink-0">
              <div>
                <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                  <Printer className="w-5 h-5 text-primary" />
                  <span>Bulk Equipment Tag Printing</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Generate high-density sticker sheets (3 columns) for physical equipment tagging
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={() => setIsBulkPrintOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>

            {/* Selection Toolbar */}
            <div className="px-4 py-2.5 bg-muted/40 border-b flex flex-wrap items-center justify-between gap-2 text-xs no-print shrink-0">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={toggleSelectAllBulk}
                >
                  {bulkSelectedIds.size === assets.length ? (
                    <>
                      <Square className="w-3.5 h-3.5" />
                      <span>Deselect All</span>
                    </>
                  ) : (
                    <>
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>Select All ({assets.length})</span>
                    </>
                  )}
                </Button>
                <span className="text-muted-foreground font-medium">
                  {bulkSelectedIds.size} of {assets.length} tags selected for print
                </span>
              </div>
              <Badge variant="secondary" className="font-mono text-[11px]">
                Page {page} of {totalPages}
              </Badge>
            </div>

            {/* Modal Body / Tag Previews */}
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
              {bulkGenerating && (
                <div className="p-8 text-center flex flex-col items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="text-xs">Generating high-resolution QR tags...</span>
                </div>
              )}

              {/* On-screen preview grid */}
              {!bulkGenerating && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 no-print">
                  {assets.map((asset) => {
                    const isSelected = bulkSelectedIds.has(asset.id);
                    return (
                      <div
                        key={`preview-${asset.id}`}
                        onClick={() => toggleAssetBulk(asset.id)}
                        className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex flex-col items-center text-center space-y-2 ${
                          isSelected
                            ? 'border-primary bg-primary/5 shadow-xs'
                            : 'border-muted hover:border-muted-foreground/30 opacity-60 bg-card'
                        }`}
                      >
                        <div className="w-full flex justify-between items-center text-xs">
                          <span
                            className={`w-4 h-4 rounded flex items-center justify-center border text-[10px] font-bold ${
                              isSelected
                                ? 'bg-primary border-primary text-primary-foreground'
                                : 'border-muted-foreground/40 bg-background'
                            }`}
                          >
                            {isSelected ? '✓' : ''}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[80px]">
                            {asset.status}
                          </span>
                        </div>

                        <div className="w-20 h-20 bg-white p-1 rounded-md border flex items-center justify-center shadow-2xs">
                          {bulkQrMap[asset.id] ? (
                            <img
                              src={bulkQrMap[asset.id]}
                              alt={`QR ${asset.assetCode}`}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          )}
                        </div>

                        <div className="space-y-0.5 w-full">
                          <span className="font-mono text-xs font-bold text-foreground block truncate">
                            {asset.assetCode}
                          </span>
                          {asset.sapAssetCode && (
                            <span className="font-mono text-[10px] text-muted-foreground block truncate">
                              SAP: {asset.sapAssetCode}
                            </span>
                          )}
                          <p className="text-[10px] text-muted-foreground truncate" title={asset.name}>
                            {asset.name}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Printable sheet container: ONLY this is visible when printing */}
              <div className="print-area">
                <div className="bulk-print-grid">
                  {assets
                    .filter((a) => bulkSelectedIds.has(a.id))
                    .map((asset) => (
                      <div key={`print-tag-${asset.id}`} className="bulk-tag-card">
                        <div className="w-32 h-32 bg-white p-1 rounded-md flex items-center justify-center">
                          {bulkQrMap[asset.id] ? (
                            <img
                              src={bulkQrMap[asset.id]}
                              alt={`QR for ${asset.assetCode}`}
                              className="w-full h-full object-contain"
                            />
                          ) : null}
                        </div>
                        <div className="space-y-0.5 mt-1">
                          <span className="font-mono text-sm font-bold tracking-wider text-black block">
                            {asset.assetCode}
                          </span>
                          {asset.sapAssetCode && (
                            <span className="font-mono text-xs text-black block font-semibold">
                              SAP: {asset.sapAssetCode}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </CardContent>

            {/* Modal Footer Actions */}
            <div className="p-3 bg-muted/30 border-t flex items-center justify-between gap-3 no-print shrink-0">
              <Button variant="outline" size="sm" onClick={() => setIsBulkPrintOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                className="gap-2 shadow"
                disabled={bulkSelectedIds.size === 0 || bulkGenerating}
                onClick={() => window.print()}
              >
                <Printer className="w-4 h-4" />
                <span>Print {bulkSelectedIds.size} Tags</span>
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Quick Edit Asset Modal */}
      <EditAssetModal
        asset={editingAsset as any}
        isOpen={!!editingAsset}
        onClose={() => setEditingAsset(null)}
        onSuccess={() => {
          mutateAssets();
          setEditingAsset(null);
        }}
      />
    </div>
  );
}
