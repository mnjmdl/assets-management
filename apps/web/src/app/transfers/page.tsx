'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeftRight,
  Plus,
  RotateCcw,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  Truck,
  Building,
  User,
  Boxes,
  MapPin,
  ArrowRight,
  Check,
  X,
  FileCheck,
  AlertCircle,
  Loader2,
  Calendar,
  Layers,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
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

interface TransferItem {
  id: string;
  assetId: string;
  fromDeptId?: string | null;
  toDeptId?: string | null;
  requestedById: string;
  approvedById?: string | null;
  status: 'PENDING' | 'APPROVED' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';
  reason?: string | null;
  notes?: string | null;
  requestedAt: string;
  approvedAt?: string | null;
  completedAt?: string | null;
  asset: {
    id: string;
    name: string;
    assetCode: string;
    sapAssetCode?: string | null;
    model?: string | null;
    status: string;
    location?: { id: string; name: string; code?: string } | null;
    category?: { id: string; name: string } | null;
  };
  fromDept?: { id: string; name: string; code?: string } | null;
  toDept?: { id: string; name: string; code?: string } | null;
  requestedBy?: { id: string; name: string; email?: string } | null;
  approvedBy?: { id: string; name: string; email?: string } | null;
}

interface TransferStats {
  total: number;
  pending: number;
  approved: number;
  completed: number;
  rejected: number;
}

interface DepartmentOption {
  id: string;
  name: string;
  code?: string;
}

interface LocationOption {
  id: string;
  name: string;
  code: string;
  type: string;
}

