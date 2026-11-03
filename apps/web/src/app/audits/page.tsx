'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ClipboardCheck,
  QrCode,
  Calendar,
  AlertTriangle,
  AlertCircle,
  ChevronRight,
  Loader2,
  RotateCcw,
  Boxes,
  FileCheck,
  Plus,
  Trash2,
  X,
  Building,
  Target,
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface AuditPlan {
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
  _count?: {
    sessions?: number;
  };
  createdBy?: {
    id: string;
    name: string;
    email: string;
  };
}

interface LocationOption {
  id: string;
  name: string;
  code: string;
  type: string;
  parentId?: string | null;
  parent?: { id: string; name: string; code?: string; type?: string } | null;
}

export default function AuditsPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<AuditPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New Audit Plan modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    type: 'SCHEDULED' as 'SCHEDULED' | 'AD_HOC' | 'SURPRISE' | 'ANNUAL',
    scopeType: 'ALL' as 'ALL' | 'LOCATION',
    selectedLocationId: '',
    scheduledDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    description: '',
  });

  const fetchAuditPlans = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/audits/plans');
      if (!res.ok) {
        throw new Error(`Failed to fetch audit plans (${res.status})`);
      }
      const json = await res.json();
      const planList: AuditPlan[] = Array.isArray(json?.data)
        ? json.data
        : Array.isArray(json)
        ? json
        : [];
      setPlans(planList);
    } catch (err: any) {
      console.error('Failed to load audit plans:', err);
      setError(err?.message || 'Failed to connect to audit services.');
    } finally {
      setLoading(false);
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
        if (list.length > 0 && !form.selectedLocationId) {
          setForm((prev) => ({ ...prev, selectedLocationId: list[0].id }));
        }
      }
    } catch (e) {
      console.error('Failed to load locations for audit plan:', e);
    }
  };

  useEffect(() => {
    fetchAuditPlans();
    fetchLocations();
  }, []);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError('Please enter an audit plan name');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const scopeIds =
        form.scopeType === 'LOCATION' && form.selectedLocationId
          ? [form.selectedLocationId]
          : [];

      const payload = {
        name: form.name.trim(),
        type: form.type,
        scopeType: form.scopeType,
        scopeIds,
        scheduledDate: form.scheduledDate
          ? new Date(form.scheduledDate).toISOString()
          : undefined,
        description: form.description.trim() || undefined,
      };

      const res = await fetch('/api/audits/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Server error (${res.status})`);
      }

      const created = await res.json();
      const newPlanId = created?.data?.id || created?.id;

      setIsModalOpen(false);
      setForm({
        name: '',
        type: 'SCHEDULED',
        scopeType: 'ALL',
        selectedLocationId: locations[0]?.id || '',
        scheduledDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        description: '',
      });

      if (newPlanId) {
        router.push(`/audits/${newPlanId}`);
      } else {
        await fetchAuditPlans();
      }
    } catch (err: any) {
      console.error('Error creating plan:', err);
      setFormError(err.message || 'Could not create audit plan');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePlan = async (planId: string, planName: string) => {
    if (!confirm(`Are you sure you want to delete audit plan "${planName}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/audits/plans/${planId}`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error('Failed to delete audit plan');
      }
      setPlans((prev) => prev.filter((p) => p.id !== planId));
    } catch (e: any) {
      alert(e.message || 'Could not delete audit plan');
    }
  };

  const getLocationScopeNames = (scopeIdsRaw?: string | null) => {
    if (!scopeIdsRaw) return null;
    let ids: string[] = [];
    try {
      const parsed = JSON.parse(scopeIdsRaw);
      ids = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      ids = [scopeIdsRaw];
    }
    const matched = ids
      .map((id) => locations.find((l) => l.id === id))
      .filter(Boolean);
    if (matched.length === 0) return null;
    return matched
      .map((l) => (l!.code && l!.code !== l!.name ? `${l!.name} (${l!.code})` : l!.name))
      .join(', ');
  };

  // Compute live statistics from fetched records
  const openAuditsCount = plans.filter(
    (p) => p.status === 'IN_PROGRESS' || p.status === 'SCHEDULED' || p.status === 'DRAFT'
  ).length;

  const completedCount = plans.filter((p) => p.status === 'COMPLETED').length;

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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Audit Sessions</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Physical inventory verification, missing assets &amp; condition assessments
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={fetchAuditPlans}
            disabled={loading}
            className="h-10 w-10 shadow-2xs"
            title="Refresh Audit Plans"
          >
            <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>

          <Button
            onClick={() => setIsModalOpen(true)}
            size="sm"
            className="gap-1.5 h-10 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Create Plan</span>
          </Button>

          <Link href="/reports">
            <Button variant="outline" size="sm" className="gap-1.5 h-10 shadow-2xs font-medium">
              <BarChart3 className="w-4 h-4 text-primary" />
              <span>Status Reports</span>
            </Button>
          </Link>

          <Link href="/scan">
            <Button variant="outline" size="sm" className="gap-1.5 h-10 shadow-2xs">
              <QrCode className="w-4 h-4" />
              <span>Scanner</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Audit Stats Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <div className="p-3 rounded-xl border bg-card text-center">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
            Open Audits
          </span>
          <span className="text-xl font-bold text-primary">
            {loading ? '-' : `${openAuditsCount} Active`}
          </span>
        </div>
        <div className="p-3 rounded-xl border bg-card text-center">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
            Completed Plans
          </span>
          <span className="text-xl font-bold text-emerald-600">
            {loading ? '-' : `${completedCount} Total`}
          </span>
        </div>
        <div className="p-3 rounded-xl border bg-card text-center col-span-2 sm:col-span-1">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
            Total Sessions
          </span>
          <span className="text-xl font-bold text-muted-foreground">
            {loading
              ? '-'
              : plans.reduce((acc, p) => acc + (p._count?.sessions || 0), 0)}
          </span>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <Card className="border bg-card">
          <CardContent className="p-12 text-center flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-xs sm:text-sm text-muted-foreground">
              Loading audit plans from database...
            </p>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {!loading && error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-6 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-destructive mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-destructive">Failed to Load Audit Plans</p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchAuditPlans} className="gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Clean Empty State */}
      {!loading && !error && plans.length === 0 && (
        <Card className="border-dashed border-2 border-border/80 bg-card">
          <CardContent className="p-8 sm:p-12 text-center flex flex-col items-center justify-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <ClipboardCheck className="w-7 h-7" />
            </div>
            <div className="max-w-md space-y-1.5">
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                No Active Audits Found
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Create your first audit plan to start physical equipment verification, missing tag reconciliation, and condition assessment.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button
                size="sm"
                onClick={() => setIsModalOpen(true)}
                className="gap-2 h-9 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Create Audit Plan</span>
              </Button>
              <Link href="/scan">
                <Button variant="outline" size="sm" className="gap-2 h-9 shadow-2xs">
                  <QrCode className="w-4 h-4" />
                  <span>Start Scanning</span>
                </Button>
              </Link>
              <Link href="/assets">
                <Button variant="ghost" size="sm" className="gap-2 h-9 text-muted-foreground">
                  <Boxes className="w-4 h-4" />
                  <span>Inventory</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Populated Audit Plans List */}
      {!loading && !error && plans.length > 0 && (
        <div className="space-y-3">
          {plans.map((plan) => {
            const formattedDate = plan.scheduledDate
              ? new Date(plan.scheduledDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: '2-digit',
                  year: 'numeric',
                })
              : plan.createdAt
              ? new Date(plan.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: '2-digit',
                  year: 'numeric',
                })
              : 'Unscheduled';

            return (
              <Card
                key={plan.id}
                className="overflow-hidden hover:border-primary/40 transition-colors"
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <Link
                        href={`/audits/${plan.id}`}
                        className="font-semibold text-sm sm:text-base leading-snug hover:text-primary transition-colors flex items-center gap-1.5"
                      >
                        <span>{plan.name}</span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </Link>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                          {plan.type}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{formattedDate}</span>
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(plan.status)}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        title="Delete Plan"
                        onClick={() => handleDeletePlan(plan.id, plan.name)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Scope / Description */}
                  {(plan.description || plan.scopeType) && (
                    <div className="text-xs text-muted-foreground p-2 rounded bg-muted/30">
                      <span className="font-semibold block text-[10px] uppercase tracking-wider">
                        Audit Scope ({plan.scopeType || 'ALL'}
                        {plan.scopeType === 'LOCATION' && getLocationScopeNames(plan.scopeIds) && (
                          <span className="text-foreground font-bold">
                            : {getLocationScopeNames(plan.scopeIds)}
                          </span>
                        )})
                      </span>
                      <span className="text-foreground font-medium">
                        {plan.description || `Scope type: ${plan.scopeType}`}
                      </span>
                    </div>
                  )}

                  {/* Sessions Count & Actions */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <FileCheck className="w-3.5 h-3.5 text-primary" />
                      <span className="font-medium text-foreground">
                        {plan._count?.sessions || 0}
                      </span>
                      <span>Sessions</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link href={`/reports?planId=${plan.id}`}>
                        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs shadow-2xs">
                          <BarChart3 className="w-3.5 h-3.5 text-primary" />
                          <span>Status Report</span>
                        </Button>
                      </Link>
                      <Link href={`/audits/${plan.id}`}>
                        <Button size="sm" className="h-8 gap-1.5 text-xs shadow-2xs">
                          <span>View Plan &amp; Sessions</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Audit Plan Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-card border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 sm:p-5 border-b flex items-center justify-between bg-muted/20">
              <div className="space-y-0.5">
                <h3 className="font-bold text-base sm:text-lg text-foreground flex items-center gap-2">
                  <Target className="w-5 h-5 text-primary" />
                  <span>Create New Audit Plan</span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Configure inventory verification scope, type, and target date
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsModalOpen(false)}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <form onSubmit={handleCreatePlan} className="p-4 sm:p-5 space-y-4 overflow-y-auto">
              {formError && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Plan Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Audit Plan Name <span className="text-destructive">*</span>
                </label>
                <Input
                  required
                  placeholder="e.g. Q4 2026 Block-C Physical Machinery Verification"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              {/* Audit Type & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Audit Type</label>
                  <select
                    className="w-full h-10 px-3 rounded-lg border bg-background text-xs"
                    value={form.type}
                    onChange={(e: any) => setForm({ ...form, type: e.target.value })}
                  >
                    <option value="SCHEDULED">SCHEDULED (Periodic)</option>
                    <option value="AD_HOC">AD_HOC (Floor Walk)</option>
                    <option value="SURPRISE">SURPRISE (Spot Check)</option>
                    <option value="ANNUAL">ANNUAL (Financial Year End)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Scheduled Date</label>
                  <Input
                    type="date"
                    value={form.scheduledDate}
                    onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
                  />
                </div>
              </div>

              {/* Audit Scope Selection */}
              <div className="space-y-2 p-3.5 rounded-xl border bg-muted/20">
                <label className="text-xs font-bold uppercase tracking-wider block text-foreground">
                  Audit Scope (Assets To Verify)
                </label>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <label
                    className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      form.scopeType === 'ALL'
                        ? 'bg-primary/10 border-primary text-primary font-semibold'
                        : 'bg-background hover:bg-muted'
                    }`}
                  >
                    <input
                      type="radio"
                      name="scopeType"
                      checked={form.scopeType === 'ALL'}
                      onChange={() => setForm({ ...form, scopeType: 'ALL' })}
                      className="sr-only"
                    />
                    <Boxes className="w-4 h-4 shrink-0" />
                    <span>All Assets</span>
                  </label>

                  <label
                    className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      form.scopeType === 'LOCATION'
                        ? 'bg-primary/10 border-primary text-primary font-semibold'
                        : 'bg-background hover:bg-muted'
                    }`}
                  >
                    <input
                      type="radio"
                      name="scopeType"
                      checked={form.scopeType === 'LOCATION'}
                      onChange={() => setForm({ ...form, scopeType: 'LOCATION' })}
                      className="sr-only"
                    />
                    <Building className="w-4 h-4 shrink-0" />
                    <span>By Location</span>
                  </label>
                </div>

                {form.scopeType === 'LOCATION' && (
                  <div className="space-y-1 pt-1 animate-in fade-in">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      Target Plant / Unit / Block:
                    </label>
                    <select
                      className="w-full h-10 px-3 rounded-lg border bg-background text-xs font-medium"
                      value={form.selectedLocationId}
                      onChange={(e) => setForm({ ...form, selectedLocationId: e.target.value })}
                    >
                      {locations.map((loc) => {
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
                      Assets assigned directly or inside any sub-rooms/blocks of this location will be loaded.
                    </p>
                  </div>
                )}
              </div>

              {/* Description / Objectives */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Description / Objectives (Optional)
                </label>
                <textarea
                  rows={2}
                  className="w-full p-2.5 rounded-lg border bg-background text-xs resize-none"
                  placeholder="e.g. Verify critical production CNC milling machines and electrical enclosures..."
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isSubmitting} className="gap-1.5">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Creating Plan...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Create Plan</span>
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
