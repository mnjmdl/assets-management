'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  BarChart3,
  Download,
  Printer,
  RotateCcw,
  Search,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Boxes,
  Building,
  Calendar,
  ClipboardCheck,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  FileSpreadsheet,
  Layers,
  MapPin,
  ShieldCheck,
  TrendingUp,
  X,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface AuditReportItem {
  id: string;
  planId: string;
  planName: string;
  planStatus: string;
  sessionId: string;
  stationName: string;
  stationCode: string;
  auditorName: string;
  assetId: string;
  assetCode: string;
  sapAssetCode?: string | null;
  assetName: string;
  model?: string | null;
  category: string;
  department: string;
  expectedLocation: string;
  physicalLocation: string;
  physicalLocationCode: string;
  status: string;
  condition: string;
  notes?: string | null;
  scannedAt?: string | null;
  hasDiscrepancy: boolean;
  discrepancyType?: string | null;
  discrepancyResolved: boolean;
}

interface AuditReportSummary {
  totalPlans: number;
  totalItems: number;
  verifiedCount: number;
  mismatchCount: number;
  missingCount: number;
  damagedCount: number;
  pendingCount: number;
  conditionGoodCount: number;
  conditionFairCount: number;
  conditionDamagedCount: number;
  totalDiscrepancies: number;
  resolvedDiscrepancies: number;
  complianceRate: number;
}

interface PlanOption {
  id: string;
  name: string;
  type: string;
  status: string;
}

