'use client';

import { useState, useRef, useMemo } from 'react';
import Link from 'next/link';
import {
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Database,
  Layers,
  Sparkles,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Search,
  Check,
  X,
  Info,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface NewAssetPreviewItem {
  rowNumber: number;
  sapAssetCode: string;
  assetCode: string;
  name: string;
  category: string;
  purchaseDate: string | null;
  purchaseCost: number | null;
}

interface PreviewData {
  totalRows: number;
  existingCount: number;
  newCount: number;
  invalidCount: number;
  newCategories: string[];
  newCategoriesCount: number;
  newAssets: NewAssetPreviewItem[];
}

interface ImportSummary {
  success?: boolean;
  totalRows?: number;
  imported?: number;
  skipped?: number;
  skippedExistingSap?: number;
  skippedInvalid?: number;
  categoriesCount?: number;
  newCategoriesCount?: number;
  newCategories?: string[];
  elapsedSeconds?: string | number;
  message?: string;
  [key: string]: any;
}

export default function ImportAssetsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isInserting, setIsInserting] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewPage, setPreviewPage] = useState(1);
  const PAGE_SIZE = 10;

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selected = e.dataTransfer.files[0];
      handleFileSelected(selected);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  // ── Step 1: Validate & analyze Excel workbook ──────────────────────────────
  const handleFileSelected = async (f: File) => {
    setError(null);
    setSummary(null);
    setPreviewData(null);
    setSearchQuery('');
    setPreviewPage(1);

    if (
      !f.name.endsWith('.xlsx') &&
      !f.name.endsWith('.xls') &&
      f.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ) {
      setError('Please select an Excel workbook (.xlsx or .xls file).');
      return;
    }

    setFile(f);
    await analyzeExcel(f);
  };

  const analyzeExcel = async (f: File) => {
    setIsAnalyzing(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', f);

    try {
      const response = await fetch('/api/assets/preview-excel', {
        method: 'POST',
        body: formData,
      });

      const json = await response.json().catch(() => ({ message: 'Server returned non-JSON response' }));

      if (!response.ok) {
        const errorMsg = Array.isArray(json.message)
          ? json.message.join(', ')
          : json.message || json.error || 'Failed to read Excel file. Check file format & database connection.';
        throw new Error(errorMsg);
      }

      const payload: PreviewData = json?.data !== undefined ? json.data : json;
      setPreviewData(payload);
    } catch (err: any) {
      setError(err.message || 'Could not analyze Excel file. Ensure backend is running.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ── Step 2: User Confirms to Insert New Assets ─────────────────────────────
  const handleConfirmInsert = async () => {
    if (!file) return;

    setIsInserting(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/assets/upload-excel', {
        method: 'POST',
        body: formData,
      });

      const json = await response.json().catch(() => ({ message: 'Server returned non-JSON response' }));

      if (!response.ok) {
        const errorMsg = Array.isArray(json.message)
          ? json.message.join(', ')
          : json.message || json.error || 'Failed to import Excel file. Check backend & database connection.';
        throw new Error(errorMsg);
      }

      const payload: ImportSummary = json?.data !== undefined ? json.data : json;
      setSummary(payload);
      setPreviewData(null);
    } catch (err: any) {
      setError(err.message || 'Upload failed. Ensure backend API and database are running.');
    } finally {
      setIsInserting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreviewData(null);
    setSummary(null);
    setError(null);
    setSearchQuery('');
    setPreviewPage(1);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  // Search filter for preview table
  const filteredAssets = useMemo(() => {
    if (!previewData?.newAssets) return [];
    if (!searchQuery.trim()) return previewData.newAssets;
    const q = searchQuery.toLowerCase();
    return previewData.newAssets.filter(
      (a) =>
        a.sapAssetCode.toLowerCase().includes(q) ||
        a.assetCode.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q),
    );
  }, [previewData, searchQuery]);

  const totalPages = Math.ceil(filteredAssets.length / PAGE_SIZE) || 1;
  const paginatedAssets = useMemo(() => {
    const start = (previewPage - 1) * PAGE_SIZE;
    return filteredAssets.slice(start, start + PAGE_SIZE);
  }, [filteredAssets, previewPage]);

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-12">
      {/* Navigation & Header */}
      <div className="space-y-1.5">
        <Link
          href="/assets"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-1"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Back to Assets Inventory</span>
        </Link>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Bulk Excel Asset Importer</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Pre-flight database comparison: only brand new assets are queued for insertion upon confirmation.
            </p>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-3.5 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-xs flex items-start gap-2.5 animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="space-y-1 flex-1">
            <span className="font-bold block">Import Error</span>
            <p className="text-[11px] leading-relaxed">{error}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setError(null)} className="h-6 w-6 p-0 text-destructive">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* ── STAGE 1: Drag & Drop File Selector ─────────────────────────────────── */}
      {!previewData && !summary && (
        <>
          <Card className="border-border/80">
            <CardContent className="p-5 sm:p-8 space-y-4">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !isAnalyzing && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 sm:p-12 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                  isDragging
                    ? 'border-primary bg-primary/5 scale-[0.99]'
                    : isAnalyzing
                    ? 'border-primary/50 bg-primary/5 cursor-wait'
                    : 'border-border hover:border-primary/50 hover:bg-muted/40'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  disabled={isAnalyzing}
                  onChange={handleFileChange}
                />
                <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  {isAnalyzing ? (
                    <Loader2 className="w-7 h-7 animate-spin text-primary" />
                  ) : (
                    <UploadCloud className="w-7 h-7" />
                  )}
                </div>

                <div className="space-y-1">
                  <p className="text-sm sm:text-base font-semibold">
                    {isAnalyzing
                      ? 'Reading Excel & Comparing with Database...'
                      : file
                      ? file.name
                      : 'Click to select or drag and drop Excel workbook'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isAnalyzing
                      ? 'Checking 13,000+ existing records to filter out duplicates...'
                      : 'Supports Microsoft Excel (.xlsx, .xls) files up to 50MB'}
                  </p>
                </div>

                {file && (
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs bg-background">
                      {formatFileSize(file.size)}
                    </Badge>
                    {isAnalyzing && (
                      <Badge className="bg-sky-500 text-white text-xs gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Comparing Codes
                      </Badge>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Ingestion Rules helper card */}
          <Card className="border-border/60 bg-muted/20">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
                <Info className="w-3.5 h-3.5 text-primary" />
                <span>How Pre-Flight Comparison Works</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="p-2.5 rounded-lg bg-card border">
                <strong className="text-foreground block text-xs mb-0.5">1. SAP Code Deduplication</strong>
                <p className="text-[11px] text-muted-foreground">
                  Compares Column 4 (Asset No:) against all existing assets in Microsoft SQL Server. Existing assets are safely skipped.
                </p>
              </div>
              <div className="p-2.5 rounded-lg bg-card border">
                <strong className="text-foreground block text-xs mb-0.5">2. Preview & Confirmation</strong>
                <p className="text-[11px] text-muted-foreground">
                  You will see an exact table of brand new equipment before anything is written to the database.
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── STAGE 2: Pre-Flight Comparison Preview & Confirmation ─────────────── */}
      {previewData && !summary && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Comparison Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
            <Card className="border-emerald-500/40 bg-emerald-500/5">
              <CardContent className="p-3 sm:p-4 text-center space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
                  New Assets Found
                </span>
                <span className="text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                  {previewData.newCount.toLocaleString()}
                </span>
                <span className="text-[10px] text-muted-foreground block">Ready to insert</span>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="p-3 sm:p-4 text-center space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Already in DB
                </span>
                <span className="text-2xl sm:text-3xl font-bold text-foreground">
                  {previewData.existingCount.toLocaleString()}
                </span>
                <span className="text-[10px] text-muted-foreground block">Will be skipped</span>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="p-3 sm:p-4 text-center space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                  New Categories
                </span>
                <span className="text-2xl sm:text-3xl font-bold text-primary">
                  {previewData.newCategoriesCount.toLocaleString()}
                </span>
                <span className="text-[10px] text-muted-foreground block">Auto-created first</span>
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="p-3 sm:p-4 text-center space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                  Total Excel Rows
                </span>
                <span className="text-2xl sm:text-3xl font-bold text-foreground">
                  {previewData.totalRows.toLocaleString()}
                </span>
                <span className="text-[10px] text-muted-foreground block">{file?.name}</span>
              </CardContent>
            </Card>
          </div>

          {/* New Categories Tag Banner if present */}
          {previewData.newCategories && previewData.newCategories.length > 0 && (
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                <Layers className="w-3.5 h-3.5" />
                <span>New Categories to be Added ({previewData.newCategories.length}):</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {previewData.newCategories.map((cat, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs bg-background font-medium">
                    {cat}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* New Assets Preview Card */}
          <Card className="border shadow-sm overflow-hidden">
            <CardHeader className="p-3.5 sm:p-4 border-b bg-muted/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <span>New Assets to Insert</span>
                  <Badge className="bg-emerald-600 text-white font-mono text-[11px]">
                    {filteredAssets.length} {filteredAssets.length !== previewData.newCount ? `filtered (of ${previewData.newCount})` : 'items'}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  Review the equipment below. Existing records with matching SAP codes are omitted.
                </CardDescription>
              </div>

              {/* Search Filter in Preview */}
              {previewData.newCount > 0 && (
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input
                    placeholder="Filter by code, name, category..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPreviewPage(1);
                    }}
                    className="h-8 pl-8 text-xs font-mono"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </CardHeader>

            <CardContent className="p-0">
              {previewData.newCount === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-600 mx-auto flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-foreground">All Equipment Already Exists in Database</h4>
                  <p className="text-xs text-muted-foreground max-w-md mx-auto">
                    All {previewData.existingCount.toLocaleString()} SAP asset codes in this workbook are already present in the database. No duplicate records will be created.
                  </p>
                </div>
              ) : filteredAssets.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No new assets match your search filter "{searchQuery}".
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b bg-muted/40 text-muted-foreground text-[11px] uppercase font-semibold">
                        <th className="py-2.5 px-3 w-12 text-center">Row</th>
                        <th className="py-2.5 px-3">SAP Asset Code</th>
                        <th className="py-2.5 px-3">Asset / Tag Code</th>
                        <th className="py-2.5 px-3">Name / Description</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3 text-right">Cost (BDT'K)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60 font-mono">
                      {paginatedAssets.map((asset) => (
                        <tr key={asset.sapAssetCode} className="hover:bg-muted/30 transition-colors">
                          <td className="py-2 px-3 text-center text-muted-foreground text-[10px]">
                            {asset.rowNumber}
                          </td>
                          <td className="py-2 px-3 font-bold text-foreground">
                            {asset.sapAssetCode}
                          </td>
                          <td className="py-2 px-3 text-primary">
                            {asset.assetCode}
                          </td>
                          <td className="py-2 px-3 font-sans text-foreground max-w-xs truncate" title={asset.name}>
                            {asset.name}
                          </td>
                          <td className="py-2 px-3 font-sans">
                            <Badge variant="outline" className="text-[10px] py-0 px-1 font-medium">
                              {asset.category}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-right text-muted-foreground">
                            {asset.purchaseCost !== null ? asset.purchaseCost.toLocaleString() : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Table Pagination Controls */}
              {totalPages > 1 && (
                <div className="p-3 border-t bg-muted/10 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Showing {(previewPage - 1) * PAGE_SIZE + 1} to{' '}
                    {Math.min(previewPage * PAGE_SIZE, filteredAssets.length)} of {filteredAssets.length} new items
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={previewPage <= 1}
                      onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                      className="h-7 px-2 text-xs"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </Button>
                    <span className="px-2 text-xs font-semibold">
                      {previewPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={previewPage >= totalPages}
                      onClick={() => setPreviewPage((p) => Math.min(totalPages, p + 1))}
                      className="h-7 px-2 text-xs"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Confirmation Bar */}
          <div className="p-4 rounded-xl border bg-card flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
            <div className="space-y-0.5 text-center sm:text-left">
              <span className="text-xs font-bold text-foreground block">
                {previewData.newCount > 0
                  ? `Ready to insert ${previewData.newCount.toLocaleString()} new assets?`
                  : 'No changes will be made to database.'}
              </span>
              <p className="text-[11px] text-muted-foreground">
                {previewData.newCount > 0
                  ? `Existing records are untouched. New categories will be created automatically.`
                  : 'All records in this file already exist in the system.'}
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                disabled={isInserting}
                onClick={handleReset}
                className="flex-1 sm:flex-initial h-9 text-xs"
              >
                <span>Choose Another File</span>
              </Button>

              {previewData.newCount > 0 && (
                <Button
                  size="sm"
                  disabled={isInserting}
                  onClick={handleConfirmInsert}
                  className="flex-1 sm:flex-initial h-9 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shadow-sm"
                >
                  {isInserting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Inserting {previewData.newCount.toLocaleString()} Assets...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Confirm &amp; Insert ({previewData.newCount.toLocaleString()} Assets)</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── STAGE 3: Success Confirmation View ───────────────────────────────── */}
      {summary && (
        <Card className="border-emerald-500/40 bg-card overflow-hidden shadow-sm animate-in fade-in duration-200">
          <div className="bg-emerald-500/10 p-5 border-b border-emerald-500/20 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                Excel Import Successfully Completed!
              </h2>
              <p className="text-xs text-muted-foreground">{summary.message}</p>
            </div>
          </div>

          <CardContent className="p-5 sm:p-6 space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-lg bg-muted/40 border border-border/50 text-center space-y-1">
                <span className="text-[11px] text-muted-foreground block uppercase font-medium">
                  Inserted Assets
                </span>
                <span className="text-2xl font-bold text-emerald-600">
                  {((summary.imported ?? summary.data?.imported) ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="p-3.5 rounded-lg bg-muted/40 border border-border/50 text-center space-y-1">
                <span className="text-[11px] text-muted-foreground block uppercase font-medium">
                  Skipped (Existing SAP)
                </span>
                <span className="text-2xl font-bold text-foreground">
                  {((summary.skippedExistingSap ?? summary.skipped ?? summary.data?.skippedExistingSap ?? summary.data?.skipped) ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="p-3.5 rounded-lg bg-muted/40 border border-border/50 text-center space-y-1">
                <span className="text-[11px] text-muted-foreground block uppercase font-medium">
                  New Categories
                </span>
                <span className="text-2xl font-bold text-primary">
                  {((summary.newCategoriesCount ?? summary.data?.newCategoriesCount) ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="p-3.5 rounded-lg bg-muted/40 border border-border/50 text-center space-y-1">
                <span className="text-[11px] text-muted-foreground block uppercase font-medium">
                  Duration
                </span>
                <span className="text-2xl font-bold text-foreground">
                  {summary.elapsedSeconds ?? summary.data?.elapsedSeconds ?? '0'}s
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
              <Link href="/assets" className="w-full sm:w-1/2">
                <Button className="w-full gap-2 h-11 font-semibold">
                  <span>View All Assets in Inventory</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Button
                variant="outline"
                onClick={handleReset}
                className="w-full sm:w-1/2 gap-2 h-11"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Import Another Excel File</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
