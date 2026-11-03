'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ClipboardCheck,
  QrCode,
  Calendar,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  RotateCcw,
  Boxes,
  FileCheck,
  Plus,
  Trash2,
  Building,
  Clock,
  User,
  X,
  Layers,
  Sparkles,
  Lock,
  MapPin,
  Search,
  BarChart3,
  ArrowLeftRight,
  Wrench,
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

interface AuditSession {
  id: string;
  planId: string;
  auditorId: string;
  locationId?: string | null;
  status: string;
  startedAt?: string | null;
  submittedAt?: string | null;
  notes?: string | null;
  auditor?: { id: string; name: string; email: string };
  location?: { id: string; name: string; code?: string; type?: string } | null;
  _count?: { items: number; discrepancies: number };
}

interface AuditPlanDetails {
  id: string;
  name: string;
  description?: string | null;
  type: string;
  status: string;
  scheduledDate?: string | null;
  scopeType?: string;
  scopeIds?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; name: string; email: string };
  sessions: AuditSession[];
  scopedLocations?: Array<{
    id: string;
    name: string;
    code?: string;
    type?: string;
    parentId?: string | null;
  }>;
}

interface AuditItem {
  id: string;
  sessionId: string;
  assetId: string;
  status: string;
  condition?: string | null;
  notes?: string | null;
  scannedAt?: string | null;
  asset: {
    id: string;
    name: string;
    assetCode: string;
    serialNumber?: string | null;
    model?: string | null;
    qrCode?: string | null;
  };
  expectedLocation?: { id: string; name: string; code?: string } | null;
  foundLocation?: { id: string; name: string; code?: string } | null;
  discrepancy?: {
    id: string;
    discrepancyType: string;
    resolvedAt?: string | null;
  } | null;
}

interface LocationOption {
  id: string;
  name: string;
  code: string;
  type: string;
  parentId?: string | null;
  parent?: { id: string; name: string; code?: string; type?: string } | null;
}