export default function AuditReportsPage() {
  const searchParams = useSearchParams();
  const initialPlanId = searchParams?.get('planId') || '';

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data from API
  const [summary, setSummary] = useState<AuditReportSummary | null>(null);
  const [items, setItems] = useState<AuditReportItem[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);

  // Filter States
  const [selectedPlanId, setSelectedPlanId] = useState<string>(initialPlanId);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [conditionFilter, setConditionFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pagination States
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedPlanId) params.append('planId', selectedPlanId);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);

      const url = `/api/reports/audits${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to load audit report (${res.status})`);
      }

      const json = await res.json();
      const payload = json?.data !== undefined ? json.data : json;

      setSummary(payload.summary || null);
      setItems(Array.isArray(payload.items) ? payload.items : []);
      setPlans(Array.isArray(payload.plans) ? payload.plans : []);
    } catch (err: any) {
      console.error('Error fetching audit report:', err);
      setError(err.message || 'Could not load audit report data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
    setPage(1);
  }, [selectedPlanId, statusFilter]);

  // Export Excel
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (selectedPlanId) params.append('planId', selectedPlanId);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);

      const url = `/api/reports/audits/export${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to download Excel report');

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const filename = selectedPlanId
        ? `Audit-Status-Report-${selectedPlanId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.xlsx`
        : `Consolidated-Audit-Status-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (e: any) {
      alert(e.message || 'Error exporting report to Excel');
    } finally {
      setExporting(false);
    }
  };

  // Filter items in memory by search query and condition filter
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (conditionFilter !== 'ALL' && item.condition !== conditionFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchCode = item.assetCode.toLowerCase().includes(q);
        const matchSap = item.sapAssetCode?.toLowerCase().includes(q);
        const matchName = item.assetName.toLowerCase().includes(q);
        const matchStation = item.stationName.toLowerCase().includes(q);
        const matchExpected = item.expectedLocation.toLowerCase().includes(q);
        const matchPhysical = item.physicalLocation.toLowerCase().includes(q);
        const matchAuditor = item.auditorName.toLowerCase().includes(q);
        return Boolean(
          matchCode ||
            matchSap ||
            matchName ||
            matchStation ||
            matchExpected ||
            matchPhysical ||
            matchAuditor,
        );
      }
      return true;
    });
  }, [items, conditionFilter, searchQuery]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const paginatedItems = useMemo(() => {
    return filteredItems.slice((safePage - 1) * pageSize, safePage * pageSize);
  }, [filteredItems, safePage, pageSize]);

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
  };

  const getPageNumbers = () => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | string)[] = [];
    if (safePage <= 3) {
      pages.push(1, 2, 3, '…', totalPages);
    } else if (safePage >= totalPages - 2) {
      pages.push(1, '…', totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, '…', safePage, '…', totalPages);
    }
    return pages;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[11px] gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>VERIFIED</span>
          </Badge>
        );
      case 'MISMATCH':
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[11px] gap-1">
            <AlertTriangle className="w-3 h-3" />
            <span>MISMATCH</span>
          </Badge>
        );
      case 'DAMAGED':
        return (
          <Badge variant="destructive" className="text-[11px] gap-1">
            <AlertCircle className="w-3 h-3" />
            <span>DAMAGED</span>
          </Badge>
        );
      case 'MISSING':
        return (
          <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/30 text-[11px] gap-1">
            <AlertCircle className="w-3 h-3" />
            <span>MISSING</span>
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[11px] text-muted-foreground">
            PENDING
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* ─────────────────────────────────────────────────────────────
          PAGE HEADER & ACTIONS
         ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                Audit Status &amp; Compliance Report
              </h1>
              <p className="text-xs text-muted-foreground">
                Reconciliation summary, location mismatch tracking, condition grades, and variance audits
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchReport}
            disabled={loading}
            className="h-9 gap-1.5 shadow-2xs"
            title="Refresh Report Data"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="h-9 gap-1.5 shadow-2xs hidden sm:flex"
            title="Print or Save PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </Button>

          <Button
            size="sm"
            onClick={handleExportExcel}
            disabled={exporting || items.length === 0}
            className="h-9 gap-1.5 shadow-sm font-semibold"
          >
            {exporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-3.5 h-3.5" />
            )}
            <span>Export Excel (.xlsx)</span>
          </Button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          EXECUTIVE KPI METRIC CARDS
         ───────────────────────────────────────────────────────────── */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Station Compliance Rate */}
          <Card className="border bg-card shadow-2xs col-span-2 sm:col-span-1 lg:col-span-1">
            <CardContent className="p-3.5 space-y-1 text-center">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                Compliance Rate
              </span>
              <div className="flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-2xl font-extrabold text-foreground tracking-tight">
                  {summary.complianceRate}%
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {summary.verifiedCount} of {summary.totalItems} verified
              </p>
            </CardContent>
          </Card>

          {/* Verified Items */}
          <Card className="border bg-card shadow-2xs">
            <CardContent className="p-3.5 space-y-1 text-center">
              <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider block">
                Station Verified
              </span>
              <span className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400">
                {summary.verifiedCount}
              </span>
              <p className="text-[10px] text-muted-foreground">Expected station match</p>
            </CardContent>
          </Card>

          {/* Location Mismatches (Relocated) */}
          <Card className="border bg-card shadow-2xs">
            <CardContent className="p-3.5 space-y-1 text-center">
              <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 tracking-wider block">
                Relocated (Mismatch)
              </span>
              <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">
                {summary.mismatchCount}
              </span>
              <p className="text-[10px] text-muted-foreground">Moved to different station</p>
            </CardContent>
          </Card>

          {/* Damaged Equipment */}
          <Card className="border bg-card shadow-2xs">
            <CardContent className="p-3.5 space-y-1 text-center">
              <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400 tracking-wider block">
                Damaged / Defect
              </span>
              <span className="text-2xl font-extrabold text-rose-600 dark:text-rose-400">
                {summary.damagedCount}
              </span>
              <p className="text-[10px] text-muted-foreground">Reported wear/damage</p>
            </CardContent>
          </Card>

          {/* Missing Equipment */}
          <Card className="border bg-card shadow-2xs">
            <CardContent className="p-3.5 space-y-1 text-center">
              <span className="text-[10px] uppercase font-bold text-purple-600 dark:text-purple-400 tracking-wider block">
                Missing Assets
              </span>
              <span className="text-2xl font-extrabold text-purple-600 dark:text-purple-400">
                {summary.missingCount}
              </span>
              <p className="text-[10px] text-muted-foreground">Unaccounted tags</p>
            </CardContent>
          </Card>

          {/* Pending Floor Scan */}
          <Card className="border bg-card shadow-2xs col-span-2 sm:col-span-1 lg:col-span-1">
            <CardContent className="p-3.5 space-y-1 text-center">
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                Pending Scan
              </span>
              <span className="text-2xl font-extrabold text-muted-foreground">
                {summary.pendingCount}
              </span>
              <p className="text-[10px] text-muted-foreground">Awaiting physical audit</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          STATUS RATIO VISUAL PROGRESS BARS
         ───────────────────────────────────────────────────────────── */}
      {summary && summary.totalItems > 0 && (
        <Card className="border bg-card shadow-2xs overflow-hidden">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span className="flex items-center gap-1.5 text-foreground font-bold">
                <TrendingUp className="w-4 h-4 text-primary" />
                <span>Audit Reconciliation Breakdown</span>
              </span>
              <span>Total in Scope: {summary.totalItems} Items</span>
            </div>

            {/* Stacked Percentage Progress Bar */}
            <div className="h-4 w-full rounded-full bg-muted overflow-hidden flex shadow-inner">
              {summary.verifiedCount > 0 && (
                <div
                  style={{ width: `${(summary.verifiedCount / summary.totalItems) * 100}%` }}
                  className="bg-emerald-500 h-full transition-all"
                  title={`Verified: ${summary.verifiedCount}`}
                />
              )}
              {summary.mismatchCount > 0 && (
                <div
                  style={{ width: `${(summary.mismatchCount / summary.totalItems) * 100}%` }}
                  className="bg-amber-500 h-full transition-all"
                  title={`Relocated / Mismatch: ${summary.mismatchCount}`}
                />
              )}
              {summary.damagedCount > 0 && (
                <div
                  style={{ width: `${(summary.damagedCount / summary.totalItems) * 100}%` }}
                  className="bg-rose-500 h-full transition-all"
                  title={`Damaged: ${summary.damagedCount}`}
                />
              )}
              {summary.missingCount > 0 && (
                <div
                  style={{ width: `${(summary.missingCount / summary.totalItems) * 100}%` }}
                  className="bg-purple-500 h-full transition-all"
                  title={`Missing: ${summary.missingCount}`}
                />
              )}
              {summary.pendingCount > 0 && (
                <div
                  style={{ width: `${(summary.pendingCount / summary.totalItems) * 100}%` }}
                  className="bg-muted-foreground/30 h-full transition-all"
                  title={`Pending: ${summary.pendingCount}`}
                />
              )}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
              <div className="flex flex-wrap items-center gap-4 text-[11px]">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                  <span>Verified ({summary.verifiedCount})</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                  <span>Relocated ({summary.mismatchCount})</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                  <span>Damaged ({summary.damagedCount})</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0" />
                  <span>Missing ({summary.missingCount})</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/40 shrink-0" />
                  <span>Pending ({summary.pendingCount})</span>
                </span>
              </div>

              <div className="text-[11px] text-muted-foreground font-medium">
                Physical Condition: {summary.conditionGoodCount} Good • {summary.conditionFairCount} Fair • {summary.conditionDamagedCount} Damaged
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─────────────────────────────────────────────────────────────
          FILTER CONTROLS & SEARCH BAR
         ───────────────────────────────────────────────────────────── */}
      <Card className="border bg-card shadow-2xs">
        <CardContent className="p-3.5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Plan Picker */}
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
              <span className="text-xs font-bold text-muted-foreground flex items-center gap-1 shrink-0">
                <ClipboardCheck className="w-4 h-4 text-primary" />
                <span>Scope:</span>
              </span>

              <select
                className="h-9 px-3 rounded-lg border bg-background text-xs font-semibold text-foreground focus:ring-2 focus:ring-primary/20 flex-1 min-w-[180px] max-w-sm"
                value={selectedPlanId}
                onChange={(e) => {
                  setSelectedPlanId(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">-- All Audit Plans (Consolidated) --</option>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.status})
                  </option>
                ))}
              </select>

              {selectedPlanId && (
                <Link href={`/audits/${selectedPlanId}`}>
                  <Button variant="ghost" size="sm" className="h-9 px-2 text-xs text-muted-foreground gap-1">
                    <span>Audit Plan</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              )}
            </div>

            {/* Audit Status Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium shrink-0">Audit Status:</span>
              <select
                className="h-9 px-3 rounded-lg border bg-background text-xs font-semibold text-foreground focus:ring-2 focus:ring-primary/20"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">All Statuses</option>
                <option value="VERIFIED">VERIFIED</option>
                <option value="MISMATCH">MISMATCH (Relocated)</option>
                <option value="DAMAGED">DAMAGED</option>
                <option value="MISSING">MISSING</option>
                <option value="PENDING">PENDING</option>
              </select>
            </div>

            {/* Condition Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium shrink-0">Condition:</span>
              <select
                className="h-9 px-3 rounded-lg border bg-background text-xs font-semibold text-foreground focus:ring-2 focus:ring-primary/20"
                value={conditionFilter}
                onChange={(e) => {
                  setConditionFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">All Conditions</option>
                <option value="GOOD">GOOD</option>
                <option value="FAIR">FAIR</option>
                <option value="DAMAGED">DAMAGED</option>
              </select>
            </div>
          </div>

          {/* Quick Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filter by asset tag, SAP code, equipment name, station, expected location, auditor..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="h-9 pl-9 text-xs font-mono"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ─────────────────────────────────────────────────────────────
          RECONCILIATION TABLE & PAGINATION
         ───────────────────────────────────────────────────────────── */}
      {loading ? (
        <Card className="p-12 text-center flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Loading audit status report records...</p>
        </Card>
      ) : error ? (
        <Card className="p-8 text-center border-destructive/40 bg-destructive/5 space-y-3">
          <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
          <p className="text-sm font-semibold text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchReport} className="gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </Button>
        </Card>
      ) : items.length === 0 ? (
        <Card className="border-dashed p-12 text-center space-y-3">
          <Boxes className="w-10 h-10 text-muted-foreground/60 mx-auto" />
          <h3 className="font-bold text-base text-foreground">No Audit Records Found</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            No equipment assets currently match the selected audit plan or filters. Run a floor scan or select another audit plan.
          </p>
          <div className="pt-2">
            <Link href="/scan">
              <Button size="sm" className="gap-1.5">
                <span>Open Floor Scanner</span>
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 text-[11px]">
                  <TableHead className="w-[120px]">Asset Code</TableHead>
                  <TableHead className="w-[110px]">SAP Code</TableHead>
                  <TableHead>Equipment Name</TableHead>
                  <TableHead>Expected Location</TableHead>
                  <TableHead>Physical Location</TableHead>
                  <TableHead className="w-[110px]">Audit Status</TableHead>
                  <TableHead className="w-[90px]">Condition</TableHead>
                  <TableHead>Auditor / Station</TableHead>
                  <TableHead className="w-[130px] text-right">Scanned Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-foreground">No Matching Equipment</p>
                        <p className="text-[11px]">No items match your active search and condition filters.</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSearchQuery('');
                            setConditionFilter('ALL');
                            setStatusFilter('ALL');
                          }}
                          className="h-7 text-xs mt-2"
                        >
                          Clear Filters
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedItems.map((item) => (
                    <TableRow key={item.id} className="text-xs hover:bg-muted/30">
                      <TableCell className="font-mono font-semibold text-primary">
                        <Link
                          href={`/assets?code=${item.assetCode}`}
                          className="hover:underline flex items-center gap-1"
                          title="View Asset in Inventory"
                        >
                          <span>{item.assetCode}</span>
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground text-[11px]">
                        {item.sapAssetCode || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{item.assetName}</div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                          <span>{item.category}</span>
                          {item.department !== '-' && <span>• {item.department}</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-[11px]">
                        <span className="flex items-center gap-1">
                          <Building className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span>{item.expectedLocation}</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-[11px]">
                        <div className="space-y-0.5">
                          <span className="font-semibold text-foreground flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>{item.physicalLocation}</span>
                            {item.physicalLocationCode && (
                              <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1 rounded">
                                {item.physicalLocationCode}
                              </span>
                            )}
                          </span>
                          {item.status === 'MISMATCH' && (
                            <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span>Relocated from {item.expectedLocation}</span>
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell className="text-[11px] font-medium">
                        {item.condition === 'DAMAGED' ? (
                          <span className="text-rose-600 font-semibold">{item.condition}</span>
                        ) : item.condition === 'FAIR' ? (
                          <span className="text-amber-600 font-semibold">{item.condition}</span>
                        ) : (
                          item.condition
                        )}
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">
                        <div className="font-medium text-foreground">{item.stationName}</div>
                        <div className="text-[10px]">{item.auditorName}</div>
                      </TableCell>
                      <TableCell className="text-right text-[11px] text-muted-foreground font-mono">
                        {item.scannedAt
                          ? new Date(item.scannedAt).toLocaleDateString('en-US', {
                              month: 'short',
                              day: '2-digit',
                              year: 'numeric',
                            })
                          : 'Pending'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Footer */}
          <div className="p-3.5 border-t bg-muted/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
              <span>
                Showing{' '}
                <strong className="text-foreground">
                  {filteredItems.length === 0 ? 0 : (safePage - 1) * pageSize + 1}
                </strong>{' '}
                to{' '}
                <strong className="text-foreground">
                  {Math.min(safePage * pageSize, filteredItems.length)}
                </strong>{' '}
                of <strong className="text-foreground">{filteredItems.length}</strong>{' '}
                {filteredItems.length !== items.length
                  ? `(filtered from ${items.length} records)`
                  : 'records'}
              </span>

              <div className="flex items-center gap-1.5 ml-2 border-l pl-2">
                <span className="text-[11px] text-muted-foreground">Per page:</span>
                <select
                  className="h-7 px-1.5 rounded border bg-background text-[11px] font-semibold text-foreground focus:ring-1 focus:ring-primary/20"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handlePageChange(1)}
                  disabled={safePage <= 1}
                  title="First Page"
                >
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handlePageChange(safePage - 1)}
                  disabled={safePage <= 1}
                  title="Previous Page"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>

                <div className="flex items-center gap-1 mx-1">
                  {getPageNumbers().map((p, idx) =>
                    typeof p === 'number' ? (
                      <Button
                        key={p}
                        variant={safePage === p ? 'default' : 'outline'}
                        size="sm"
                        className={`h-7 min-w-7 px-2 text-xs font-semibold ${
                          safePage === p ? 'shadow-xs' : 'hover:bg-muted'
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
                  className="h-7 w-7"
                  onClick={() => handlePageChange(safePage + 1)}
                  disabled={safePage >= totalPages}
                  title="Next Page"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handlePageChange(totalPages)}
                  disabled={safePage >= totalPages}
                  title="Last Page"
                >
                  <ChevronsRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