export default function TransfersPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const prefillAssetId = searchParams?.get('assetId') || '';
  const prefillAssetCode = searchParams?.get('code') || '';
  const prefillToLoc = searchParams?.get('toLocationId') || '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Transfers & stats data
  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const [stats, setStats] = useState<TransferStats>({
    total: 0,
    pending: 0,
    approved: 0,
    completed: 0,
    rejected: 0,
  });

  // Reference options for create transfer
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);

  // Filter States
  const [statusTab, setStatusTab] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [deptFilter, setDeptFilter] = useState<string>('ALL');

  // Pagination States
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Modal: Initiate Transfer
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Modal Form State
  const [formAssetQuery, setFormAssetQuery] = useState(prefillAssetCode);
  const [formSelectedAsset, setFormSelectedAsset] = useState<any>(null);
  const [assetSearching, setAssetSearching] = useState(false);
  const [assetSearchResults, setAssetSearchResults] = useState<any[]>([]);

  const [formToDeptId, setFormToDeptId] = useState('');
  const [formToLocationId, setFormToLocationId] = useState('');
  const [formReason, setFormReason] = useState('');

  // Modal: Approve / Reject
  const [actionModal, setActionModal] = useState<{
    type: 'approve' | 'reject';
    transfer: TransferItem;
    notes: string;
  } | null>(null);
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);

  // Fetch transfers and summary stats
  const fetchTransfers = async () => {
    setLoading(true);
    setError(null);
    try {
      const [transRes, statsRes] = await Promise.all([
        fetch('/api/transfers?limit=100'),
        fetch('/api/transfers/stats'),
      ]);

      if (transRes.ok) {
        const json = await transRes.json();
        const list = Array.isArray(json?.data) ? json.data : [];
        setTransfers(list);
      }

      if (statsRes.ok) {
        const statsJson = await statsRes.json();
        if (statsJson?.data) setStats(statsJson.data);
      }
    } catch (err: any) {
      console.error('Error loading transfers:', err);
      setError(err.message || 'Could not load asset transfers');
    } finally {
      setLoading(false);
    }
  };

  // Fetch departments and locations reference lists
  const fetchReferences = async () => {
    try {
      const [deptRes, locRes] = await Promise.all([
        fetch('/api/transfers/departments'),
        fetch('/api/locations'),
      ]);

      if (deptRes.ok) {
        const deptJson = await deptRes.json();
        const dList = Array.isArray(deptJson?.data) ? deptJson.data : [];
        setDepartments(dList);
        if (dList.length > 0 && !formToDeptId) {
          setFormToDeptId(dList[0].id);
        }
      }

      if (locRes.ok) {
        const locJson = await locRes.json();
        const lList = Array.isArray(locJson?.data) ? locJson.data : [];
        setLocations(lList);
      }
    } catch (e) {
      console.error('Error fetching references:', e);
    }
  };

  useEffect(() => {
    fetchTransfers();
    fetchReferences();
  }, []);

  // Handle pre-fill asset from query param
  useEffect(() => {
    if (prefillAssetId || prefillAssetCode) {
      const target = prefillAssetCode || prefillAssetId;
      fetch(`/api/assets/scan/${encodeURIComponent(target)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((res) => {
          const payload = res?.data !== undefined ? res.data : res;
          const a = payload?.asset || payload;
          if (a?.id) {
            setFormSelectedAsset(a);
            setFormAssetQuery(a.assetCode);
            if (prefillToLoc) {
              setFormToLocationId(prefillToLoc);
            }
            setIsModalOpen(true);
          }
        })
        .catch((e) => console.error('Prefill asset lookup error:', e));
    } else if (prefillToLoc) {
      setFormToLocationId(prefillToLoc);
      setIsModalOpen(true);
    }
  }, [prefillAssetId, prefillAssetCode, prefillToLoc]);

  // Asset search in create modal
  const handleSearchAsset = async (query: string) => {
    setFormAssetQuery(query);
    if (!query.trim()) {
      setAssetSearchResults([]);
      return;
    }

    setAssetSearching(true);
    try {
      const res = await fetch(`/api/assets?search=${encodeURIComponent(query)}&limit=5`);
      if (res.ok) {
        const json = await res.json();
        setAssetSearchResults(Array.isArray(json?.data) ? json.data : []);
      }
    } catch (e) {
      console.error('Asset search error:', e);
    } finally {
      setAssetSearching(false);
    }
  };

  // Create new transfer request
  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSelectedAsset) {
      setFormError('Please select an asset to transfer.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const payload: any = {
        assetId: formSelectedAsset.id,
        reason: formReason,
      };
      if (formToDeptId) payload.toDeptId = formToDeptId;
      if (formToLocationId) payload.toLocationId = formToLocationId;

      const res = await fetch('/api/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || 'Failed to submit transfer request');
      }

      setIsModalOpen(false);
      setFormSelectedAsset(null);
      setFormAssetQuery('');
      setFormReason('');
      setFormToLocationId('');
      await fetchTransfers();
    } catch (err: any) {
      console.error('Create transfer error:', err);
      setFormError(err.message || 'Could not initiate transfer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Approve Transfer
  const handleApprove = async () => {
    if (!actionModal) return;
    setIsActionSubmitting(true);
    try {
      const res = await fetch(`/api/transfers/${actionModal.transfer.id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: actionModal.notes }),
      });
      if (!res.ok) throw new Error('Failed to approve transfer');
      setActionModal(null);
      await fetchTransfers();
    } catch (e: any) {
      alert(e.message || 'Error approving transfer');
    } finally {
      setIsActionSubmitting(false);
    }
  };

  // Reject Transfer
  const handleReject = async () => {
    if (!actionModal) return;
    if (!actionModal.notes.trim()) {
      alert('A rejection reason is required.');
      return;
    }
    setIsActionSubmitting(true);
    try {
      const res = await fetch(`/api/transfers/${actionModal.transfer.id}/reject`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason: actionModal.notes }),
      });
      if (!res.ok) throw new Error('Failed to reject transfer');
      setActionModal(null);
      await fetchTransfers();
    } catch (e: any) {
      alert(e.message || 'Error rejecting transfer');
    } finally {
      setIsActionSubmitting(false);
    }
  };

  // Complete Transfer (Mark In Transit / Physical Handover as completed)
  const handleComplete = async (transferId: string) => {
    if (!confirm('Confirm physical handover & complete this asset transfer? The asset department and location records will be updated immediately.')) {
      return;
    }
    try {
      const res = await fetch(`/api/transfers/${transferId}/complete`, {
        method: 'PATCH',
      });
      if (!res.ok) throw new Error('Failed to complete transfer');
      await fetchTransfers();
    } catch (e: any) {
      alert(e.message || 'Error completing transfer');
    }
  };

  // Filter transfers list
  const filteredTransfers = useMemo(() => {
    return transfers.filter((t) => {
      // Status filter
      if (statusTab !== 'ALL' && t.status !== statusTab) {
        return false;
      }
      // Department filter
      if (deptFilter !== 'ALL') {
        if (t.fromDeptId !== deptFilter && t.toDeptId !== deptFilter) {
          return false;
        }
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchCode = t.asset?.assetCode?.toLowerCase().includes(q);
        const matchName = t.asset?.name?.toLowerCase().includes(q);
        const matchReason = t.reason?.toLowerCase().includes(q);
        const matchFrom = t.fromDept?.name?.toLowerCase().includes(q);
        const matchTo = t.toDept?.name?.toLowerCase().includes(q);
        const matchReq = t.requestedBy?.name?.toLowerCase().includes(q);
        return Boolean(
          matchCode || matchName || matchReason || matchFrom || matchTo || matchReq,
        );
      }
      return true;
    });
  }, [transfers, statusTab, deptFilter, searchQuery]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredTransfers.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const paginatedTransfers = useMemo(() => {
    return filteredTransfers.slice((safePage - 1) * pageSize, safePage * pageSize);
  }, [filteredTransfers, safePage, pageSize]);

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
      case 'PENDING':
        return (
          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[11px] gap-1">
            <Clock className="w-3 h-3" />
            <span>PENDING</span>
          </Badge>
        );
      case 'APPROVED':
        return (
          <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-500/30 text-[11px] gap-1">
            <Truck className="w-3 h-3" />
            <span>APPROVED</span>
          </Badge>
        );
      case 'COMPLETED':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[11px] gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>COMPLETED</span>
          </Badge>
        );
      case 'REJECTED':
        return (
          <Badge variant="destructive" className="text-[11px] gap-1">
            <XCircle className="w-3 h-3" />
            <span>REJECTED</span>
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="text-[11px]">
            {status}
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
              <ArrowLeftRight className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                Asset Transfers &amp; Relocations
              </h1>
              <p className="text-xs text-muted-foreground">
                Inter-department handovers, station relocations, approval workflows &amp; custody tracking
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={fetchTransfers}
            disabled={loading}
            className="h-9 w-9 shadow-2xs"
            title="Refresh Transfers"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>

          <Button
            onClick={() => {
              setFormError(null);
              setIsModalOpen(true);
            }}
            size="sm"
            className="gap-1.5 h-9 shadow-sm font-semibold"
          >
            <Plus className="w-4 h-4" />
            <span>Initiate Transfer</span>
          </Button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          KPI SUMMARY STATS CARDS
         ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="border bg-card shadow-2xs">
          <CardContent className="p-3.5 space-y-1 text-center">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
              Total Transfers
            </span>
            <span className="text-2xl font-extrabold text-foreground">
              {stats.total}
            </span>
            <p className="text-[10px] text-muted-foreground">All logged requests</p>
          </CardContent>
        </Card>

        <Card className="border bg-card shadow-2xs">
          <CardContent className="p-3.5 space-y-1 text-center">
            <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 tracking-wider block">
              Pending Approval
            </span>
            <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">
              {stats.pending}
            </span>
            <p className="text-[10px] text-muted-foreground">Requires manager review</p>
          </CardContent>
        </Card>

        <Card className="border bg-card shadow-2xs">
          <CardContent className="p-3.5 space-y-1 text-center">
            <span className="text-[10px] uppercase font-bold text-sky-600 dark:text-sky-400 tracking-wider block">
              Approved (In Transit)
            </span>
            <span className="text-2xl font-extrabold text-sky-600 dark:text-sky-400">
              {stats.approved}
            </span>
            <p className="text-[10px] text-muted-foreground">Ready for physical handover</p>
          </CardContent>
        </Card>

        <Card className="border bg-card shadow-2xs">
          <CardContent className="p-3.5 space-y-1 text-center">
            <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider block">
              Completed
            </span>
            <span className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400">
              {stats.completed}
            </span>
            <p className="text-[10px] text-muted-foreground">Handover finalized</p>
          </CardContent>
        </Card>

        <Card className="border bg-card shadow-2xs col-span-2 sm:col-span-1">
          <CardContent className="p-3.5 space-y-1 text-center">
            <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400 tracking-wider block">
              Rejected
            </span>
            <span className="text-2xl font-extrabold text-rose-600 dark:text-rose-400">
              {stats.rejected}
            </span>
            <p className="text-[10px] text-muted-foreground">Declined requests</p>
          </CardContent>
        </Card>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          STATUS TABS & QUICK FILTER BAR
         ───────────────────────────────────────────────────────────── */}
      <Card className="border bg-card shadow-2xs">
        <CardContent className="p-3 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Status Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { key: 'ALL', label: 'All Transfers', count: stats.total },
                { key: 'PENDING', label: 'Pending', count: stats.pending },
                { key: 'APPROVED', label: 'In Transit', count: stats.approved },
                { key: 'COMPLETED', label: 'Completed', count: stats.completed },
                { key: 'REJECTED', label: 'Rejected', count: stats.rejected },
              ].map((tab) => (
                <Button
                  key={tab.key}
                  variant={statusTab === tab.key ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    setStatusTab(tab.key);
                    setPage(1);
                  }}
                  className={`h-8 text-xs font-semibold rounded-lg ${
                    statusTab === tab.key ? 'shadow-xs' : 'text-muted-foreground'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className="ml-1.5 text-[10px] px-1.5 py-0.2 rounded-full bg-background/20 font-mono">
                    {tab.count}
                  </span>
                </Button>
              ))}
            </div>

            {/* Department Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium shrink-0">Department:</span>
              <select
                className="h-8 px-2.5 rounded-lg border bg-background text-xs font-semibold text-foreground focus:ring-1 focus:ring-primary/20"
                value={deptFilter}
                onChange={(e) => {
                  setDeptFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by asset code, equipment name, transfer reason, requester..."
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
          TRANSFERS RECONCILIATION TABLE & PAGINATION
         ───────────────────────────────────────────────────────────── */}
      {loading ? (
        <Card className="p-12 text-center flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Loading asset transfers...</p>
        </Card>
      ) : error ? (
        <Card className="p-8 text-center border-destructive/40 bg-destructive/5 space-y-3">
          <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
          <p className="text-sm font-semibold text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchTransfers} className="gap-1.5">
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </Button>
        </Card>
      ) : transfers.length === 0 ? (
        <Card className="border-dashed p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
            <ArrowLeftRight className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-base text-foreground">No Transfer Requests Yet</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Log inter-department movements, equipment handovers, or physical station relocations with full management approval tracking.
          </p>
          <div className="pt-2">
            <Button
              size="sm"
              onClick={() => setIsModalOpen(true)}
              className="gap-1.5 shadow-sm font-semibold"
            >
              <Plus className="w-4 h-4" />
              <span>Initiate First Transfer</span>
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 text-[11px]">
                  <TableHead className="w-[120px]">Asset Code</TableHead>
                  <TableHead>Equipment Details</TableHead>
                  <TableHead>Transfer Route (Origin &rarr; Target)</TableHead>
                  <TableHead>Reason &amp; Purpose</TableHead>
                  <TableHead className="w-[110px]">Status</TableHead>
                  <TableHead>Requested By</TableHead>
                  <TableHead className="w-[150px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTransfers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-foreground">No Matching Transfers</p>
                        <p className="text-[11px]">No requests match your active search and status filters.</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSearchQuery('');
                            setStatusTab('ALL');
                            setDeptFilter('ALL');
                          }}
                          className="h-7 text-xs mt-2"
                        >
                          Clear Filters
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedTransfers.map((item) => {
                    // Check if location info is encoded in notes: [TO_LOC:cmvx...:Location Name]
                    const locMatch = item.notes?.match(/\[TO_LOC:([^:]+):([^\]]+)\]/);
                    const targetLocName = locMatch ? locMatch[2] : null;

                    return (
                      <TableRow key={item.id} className="text-xs hover:bg-muted/30">
                        {/* Asset Code */}
                        <TableCell className="font-mono font-semibold text-primary">
                          <Link
                            href={`/assets?code=${item.asset?.assetCode}`}
                            className="hover:underline flex items-center gap-1"
                            title="View Asset in Inventory"
                          >
                            <span>{item.asset?.assetCode}</span>
                          </Link>
                        </TableCell>

                        {/* Equipment Details */}
                        <TableCell>
                          <div className="font-medium text-foreground">{item.asset?.name}</div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                            {item.asset?.category && <span>{item.asset.category.name}</span>}
                            {item.asset?.location && (
                              <span className="flex items-center gap-0.5">
                                <Building className="w-2.5 h-2.5" />
                                <span>{item.asset.location.name}</span>
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* Transfer Route */}
                        <TableCell className="text-xs">
                          <div className="space-y-1">
                            {/* Department Route */}
                            <div className="flex items-center gap-1.5 text-[11px] font-medium">
                              <span className="text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                {item.fromDept?.name || 'Unassigned Dept'}
                              </span>
                              <ArrowRight className="w-3.5 h-3.5 text-primary shrink-0" />
                              <span className="text-foreground font-semibold bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                                {item.toDept?.name || 'Same Department'}
                              </span>
                            </div>

                            {/* Location / Station Relocation (if applicable) */}
                            {targetLocName && (
                              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                                <span>Station: &rarr; <strong>{targetLocName}</strong></span>
                              </div>
                            )}
                          </div>
                        </TableCell>

                        {/* Reason & Notes */}
                        <TableCell className="text-[11px] text-muted-foreground max-w-xs">
                          <p className="line-clamp-2 text-foreground font-medium">
                            {item.reason || item.notes || 'No description provided'}
                          </p>
                        </TableCell>

                        {/* Status */}
                        <TableCell>{getStatusBadge(item.status)}</TableCell>

                        {/* Requested By */}
                        <TableCell className="text-[11px] text-muted-foreground">
                          <div className="font-medium text-foreground">
                            {item.requestedBy?.name || 'System Admin'}
                          </div>
                          <div className="text-[10px] flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>
                              {new Date(item.requestedAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: '2-digit',
                                year: 'numeric',
                              })}
                            </span>
                          </div>
                        </TableCell>

                        {/* Action Buttons */}
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {item.status === 'PENDING' && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    setActionModal({
                                      type: 'approve',
                                      transfer: item,
                                      notes: 'Approved transfer request.',
                                    })
                                  }
                                  className="h-7 px-2 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1 shadow-2xs"
                                  title="Approve this transfer"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Approve</span>
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    setActionModal({
                                      type: 'reject',
                                      transfer: item,
                                      notes: '',
                                    })
                                  }
                                  className="h-7 px-2 text-[11px] text-destructive hover:bg-destructive/10 border-destructive/30 gap-1"
                                  title="Reject this transfer"
                                >
                                  <X className="w-3 h-3" />
                                  <span>Reject</span>
                                </Button>
                              </>
                            )}

                            {item.status === 'APPROVED' && (
                              <Button
                                size="sm"
                                onClick={() => handleComplete(item.id)}
                                className="h-7 px-2.5 text-[11px] bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-1 shadow-2xs"
                                title="Confirm physical handover and complete transfer"
                              >
                                <Truck className="w-3 h-3" />
                                <span>Complete</span>
                              </Button>
                            )}

                            {item.status === 'COMPLETED' && (
                              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Finalized</span>
                              </span>
                            )}

                            {item.status === 'REJECTED' && (
                              <span className="text-[11px] text-muted-foreground italic">
                                Declined
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
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
                  {filteredTransfers.length === 0 ? 0 : (safePage - 1) * pageSize + 1}
                </strong>{' '}
                to{' '}
                <strong className="text-foreground">
                  {Math.min(safePage * pageSize, filteredTransfers.length)}
                </strong>{' '}
                of <strong className="text-foreground">{filteredTransfers.length}</strong>{' '}
                {filteredTransfers.length !== transfers.length
                  ? `(filtered from ${transfers.length} records)`
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
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
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

      {/* ─────────────────────────────────────────────────────────────
          MODAL: INITIATE ASSET TRANSFER
         ───────────────────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-card border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 sm:p-5 border-b flex items-center justify-between bg-muted/20">
              <div className="space-y-0.5">
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  <ArrowLeftRight className="w-4 h-4 text-primary" />
                  <span>Initiate Asset Transfer</span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Reallocate custody to another department or physical station
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsModalOpen(false)}
                className="h-8 w-8 text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <form onSubmit={handleCreateTransfer} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
              {formError && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-medium">
                  {formError}
                </div>
              )}

              {/* Step 1: Select Equipment Asset */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <Boxes className="w-3.5 h-3.5 text-primary" />
                  <span>Equipment Tag / Asset</span>
                </label>

                {formSelectedAsset ? (
                  <div className="p-3 rounded-xl border bg-primary/5 border-primary/20 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="font-mono font-bold text-xs text-primary flex items-center gap-1.5">
                        <span>{formSelectedAsset.assetCode}</span>
                        {formSelectedAsset.sapAssetCode && (
                          <span className="text-[10px] text-muted-foreground">
                            (SAP: {formSelectedAsset.sapAssetCode})
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-medium text-foreground">
                        {formSelectedAsset.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-2 pt-0.5">
                        <span>Current Station: {formSelectedAsset.location?.name || 'Unassigned'}</span>
                        <span>•</span>
                        <span>Dept: {formSelectedAsset.department?.name || 'Unassigned'}</span>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFormSelectedAsset(null);
                        setFormAssetQuery('');
                      }}
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-1 relative">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Search by asset tag or machinery name..."
                        value={formAssetQuery}
                        onChange={(e) => handleSearchAsset(e.target.value)}
                        className="pl-9 text-xs font-mono"
                        autoFocus
                      />
                      {assetSearching && (
                        <Loader2 className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-primary" />
                      )}
                    </div>

                    {/* Autocomplete Dropdown */}
                    {assetSearchResults.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-card border rounded-xl shadow-xl overflow-hidden z-50 max-h-48 overflow-y-auto divide-y">
                        {assetSearchResults.map((asset) => (
                          <div
                            key={asset.id}
                            onClick={() => {
                              setFormSelectedAsset(asset);
                              setAssetSearchResults([]);
                            }}
                            className="p-2.5 hover:bg-muted/50 cursor-pointer text-xs space-y-0.5 transition-colors"
                          >
                            <div className="font-mono font-bold text-primary flex items-center justify-between">
                              <span>{asset.assetCode}</span>
                              <span className="text-[10px] font-normal text-muted-foreground">
                                {asset.location?.name || 'Unassigned Station'}
                              </span>
                            </div>
                            <div className="font-medium text-foreground truncate">
                              {asset.name}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Step 2: Target Destination Department */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <Building className="w-3.5 h-3.5 text-primary" />
                  <span>Destination Department</span>
                </label>
                <select
                  className="w-full h-9 px-3 rounded-lg border bg-background text-xs font-semibold text-foreground focus:ring-2 focus:ring-primary/20"
                  value={formToDeptId}
                  onChange={(e) => setFormToDeptId(e.target.value)}
                >
                  <option value="">-- Keep Current Department --</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} {d.code ? `(${d.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 3: Optional Physical Station Relocation */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                  <span>Destination Location / Station (Optional)</span>
                </label>
                <select
                  className="w-full h-9 px-3 rounded-lg border bg-background text-xs font-semibold text-foreground focus:ring-2 focus:ring-primary/20"
                  value={formToLocationId}
                  onChange={(e) => setFormToLocationId(e.target.value)}
                >
                  <option value="">-- Keep Current Station --</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.code})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-muted-foreground">
                  If selected, the machinery&apos;s physical station will be relocated automatically upon completion.
                </p>
              </div>

              {/* Step 4: Transfer Justification / Reason */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Transfer Justification / Reason
                </label>
                <textarea
                  className="w-full p-2.5 rounded-lg border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 min-h-[70px]"
                  placeholder="e.g., Physical audit discrepancy resolution, project reallocation, maintenance handover..."
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting || !formSelectedAsset}
                  className="font-semibold gap-1.5"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Submit Transfer Request</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: APPROVE / REJECT TRANSFER DIALOG
         ───────────────────────────────────────────────────────────── */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-card border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 sm:p-5 border-b flex items-center justify-between bg-muted/20">
              <div className="space-y-0.5">
                <h3 className="font-bold text-base text-foreground flex items-center gap-1.5">
                  {actionModal.type === 'approve' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Approve Asset Transfer</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-destructive" />
                      <span>Reject Asset Transfer</span>
                    </>
                  )}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Asset: <strong>{actionModal.transfer.asset?.assetCode}</strong> (
                  {actionModal.transfer.asset?.name})
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setActionModal(null)}
                className="h-8 w-8 text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="p-4 sm:p-5 space-y-3 text-xs">
              <div className="p-2.5 rounded-lg bg-muted/30 border space-y-1">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Target Department:</span>
                  <strong className="text-foreground">
                    {actionModal.transfer.toDept?.name || 'Unassigned'}
                  </strong>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Requester:</span>
                  <span className="text-foreground">
                    {actionModal.transfer.requestedBy?.name || 'System Admin'}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground block">
                  {actionModal.type === 'approve'
                    ? 'Approval Notes (Optional)'
                    : 'Rejection Reason (Mandatory)'}
                </label>
                <textarea
                  className="w-full p-2.5 rounded-lg border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 min-h-[70px]"
                  placeholder={
                    actionModal.type === 'approve'
                      ? 'Add any handover instructions or notes...'
                      : 'Provide justification why this transfer is declined...'
                  }
                  value={actionModal.notes}
                  onChange={(e) =>
                    setActionModal({ ...actionModal, notes: e.target.value })
                  }
                  autoFocus
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActionModal(null)}
                  disabled={isActionSubmitting}
                >
                  Cancel
                </Button>
                {actionModal.type === 'approve' ? (
                  <Button
                    size="sm"
                    onClick={handleApprove}
                    disabled={isActionSubmitting}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1"
                  >
                    {isActionSubmitting && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    )}
                    <span>Confirm Approval</span>
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleReject}
                    disabled={isActionSubmitting || !actionModal.notes.trim()}
                    className="font-semibold gap-1"
                  >
                    {isActionSubmitting && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    )}
                    <span>Confirm Rejection</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