export default function AuditPlanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const planId = params?.id as string;

  const [plan, setPlan] = useState<AuditPlanDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected active session & items
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionItems, setSessionItems] = useState<AuditItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Checklist Pagination & Filtering
  const [checklistPage, setChecklistPage] = useState(1);
  const [checklistPageSize, setChecklistPageSize] = useState(10);
  const [checklistSearch, setChecklistSearch] = useState('');
  const [checklistStatusFilter, setChecklistStatusFilter] = useState('ALL');

  // Filtered and Paginated Checklist Items
  const filteredSessionItems = sessionItems.filter((item) => {
    if (checklistStatusFilter !== 'ALL' && item.status !== checklistStatusFilter) {
      return false;
    }
    if (checklistSearch.trim()) {
      const q = checklistSearch.toLowerCase().trim();
      const matchCode = item.asset.assetCode?.toLowerCase().includes(q);
      const matchName = item.asset.name?.toLowerCase().includes(q);
      const matchExpected = item.expectedLocation?.name?.toLowerCase().includes(q);
      const matchFound = item.foundLocation?.name?.toLowerCase().includes(q);
      return Boolean(matchCode || matchName || matchExpected || matchFound);
    }
    return true;
  });

  const totalChecklistPages = Math.max(
    1,
    Math.ceil(filteredSessionItems.length / checklistPageSize),
  );
  const safeChecklistPage = Math.min(Math.max(1, checklistPage), totalChecklistPages);

  const paginatedSessionItems = filteredSessionItems.slice(
    (safeChecklistPage - 1) * checklistPageSize,
    safeChecklistPage * checklistPageSize,
  );

  const handleChecklistPageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalChecklistPages) return;
    setChecklistPage(newPage);
  };

  const getChecklistPageNumbers = () => {
    if (totalChecklistPages <= 5) {
      return Array.from({ length: totalChecklistPages }, (_, i) => i + 1);
    }
    const pages: (number | string)[] = [];
    if (safeChecklistPage <= 3) {
      pages.push(1, 2, 3, '…', totalChecklistPages);
    } else if (safeChecklistPage >= totalChecklistPages - 2) {
      pages.push(1, '…', totalChecklistPages - 2, totalChecklistPages - 1, totalChecklistPages);
    } else {
      pages.push(1, '…', safeChecklistPage, '…', totalChecklistPages);
    }
    return pages;
  };

  // Create session modal state
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [isSubmittingSession, setIsSubmittingSession] = useState(false);
  const [sessionFormError, setSessionFormError] = useState<string | null>(null);
  const [sessionForm, setSessionForm] = useState({
    locationId: '',
    notes: '',
  });

  const fetchPlanDetails = async () => {
    if (!planId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/audits/plans/${planId}`);
      if (!res.ok) {
        throw new Error(`Failed to load audit plan (${res.status})`);
      }
      const json = await res.json();
      const planData: AuditPlanDetails = json?.data !== undefined ? json.data : json;
      setPlan(planData);

      // Auto-select first session if available
      if (planData.sessions && planData.sessions.length > 0) {
        const firstSessionId = planData.sessions[0].id;
        setSelectedSessionId((prev) => prev || firstSessionId);
        fetchSessionItems(firstSessionId);
      }
    } catch (err: any) {
      console.error('Error fetching plan:', err);
      setError(err?.message || 'Could not load plan details');
    } finally {
      setLoading(false);
    }
  };

  const fetchSessionItems = async (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setChecklistPage(1);
    setChecklistSearch('');
    setChecklistStatusFilter('ALL');
    setLoadingItems(true);
    try {
      const res = await fetch(`/api/audits/sessions/${sessionId}/items`);
      if (res.ok) {
        const json = await res.json();
        const items: AuditItem[] = Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json)
          ? json
          : [];
        setSessionItems(items);
      }
    } catch (err) {
      console.error('Error fetching session items:', err);
    } finally {
      setLoadingItems(false);
    }
  };

  const fetchLocations = async () => {
    try {
      const res = await fetch('/api/locations');
      if (res.ok) {
        const json = await res.json();
        const list: LocationOption[] = Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json)
          ? json
          : [];
        setLocations(list);
      }
    } catch (e) {
      console.error('Failed to load locations:', e);
    }
  };

  useEffect(() => {
    fetchPlanDetails();
    fetchLocations();
  }, [planId]);

  // Filter session locations based on the audit plan's location scope (parent company, unit, or block)
  const { sessionLocations, planLocationName, isCompanyAudit, planScopeType } = useMemo(() => {
    if (!plan) {
      return {
        sessionLocations: locations,
        planLocationName: null,
        isCompanyAudit: false,
        planScopeType: 'ALL',
      };
    }

    if (plan.scopeType !== 'LOCATION' || !plan.scopeIds) {
      return {
        sessionLocations: locations,
        planLocationName: null,
        isCompanyAudit: false,
        planScopeType: plan.scopeType || 'ALL',
      };
    }

    let scopeIds: string[] = [];
    try {
      const parsed = JSON.parse(plan.scopeIds);
      scopeIds = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      scopeIds = [plan.scopeIds];
    }

    if (scopeIds.length === 0) {
      return {
        sessionLocations: locations,
        planLocationName: null,
        isCompanyAudit: false,
        planScopeType: 'ALL',
      };
    }

    const locMap = new Map<string, LocationOption>();
    locations.forEach((loc) => locMap.set(loc.id, loc));

    // Find the scoped locations in the plan
    let scopedLocs = scopeIds.map((id) => locMap.get(id)).filter(Boolean) as LocationOption[];
    if (scopedLocs.length === 0 && plan.scopedLocations && plan.scopedLocations.length > 0) {
      scopedLocs = plan.scopedLocations as LocationOption[];
    }
    const isCompany = scopedLocs.some((l) => l.type === 'COMPANY');
    const scopeNames = scopedLocs
      .map((l) => (l.code && l.code !== l.name ? `${l.name} (${l.code})` : l.name))
      .join(', ');

    // Find all descendant location IDs under any of the scopeIds
    const allowedLocIds = new Set<string>(scopeIds);
    let added = true;
    while (added) {
      added = false;
      for (const loc of locations) {
        if (loc.parentId && allowedLocIds.has(loc.parentId) && !allowedLocIds.has(loc.id)) {
          allowedLocIds.add(loc.id);
          added = true;
        }
      }
    }

    // Filter to only locations belonging to the plan's location scope
    const filtered = locations.filter((loc) => allowedLocIds.has(loc.id));

    return {
      sessionLocations: filtered,
      planLocationName:
        scopeNames ||
        (plan.scopedLocations && plan.scopedLocations.length > 0
          ? plan.scopedLocations.map((l) => l.name).join(', ')
          : null),
      isCompanyAudit: isCompany,
      planScopeType: 'LOCATION',
    };
  }, [plan, locations]);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingSession(true);
    setSessionFormError(null);

    try {
      const payload = {
        planId,
        auditorId: 'admin',
        locationId: sessionForm.locationId || undefined,
        notes: sessionForm.notes.trim() || undefined,
      };

      const res = await fetch('/api/audits/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Failed to create session (${res.status})`);
      }

      setIsSessionModalOpen(false);
      setSessionForm({ locationId: '', notes: '' });
      await fetchPlanDetails();
    } catch (err: any) {
      console.error('Error creating session:', err);
      setSessionFormError(err.message || 'Could not start session');
    } finally {
      setIsSubmittingSession(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this audit session and its checklist?')) {
      return;
    }
    try {
      const res = await fetch(`/api/audits/sessions/${sessionId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete session');
      await fetchPlanDetails();
      if (selectedSessionId === sessionId) {
        setSelectedSessionId(null);
        setSessionItems([]);
      }
    } catch (e: any) {
      alert(e.message || 'Could not delete session');
    }
  };

  const handleCompleteSession = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/audits/sessions/${sessionId}/complete`, {
        method: 'PUT',
      });
      if (!res.ok) {
        throw new Error('Failed to mark session as complete');
      }
      await fetchPlanDetails();
    } catch (e: any) {
      alert(e.message || 'Could not complete session');
    }
  };

  const handleReopenSession = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/audits/sessions/${sessionId}/reopen`, {
        method: 'PUT',
      });
      if (!res.ok) {
        throw new Error('Failed to reopen session');
      }
      await fetchPlanDetails();
    } catch (e: any) {
      alert(e.message || 'Could not reopen session');
    }
  };

  const handleDeletePlan = async () => {
    if (!plan) return;
    if (!confirm(`Are you sure you want to delete audit plan "${plan.name}" and all sessions?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/audits/plans/${planId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete audit plan');
      router.push('/audits');
    } catch (e: any) {
      alert(e.message || 'Could not delete plan');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge variant="success">COMPLETED</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="warning">IN PROGRESS</Badge>;
      case 'SCHEDULED':
        return (
          <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-500/30">
            SCHEDULED
          </Badge>
        );
      case 'CANCELLED':
        return <Badge variant="destructive">CANCELLED</Badge>;
      default:
        return <Badge variant="secondary">{status || 'DRAFT'}</Badge>;
    }
  };

  const getItemStatusBadge = (status: string) => {
    switch (status) {
      case 'VERIFIED':
        return <Badge variant="success">VERIFIED</Badge>;
      case 'MISMATCH':
        return <Badge variant="warning">MISMATCH</Badge>;
      case 'DAMAGED':
        return <Badge variant="destructive">DAMAGED</Badge>;
      case 'MISSING':
        return <Badge variant="destructive">MISSING</Badge>;
      default:
        return <Badge variant="outline">PENDING</Badge>;
    }
  };

  if (loading) {
    return (
      <Card className="p-12 text-center flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-xs sm:text-sm text-muted-foreground">Loading audit plan details...</p>
      </Card>
    );
  }

  if (error || !plan) {
    return (
      <Card className="border-destructive/40 bg-destructive/5 p-6 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
        <p className="text-sm font-semibold text-destructive">{error || 'Plan not found'}</p>
        <Link href="/audits">
          <Button variant="outline" size="sm" className="gap-1.5">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Audits</span>
          </Button>
        </Link>
      </Card>
    );
  }

  // Calculate totals across sessions
  const totalChecklistItems = plan.sessions.reduce(
    (acc, s) => acc + (s._count?.items || 0),
    0
  );
  const totalDiscrepancies = plan.sessions.reduce(
    (acc, s) => acc + (s._count?.discrepancies || 0),
    0
  );

  return (
    <div className="space-y-4">
      {/* Top Navigation & Action Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link href="/audits">
              <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2 text-muted-foreground">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <h1 className="text-lg sm:text-2xl font-bold tracking-tight">{plan.name}</h1>
            {getStatusBadge(plan.status)}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground pl-6">
            <span className="flex items-center gap-1 font-medium text-foreground">
              <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                {plan.type}
              </Badge>
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                {plan.scheduledDate
                  ? new Date(plan.scheduledDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: '2-digit',
                      year: 'numeric',
                    })
                  : 'Unscheduled'}
              </span>
            </span>
            <span className="flex items-center gap-1">
              <Building className="w-3.5 h-3.5 text-primary" />
              <span>
                Scope: {plan.scopeType || 'ALL'}
                {plan.scopeType === 'LOCATION' && planLocationName && (
                  <span className="font-semibold text-foreground ml-1">
                    ({planLocationName})
                  </span>
                )}
              </span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1 sm:pt-0">
          <Link href={`/reports?planId=${plan.id}`}>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-10 shadow-2xs font-medium"
              title="View Audit Status & Compliance Report"
            >
              <BarChart3 className="w-4 h-4 text-primary" />
              <span>Status Report</span>
            </Button>
          </Link>

          <Button
            variant="outline"
            size="icon"
            onClick={fetchPlanDetails}
            className="h-10 w-10 shadow-2xs"
            title="Refresh"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>

          <Button
            onClick={() => setIsSessionModalOpen(true)}
            size="sm"
            className="gap-1.5 h-10 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Start Session</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleDeletePlan}
            className="h-10 w-10 text-muted-foreground hover:text-destructive"
            title="Delete Plan"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Description / Scope Card */}
      {plan.description && (
        <div className="p-3 rounded-xl border bg-muted/20 text-xs text-muted-foreground flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold text-foreground block">Plan Objectives:</span>
            <span>{plan.description}</span>
          </div>
        </div>
      )}

      {/* Stats Summary Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-xl border bg-card text-center">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
            Audit Sessions
          </span>
          <span className="text-xl font-bold text-foreground">{plan.sessions.length}</span>
        </div>
        <div className="p-3 rounded-xl border bg-card text-center">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
            Expected Assets
          </span>
          <span className="text-xl font-bold text-primary">{totalChecklistItems}</span>
        </div>
        <div className="p-3 rounded-xl border bg-card text-center">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
            Flagged Issues
          </span>
          <span className="text-xl font-bold text-amber-600">{totalDiscrepancies}</span>
        </div>
        <div className="p-3 rounded-xl border bg-card text-center">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
            Target Date
          </span>
          <span className="text-sm sm:text-base font-bold text-foreground">
            {plan.scheduledDate
              ? new Date(plan.scheduledDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: '2-digit',
                })
              : 'Flexible'}
          </span>
        </div>
      </div>

      {/* Main Grid: Sessions on Left / Active Session Checklist on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column: Sessions List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm tracking-tight flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-primary" />
              <span>Active Sessions ({plan.sessions.length})</span>
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsSessionModalOpen(true)}
              className="h-8 gap-1 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New</span>
            </Button>
          </div>

          {plan.sessions.length === 0 ? (
            <Card className="border-dashed p-6 text-center space-y-2">
              <ClipboardCheck className="w-8 h-8 text-muted-foreground/60 mx-auto" />
              <p className="text-xs font-medium text-foreground">No Sessions Created Yet</p>
              <p className="text-[11px] text-muted-foreground">
                Start a session to generate the physical inventory checklist for mobile scanning.
              </p>
              <Button
                size="sm"
                onClick={() => setIsSessionModalOpen(true)}
                className="gap-1.5 h-8 text-xs mt-2"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Start First Session</span>
              </Button>
            </Card>
          ) : (
            <div className="space-y-2.5">
              {plan.sessions.map((sess) => {
                const isSelected = sess.id === selectedSessionId;
                return (
                  <Card
                    key={sess.id}
                    onClick={() => fetchSessionItems(sess.id)}
                    className={`cursor-pointer transition-all ${
                      isSelected
                        ? 'border-primary ring-1 ring-primary/40 bg-primary/5 shadow-xs'
                        : 'hover:border-border hover:bg-muted/30'
                    }`}
                  >
                    <CardContent className="p-3.5 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <span className="font-semibold text-xs sm:text-sm text-foreground flex items-center gap-1.5">
                            <Building className="w-3.5 h-3.5 text-primary" />
                            <span>{sess.location?.name || 'All Scoped Locations'}</span>
                          </span>
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <User className="w-3 h-3" />
                            <span>Auditor: {sess.auditor?.name || 'Assigned Staff'}</span>
                          </span>
                        </div>
                        <Badge
                          variant={
                            sess.status === 'IN_PROGRESS'
                              ? 'warning'
                              : sess.status === 'SUBMITTED'
                              ? 'success'
                              : 'secondary'
                          }
                          className="text-[10px]"
                        >
                          {sess.status}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
                        <span className="font-medium text-foreground">
                          {sess._count?.items || 0} Assets Loaded
                        </span>
                        {sess._count?.discrepancies ? (
                          <span className="text-amber-600 font-semibold text-[11px]">
                            {sess._count.discrepancies} Discrepancies
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-center justify-between gap-1.5 pt-1">
                        <div>
                          {sess.status === 'COMPLETED' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleReopenSession(sess.id);
                              }}
                              className="h-8 gap-1 text-[11px] text-muted-foreground hover:text-primary"
                              title="Reopen session for further scanning"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Reopen</span>
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCompleteSession(sess.id);
                              }}
                              className="h-8 gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                              title="Mark session scan as completed"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Mark Complete</span>
                            </Button>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {sess.status === 'COMPLETED' ? (
                            <Button
                              size="sm"
                              disabled
                              variant="outline"
                              className="h-8 gap-1.5 text-xs opacity-60 cursor-not-allowed bg-muted/30 text-muted-foreground"
                              title="Session completed - Reopen to scan"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              <span>Completed</span>
                            </Button>
                          ) : (
                            <Link href={`/scan?sessionId=${sess.id}&planId=${plan.id}`}>
                              <Button size="sm" className="h-8 gap-1.5 text-xs shadow-2xs">
                                <QrCode className="w-3.5 h-3.5" />
                                <span>Scanner</span>
                              </Button>
                            </Link>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSession(sess.id);
                            }}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            title="Delete Session"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Pre-Populated Checklist & Scan Status Table */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm tracking-tight flex items-center gap-1.5">
                <Boxes className="w-4 h-4 text-primary" />
                <span>Session Inventory Checklist ({sessionItems.length})</span>
              </h2>
              {plan.sessions.find((s) => s.id === selectedSessionId) && (
                <Badge
                  variant={
                    plan.sessions.find((s) => s.id === selectedSessionId)?.status === 'COMPLETED'
                      ? 'success'
                      : plan.sessions.find((s) => s.id === selectedSessionId)?.status === 'IN_PROGRESS'
                      ? 'warning'
                      : 'secondary'
                  }
                  className="text-[10px]"
                >
                  {plan.sessions.find((s) => s.id === selectedSessionId)?.status}
                </Badge>
              )}
            </div>

            {selectedSessionId && (
              <div className="flex items-center gap-2">
                {plan.sessions.find((s) => s.id === selectedSessionId)?.status === 'COMPLETED' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleReopenSession(selectedSessionId)}
                    className="h-8 gap-1 text-xs text-muted-foreground hover:text-primary"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reopen Session</span>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCompleteSession(selectedSessionId)}
                    className="h-8 gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 shadow-2xs font-semibold"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Mark Complete</span>
                  </Button>
                )}

                {plan.sessions.find((s) => s.id === selectedSessionId)?.status === 'COMPLETED' ? (
                  <Button
                    size="sm"
                    disabled
                    variant="outline"
                    className="gap-1.5 h-8 text-xs opacity-60 cursor-not-allowed bg-muted/30 text-muted-foreground"
                    title="Session completed - Reopen to scan"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Session Locked</span>
                  </Button>
                ) : (
                  <Link href={`/scan?sessionId=${selectedSessionId}&planId=${plan.id}`}>
                    <Button size="sm" className="gap-1.5 h-8 text-xs shadow-sm">
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Scan in Session</span>
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </div>

          {/* Search & Quick Filter Subbar */}
          {selectedSessionId && sessionItems.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2.5 p-2 rounded-xl border bg-card">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Filter by code, name, location..."
                  value={checklistSearch}
                  onChange={(e) => {
                    setChecklistSearch(e.target.value);
                    setChecklistPage(1);
                  }}
                  className="h-8 pl-8 text-xs font-mono"
                />
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-[11px] text-muted-foreground font-medium">Status:</span>
                <select
                  className="h-8 px-2 rounded-lg border bg-background text-xs font-semibold text-foreground focus:ring-1 focus:ring-primary/20"
                  value={checklistStatusFilter}
                  onChange={(e) => {
                    setChecklistStatusFilter(e.target.value);
                    setChecklistPage(1);
                  }}
                >
                  <option value="ALL">All Statuses ({sessionItems.length})</option>
                  <option value="VERIFIED">VERIFIED</option>
                  <option value="MISMATCH">MISMATCH</option>
                  <option value="DAMAGED">DAMAGED</option>
                  <option value="MISSING">MISSING</option>
                  <option value="PENDING">PENDING</option>
                </select>

                {(checklistSearch || checklistStatusFilter !== 'ALL') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setChecklistSearch('');
                      setChecklistStatusFilter('ALL');
                      setChecklistPage(1);
                    }}
                    className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Reset
                  </Button>
                )}
              </div>
            </div>
          )}

          {!selectedSessionId ? (
            <Card className="border-dashed p-10 text-center">
              <p className="text-xs text-muted-foreground">
                Select or create an audit session to view its asset checklist.
              </p>
            </Card>
          ) : loadingItems ? (
            <Card className="p-8 text-center flex flex-col items-center justify-center space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Loading checklist items...</p>
            </Card>
          ) : sessionItems.length === 0 ? (
            <Card className="border-dashed p-8 text-center space-y-2">
              <Boxes className="w-8 h-8 text-muted-foreground/60 mx-auto" />
              <p className="text-xs font-semibold text-foreground">No Assets In Scope</p>
              <p className="text-[11px] text-muted-foreground">
                No active assets currently match the location or scope filters of this session.
              </p>
            </Card>
          ) : (
            <Card className="overflow-hidden border bg-card">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 text-[11px]">
                      <TableHead className="w-[120px]">Asset Code</TableHead>
                      <TableHead>Asset Name</TableHead>
                      <TableHead className="w-[130px]">Expected Location</TableHead>
                      <TableHead className="w-[140px]">Physical Location</TableHead>
                      <TableHead className="w-[100px]">Audit Status</TableHead>
                      <TableHead className="w-[90px]">Condition</TableHead>
                      <TableHead className="w-[140px] text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSessionItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-foreground">No matching assets found</p>
                            <p className="text-[11px]">Try adjusting your search query or status filter.</p>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setChecklistSearch('');
                                setChecklistStatusFilter('ALL');
                                setChecklistPage(1);
                              }}
                              className="h-7 text-xs mt-2"
                            >
                              Clear Filter
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedSessionItems.map((item) => (
                        <TableRow key={item.id} className="text-xs hover:bg-muted/30">
                          <TableCell className="font-mono font-semibold text-primary">
                            {item.asset.assetCode}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">{item.asset.name}</div>
                            {item.asset.model && (
                              <div className="text-[10px] text-muted-foreground">
                                {item.asset.model}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-[11px]">
                            <span className="flex items-center gap-1">
                              <Building className="w-3 h-3 text-muted-foreground shrink-0" />
                              <span>{item.expectedLocation?.name || 'Unassigned'}</span>
                            </span>
                          </TableCell>
                          <TableCell className="text-[11px]">
                            {item.foundLocation ? (
                              <div className="space-y-0.5">
                                <span className="font-semibold text-foreground flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                  <span>{item.foundLocation.name}</span>
                                  {item.foundLocation.code && (
                                    <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1 rounded">
                                      {item.foundLocation.code}
                                    </span>
                                  )}
                                </span>
                                {item.expectedLocation &&
                                  item.foundLocation.id !== item.expectedLocation.id && (
                                    <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3 shrink-0" />
                                      <span>Relocated</span>
                                    </span>
                                  )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground italic text-[11px]">
                                Not scanned yet
                              </span>
                            )}
                          </TableCell>
                          <TableCell>{getItemStatusBadge(item.status)}</TableCell>
                          <TableCell className="text-[11px] font-medium">
                            {item.condition || '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {item.status === 'MISMATCH' && (
                                <Link
                                  href={`/transfers?code=${item.asset.assetCode}${
                                    item.foundLocation ? `&toLocationId=${item.foundLocation.id}` : ''
                                  }`}
                                >
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2 text-[11px] gap-1 border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 hover:text-amber-800"
                                    title={`Initiate transfer for mismatched asset ${item.asset.assetCode}`}
                                  >
                                    <ArrowLeftRight className="w-3 h-3" />
                                    <span>Transfer</span>
                                  </Button>
                                </Link>
                              )}
                              {(item.status === 'DAMAGED' || item.condition === 'DAMAGED' || item.condition === 'POOR') && (
                                <Link href={`/maintenance?code=${item.asset.assetCode}`}>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2 text-[11px] gap-1 border-rose-300 text-rose-700 bg-rose-50 hover:bg-rose-100 hover:text-rose-800"
                                    title={`Schedule maintenance repair for damaged asset ${item.asset.assetCode}`}
                                  >
                                    <Wrench className="w-3 h-3" />
                                    <span>Repair</span>
                                  </Button>
                                </Link>
                              )}
                              {plan.sessions.find((s) => s.id === selectedSessionId)?.status === 'COMPLETED' ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled
                                  className="h-7 px-2 text-[11px] gap-1 opacity-50 cursor-not-allowed text-muted-foreground"
                                  title="Session completed - Reopen to scan"
                                >
                                  <Lock className="w-3 h-3" />
                                  <span>Locked</span>
                                </Button>
                              ) : (
                                <Link href={`/scan?sessionId=${item.sessionId}&code=${item.asset.assetCode}`}>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2 text-[11px] gap-1"
                                    title="Scan this asset"
                                  >
                                    <QrCode className="w-3 h-3" />
                                    <span>Scan</span>
                                  </Button>
                                </Link>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Controls */}
              {sessionItems.length > 0 && (
                <div className="p-3 border-t bg-muted/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
                    <span>
                      Showing{' '}
                      <strong className="text-foreground">
                        {filteredSessionItems.length === 0
                          ? 0
                          : (safeChecklistPage - 1) * checklistPageSize + 1}
                      </strong>{' '}
                      to{' '}
                      <strong className="text-foreground">
                        {Math.min(safeChecklistPage * checklistPageSize, filteredSessionItems.length)}
                      </strong>{' '}
                      of <strong className="text-foreground">{filteredSessionItems.length}</strong>{' '}
                      {filteredSessionItems.length !== sessionItems.length
                        ? `(filtered from ${sessionItems.length})`
                        : 'assets'}
                    </span>

                    <div className="flex items-center gap-1.5 ml-2 border-l pl-2">
                      <span className="text-[11px] text-muted-foreground">Per page:</span>
                      <select
                        className="h-7 px-1.5 rounded border bg-background text-[11px] font-semibold text-foreground focus:ring-1 focus:ring-primary/20"
                        value={checklistPageSize}
                        onChange={(e) => {
                          setChecklistPageSize(Number(e.target.value));
                          setChecklistPage(1);
                        }}
                      >
                        <option value={5}>5</option>
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                      </select>
                    </div>
                  </div>

                  {totalChecklistPages > 1 && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleChecklistPageChange(1)}
                        disabled={safeChecklistPage <= 1}
                        title="First Page"
                      >
                        <ChevronsLeft className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleChecklistPageChange(safeChecklistPage - 1)}
                        disabled={safeChecklistPage <= 1}
                        title="Previous Page"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </Button>

                      <div className="flex items-center gap-1 mx-1">
                        {getChecklistPageNumbers().map((p, idx) =>
                          typeof p === 'number' ? (
                            <Button
                              key={p}
                              variant={safeChecklistPage === p ? 'default' : 'outline'}
                              size="sm"
                              className={`h-7 min-w-7 px-2 text-xs font-semibold ${
                                safeChecklistPage === p ? 'shadow-xs' : 'hover:bg-muted'
                              }`}
                              onClick={() => handleChecklistPageChange(p)}
                            >
                              {p}
                            </Button>
                          ) : (
                            <span
                              key={`ellipsis-${idx}`}
                              className="px-1 text-muted-foreground select-none font-bold"
                            >
                              …
                            </span>
                          ),
                        )}
                      </div>

                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleChecklistPageChange(safeChecklistPage + 1)}
                        disabled={safeChecklistPage >= totalChecklistPages}
                        title="Next Page"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleChecklistPageChange(totalChecklistPages)}
                        disabled={safeChecklistPage >= totalChecklistPages}
                        title="Last Page"
                      >
                        <ChevronsRight className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* Start New Session Modal */}
      {isSessionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-card border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 sm:p-5 border-b flex items-center justify-between bg-muted/20">
              <div className="space-y-0.5">
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-primary" />
                  <span>Start Audit Session</span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Snapshot matching assets and initiate floor verification
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSessionModalOpen(false)}
                className="h-8 w-8 text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <form onSubmit={handleCreateSession} className="p-4 sm:p-5 space-y-4">
              {sessionFormError && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{sessionFormError}</span>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">
                    Target Station / Location (Optional)
                  </label>
                  {planLocationName && (
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal border-primary/30 text-primary">
                      {isCompanyAudit ? 'Company Filter Active' : 'Scoped to Location'}
                    </Badge>
                  )}
                </div>

                {planLocationName && (
                  <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary flex items-start gap-2">
                    <Building className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <span className="font-semibold block text-foreground">
                        {isCompanyAudit ? 'Company Parent Scope' : 'Target Location Scope'}: {planLocationName}
                      </span>
                      <span className="text-[11px] text-muted-foreground block">
                        {isCompanyAudit
                          ? `This audit is created for Company ${planLocationName}. Only units, blocks, and stations belonging to this parent company are available (${sessionLocations.length} locations).`
                          : `Session locations are restricted to ${planLocationName} and its sub-stations (${sessionLocations.length} available).`}
                      </span>
                    </div>
                  </div>
                )}

                <select
                  className="w-full h-10 px-3 rounded-lg border bg-background text-xs font-medium"
                  value={sessionForm.locationId}
                  onChange={(e) =>
                    setSessionForm({ ...sessionForm, locationId: e.target.value })
                  }
                >
                  <option value="">
                    {planLocationName
                      ? `All Stations under ${planLocationName} (${sessionLocations.length} in scope)`
                      : 'All Locations in Plan Scope'}
                  </option>
                  {sessionLocations.map((loc) => {
                    let label = `[${loc.type}] ${loc.name}`;
                    if (loc.code && loc.code !== loc.name) {
                      label += ` (${loc.code})`;
                    }
                    if (loc.parent) {
                      label = `${loc.parent.name} > ${label}`;
                    }
                    return (
                      <option key={loc.id} value={loc.id}>
                        {label}
                      </option>
                    );
                  })}
                </select>
                <p className="text-[10px] text-muted-foreground">
                  Leave blank to verify all assets across the entire parent scope, or select a specific station to focus this session.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Session Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  className="w-full p-2.5 rounded-lg border bg-background text-xs resize-none"
                  placeholder="e.g. Floor walk started by team Alpha, inspecting electrical machinery..."
                  value={sessionForm.notes}
                  onChange={(e) => setSessionForm({ ...sessionForm, notes: e.target.value })}
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSessionModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingSession}
                  className="gap-1.5 shadow-sm"
                >
                  {isSubmittingSession ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Initializing...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Start Session</span>
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

