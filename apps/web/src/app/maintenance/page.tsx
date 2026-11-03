'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Wrench,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Play,
  XCircle,
  Plus,
  Search,
  Filter,
  DollarSign,
  ShieldCheck,
  Building,
  RotateCw,
  Loader2,
  FileText,
  ChevronRight,
  Boxes,
  AlertCircle,
  Check,
  X,
  ExternalLink,
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

interface MaintenanceRecordItem {
  id: string;
  assetId: string;
  scheduleId?: string | null;
  type: 'PREVENTIVE' | 'CORRECTIVE' | 'INSPECTION';
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  title: string;
  description?: string | null;
  scheduledAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  cost?: number | string | null;
  invoiceRef?: string | null;
  notes?: string | null;
  asset: {
    id: string;
    name: string;
    assetCode: string;
    sapAssetCode?: string | null;
    model?: string | null;
    status: string;
    location?: { id: string; name: string; code: string } | null;
    category?: { id: string; name: string; code: string } | null;
  };
  vendor?: { id: string; name: string } | null;
  performedBy?: { id: string; name: string; email: string } | null;
  schedule?: { id: string; title: string; frequencyDays: number } | null;
}

interface MaintenanceScheduleItem {
  id: string;
  assetId: string;
  type: 'PREVENTIVE' | 'CORRECTIVE' | 'INSPECTION';
  title: string;
  description?: string | null;
  frequencyDays?: number | null;
  nextDueDate?: string | null;
  lastDoneDate?: string | null;
  isActive: boolean;
  asset: {
    id: string;
    name: string;
    assetCode: string;
    sapAssetCode?: string | null;
    model?: string | null;
    status: string;
    location?: { id: string; name: string; code: string } | null;
    category?: { id: string; name: string; code: string } | null;
  };
  vendor?: { id: string; name: string } | null;
}

interface MaintenanceStats {
  total: number;
  scheduled: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  activeSchedules: number;
  totalSpent: number;
}

export default function MaintenancePage() {
  const searchParams = useSearchParams();
  const prefillAssetCode = searchParams?.get('code') || '';
  const prefillAssetId = searchParams?.get('assetId') || '';

  const [activeTab, setActiveTab] = useState<'records' | 'schedules'>('records');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState<MaintenanceStats>({
    total: 0,
    scheduled: 0,
    inProgress: 0,
    completed: 0,
    cancelled: 0,
    activeSchedules: 0,
    totalSpent: 0,
  });

  // Records & Schedules lists
  const [records, setRecords] = useState<MaintenanceRecordItem[]>([]);
  const [schedules, setSchedules] = useState<MaintenanceScheduleItem[]>([]);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<MaintenanceRecordItem | null>(null);

  // New Record Form State
  const [formAssetQuery, setFormAssetQuery] = useState(prefillAssetCode);
  const [formSelectedAsset, setFormSelectedAsset] = useState<any>(null);
  const [assetSearching, setAssetSearching] = useState(false);
  const [assetSearchResults, setAssetSearchResults] = useState<any[]>([]);
  const [formType, setFormType] = useState<'PREVENTIVE' | 'CORRECTIVE' | 'INSPECTION'>('PREVENTIVE');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formScheduledDate, setFormScheduledDate] = useState(new Date().toISOString().split('T')[0]);
  const [formCost, setFormCost] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // New Schedule Form State
  const [schedAssetQuery, setSchedAssetQuery] = useState('');
  const [schedSelectedAsset, setSchedSelectedAsset] = useState<any>(null);
  const [schedSearching, setSchedSearching] = useState(false);
  const [schedSearchResults, setSchedSearchResults] = useState<any[]>([]);
  const [schedType, setSchedType] = useState<'PREVENTIVE' | 'CORRECTIVE' | 'INSPECTION'>('PREVENTIVE');
  const [schedTitle, setSchedTitle] = useState('');
  const [schedDescription, setSchedDescription] = useState('');
  const [schedFrequencyDays, setSchedFrequencyDays] = useState('90');
  const [schedNextDue, setSchedNextDue] = useState('');

  // Complete Record Form State
  const [completeCost, setCompleteCost] = useState('');
  const [completeLaborCost, setCompleteLaborCost] = useState('');
  const [completeNotes, setCompleteNotes] = useState('');
  const [completeNextDue, setCompleteNextDue] = useState('');
  const [isCompleting, setIsCompleting] = useState(false);

  // Load Data
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, recordsRes, schedulesRes] = await Promise.all([
        fetch('/api/maintenance/stats'),
        fetch('/api/maintenance/records?limit=100'),
        fetch('/api/maintenance/schedules?limit=100'),
      ]);

      if (statsRes.ok) {
        const sJson = await statsRes.json();
        setStats(sJson?.data || sJson || {});
      }

      if (recordsRes.ok) {
        const rJson = await recordsRes.json();
        const rList = Array.isArray(rJson?.data) ? rJson.data : Array.isArray(rJson) ? rJson : [];
        setRecords(rList);
      }

      if (schedulesRes.ok) {
        const scJson = await schedulesRes.json();
        const scList = Array.isArray(scJson?.data) ? scJson.data : Array.isArray(scJson) ? scJson : [];
        setSchedules(scList);
      }
    } catch (err: any) {
      console.error('Error loading maintenance data:', err);
      setError(err.message || 'Could not load maintenance data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Pre-fill asset if query params present
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
            setFormTitle(`Maintenance Service: ${a.name}`);
            setIsRecordModalOpen(true);
          }
        })
        .catch((e) => console.error('Prefill lookup error:', e));
    }
  }, [prefillAssetId, prefillAssetCode]);

  // Asset autocomplete search for record modal
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

  // Asset autocomplete search for schedule modal
  const handleSearchSchedAsset = async (query: string) => {
    setSchedAssetQuery(query);
    if (!query.trim()) {
      setSchedSearchResults([]);
      return;
    }
    setSchedSearching(true);
    try {
      const res = await fetch(`/api/assets?search=${encodeURIComponent(query)}&limit=5`);
      if (res.ok) {
        const json = await res.json();
        setSchedSearchResults(Array.isArray(json?.data) ? json.data : []);
      }
    } catch (e) {
      console.error('Schedule asset search error:', e);
    } finally {
      setSchedSearching(false);
    }
  };

  // Submit New Maintenance Work Order
  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSelectedAsset) {
      setFormError('Please search and select an asset to service');
      return;
    }
    if (!formTitle.trim()) {
      setFormError('Service title is required');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch('/api/maintenance/records', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: formSelectedAsset.id,
          type: formType,
          title: formTitle.trim(),
          description: formDescription.trim() || undefined,
          scheduledDate: formScheduledDate ? new Date(formScheduledDate).toISOString() : new Date().toISOString(),
          cost: formCost ? parseFloat(formCost) : undefined,
          notes: formNotes.trim() || undefined,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.message || 'Failed to create maintenance work order');
      }

      setIsRecordModalOpen(false);
      setFormSelectedAsset(null);
      setFormAssetQuery('');
      setFormTitle('');
      setFormDescription('');
      setFormCost('');
      setFormNotes('');
      fetchData();
    } catch (err: any) {
      console.error('Error creating maintenance record:', err);
      setFormError(err.message || 'Failed to create maintenance record');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit New Preventive Schedule
  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schedSelectedAsset) {
      setFormError('Please search and select an asset for the schedule');
      return;
    }
    if (!schedTitle.trim()) {
      setFormError('Schedule title is required');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const freq = parseInt(schedFrequencyDays, 10) || 90;
      const res = await fetch('/api/maintenance/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assetId: schedSelectedAsset.id,
          type: schedType,
          title: schedTitle.trim(),
          description: schedDescription.trim() || undefined,
          frequencyDays: freq,
          nextDueDate: schedNextDue ? new Date(schedNextDue).toISOString() : undefined,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.message || 'Failed to create schedule');
      }

      setIsScheduleModalOpen(false);
      setSchedSelectedAsset(null);
      setSchedAssetQuery('');
      setSchedTitle('');
      setSchedDescription('');
      fetchData();
    } catch (err: any) {
      console.error('Error creating schedule:', err);
      setFormError(err.message || 'Failed to create schedule');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Start Service Action
  const handleStartMaintenance = async (recordId: string) => {
    try {
      const res = await fetch(`/api/maintenance/records/${recordId}/start`, {
        method: 'PATCH',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Failed to start maintenance');
      }
      fetchData();
    } catch (e: any) {
      alert(e.message || 'Failed to start maintenance');
    }
  };

  // Cancel Service Action
  const handleCancelMaintenance = async (recordId: string) => {
    if (!confirm('Are you sure you want to cancel this maintenance work order? The asset status will be restored to ACTIVE.')) {
      return;
    }
    try {
      const res = await fetch(`/api/maintenance/records/${recordId}/cancel`, {
        method: 'PATCH',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Failed to cancel maintenance');
      }
      fetchData();
    } catch (e: any) {
      alert(e.message || 'Failed to cancel maintenance');
    }
  };

  // Complete Service Action (opens modal)
  const openCompleteModal = (item: MaintenanceRecordItem) => {
    setCompleteTarget(item);
    setCompleteCost(item.cost ? String(item.cost) : '');
    setCompleteLaborCost('');
    setCompleteNotes(item.notes || '');
    setCompleteNextDue('');
  };

  const handleFinishComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completeTarget) return;

    setIsCompleting(true);
    try {
      const payload: any = {
        cost: completeCost ? parseFloat(completeCost) : undefined,
        laborCost: completeLaborCost ? parseFloat(completeLaborCost) : undefined,
        notes: completeNotes.trim() || undefined,
        nextDueDate: completeNextDue ? new Date(completeNextDue).toISOString() : undefined,
      };

      const res = await fetch(`/api/maintenance/records/${completeTarget.id}/complete`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.message || 'Failed to complete maintenance');
      }

      setCompleteTarget(null);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Error completing maintenance');
    } finally {
      setIsCompleting(false);
    }
  };

  // Filter records
  const filteredRecords = records.filter((r) => {
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    if (typeFilter !== 'ALL' && r.type !== typeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTag = r.asset?.assetCode?.toLowerCase().includes(q);
      const matchSap = r.asset?.sapAssetCode?.toLowerCase().includes(q);
      const matchName = r.asset?.name?.toLowerCase().includes(q);
      const matchTitle = r.title?.toLowerCase().includes(q);
      const matchDesc = r.description?.toLowerCase().includes(q);
      if (!matchTag && !matchSap && !matchName && !matchTitle && !matchDesc) return false;
    }
    return true;
  });

  // Filter schedules
  const filteredSchedules = schedules.filter((s) => {
    if (typeFilter !== 'ALL' && s.type !== typeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTag = s.asset?.assetCode?.toLowerCase().includes(q);
      const matchName = s.asset?.name?.toLowerCase().includes(q);
      const matchTitle = s.title?.toLowerCase().includes(q);
      if (!matchTag && !matchName && !matchTitle) return false;
    }
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return (
          <Badge variant="outline" className="text-amber-700 bg-amber-50 border-amber-200 font-semibold gap-1">
            <Clock className="w-3 h-3 text-amber-600" />
            <span>SCHEDULED</span>
          </Badge>
        );
      case 'IN_PROGRESS':
        return (
          <Badge variant="default" className="bg-blue-600 hover:bg-blue-700 font-semibold gap-1 animate-pulse">
            <RotateCw className="w-3 h-3 animate-spin" />
            <span>IN PROGRESS</span>
          </Badge>
        );
      case 'COMPLETED':
        return (
          <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 font-semibold gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>COMPLETED</span>
          </Badge>
        );
      case 'CANCELLED':
        return (
          <Badge variant="secondary" className="font-semibold gap-1 text-muted-foreground">
            <XCircle className="w-3 h-3" />
            <span>CANCELLED</span>
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'PREVENTIVE':
        return <Badge variant="outline" className="border-blue-300 text-blue-700 bg-blue-50/50">Preventive</Badge>;
      case 'CORRECTIVE':
        return <Badge variant="outline" className="border-rose-300 text-rose-700 bg-rose-50/50">Corrective</Badge>;
      case 'INSPECTION':
        return <Badge variant="outline" className="border-purple-300 text-purple-700 bg-purple-50/50">Inspection</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-5 pb-12 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Wrench className="w-6 h-6 text-primary" />
            <span>Equipment Maintenance &amp; Servicing</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Plan preventive upkeep, track corrective work orders, and maintain asset operational reliability.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFormError(null);
              setIsScheduleModalOpen(true);
            }}
            className="h-9 gap-1.5 text-xs shadow-2xs"
          >
            <Calendar className="w-3.5 h-3.5 text-primary" />
            <span>+ Preventive Schedule</span>
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setFormError(null);
              setIsRecordModalOpen(true);
            }}
            className="h-9 gap-1.5 text-xs shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Log Service Order</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-3.5 border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Total Work Orders
            </span>
            <FileText className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold text-foreground mt-1">{stats.total}</div>
          <span className="text-[10px] text-muted-foreground">All logged maintenance</span>
        </Card>

        <Card className="p-3.5 border bg-card border-amber-200/50 dark:border-amber-900/30">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Scheduled
            </span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-700 dark:text-amber-400 mt-1">{stats.scheduled}</div>
          <span className="text-[10px] text-muted-foreground">Pending service start</span>
        </Card>

        <Card className="p-3.5 border bg-card border-blue-200/50 dark:border-blue-900/30">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
              In Progress
            </span>
            <RotateCw className="w-4 h-4 text-blue-600 animate-spin" />
          </div>
          <div className="text-2xl font-bold text-blue-700 dark:text-blue-400 mt-1">{stats.inProgress}</div>
          <span className="text-[10px] text-muted-foreground">Under active repair</span>
        </Card>

        <Card className="p-3.5 border bg-card border-emerald-200/50 dark:border-emerald-900/30">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Completed
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">{stats.completed}</div>
          <span className="text-[10px] text-muted-foreground">Restored to active</span>
        </Card>

        <Card className="p-3.5 border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Total Spent
            </span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-foreground mt-1 truncate">
            BDT {stats.totalSpent.toLocaleString()}
          </div>
          <span className="text-[10px] text-muted-foreground">Parts &amp; labor cost</span>
        </Card>

        <Card className="p-3.5 border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Schedules
            </span>
            <Calendar className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-primary mt-1">{stats.activeSchedules}</div>
          <span className="text-[10px] text-muted-foreground">Active recurring cycles</span>
        </Card>
      </div>

      {/* Main Container */}
      <Card className="border shadow-xs overflow-hidden">
        {/* Navigation Tabs Header */}
        <div className="border-b bg-muted/20 px-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex space-x-1 sm:space-x-2 pt-2 sm:pt-0">
            <button
              onClick={() => setActiveTab('records')}
              className={`py-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === 'records'
                  ? 'border-primary text-primary font-bold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Wrench className="w-4 h-4" />
              <span>Service Orders &amp; Logs ({records.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('schedules')}
              className={`py-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === 'schedules'
                  ? 'border-primary text-primary font-bold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Recurring Schedules ({schedules.length})</span>
            </button>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={fetchData}
            className="h-8 text-xs gap-1 self-end sm:self-auto mb-2 sm:mb-0"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-3 sm:p-4 border-b bg-background flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Search by tag, name, SAP code, title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs bg-muted/20"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {activeTab === 'records' && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground font-medium">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-8 px-2.5 rounded-lg border bg-background text-xs font-semibold text-foreground focus:ring-1 focus:ring-primary/20"
                >
                  <option value="ALL">All Statuses ({records.length})</option>
                  <option value="SCHEDULED">SCHEDULED</option>
                  <option value="IN_PROGRESS">IN PROGRESS</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground font-medium">Type:</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-8 px-2.5 rounded-lg border bg-background text-xs font-semibold text-foreground focus:ring-1 focus:ring-primary/20"
              >
                <option value="ALL">All Types</option>
                <option value="PREVENTIVE">Preventive</option>
                <option value="CORRECTIVE">Corrective</option>
                <option value="INSPECTION">Inspection</option>
              </select>
            </div>

            {(searchQuery || statusFilter !== 'ALL' || typeFilter !== 'ALL') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('ALL');
                  setTypeFilter('ALL');
                }}
                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                Reset
              </Button>
            )}
          </div>
        </div>

        {/* TAB 1: Service Records / Work Orders Table */}
        {activeTab === 'records' && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 text-[11px]">
                  <TableHead className="w-[140px]">Asset Code</TableHead>
                  <TableHead className="w-[200px]">Equipment Details</TableHead>
                  <TableHead>Service Work Order</TableHead>
                  <TableHead className="w-[110px]">Type</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[120px]">Schedule Date</TableHead>
                  <TableHead className="w-[100px]">Cost</TableHead>
                  <TableHead className="w-[140px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                      <p className="text-xs text-muted-foreground mt-2">Loading maintenance records...</p>
                    </TableCell>
                  </TableRow>
                ) : filteredRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 space-y-2">
                      <Boxes className="w-8 h-8 text-muted-foreground/50 mx-auto" />
                      <p className="text-xs font-semibold text-foreground">No Maintenance Work Orders Found</p>
                      <p className="text-[11px] text-muted-foreground">
                        Log a maintenance work order to schedule service on machinery or plant equipment.
                      </p>
                      <Button
                        size="sm"
                        onClick={() => setIsRecordModalOpen(true)}
                        className="h-8 gap-1 text-xs mt-2"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Log First Service Order</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRecords.map((r) => (
                    <TableRow key={r.id} className="text-xs hover:bg-muted/30">
                      {/* Asset Code */}
                      <TableCell className="font-mono font-bold text-primary">
                        <Link href={`/assets/${r.asset?.id}`} className="hover:underline flex items-center gap-1">
                          <span>{r.asset?.assetCode}</span>
                          <ExternalLink className="w-2.5 h-2.5 text-muted-foreground" />
                        </Link>
                        {r.asset?.sapAssetCode && (
                          <span className="text-[10px] font-normal text-muted-foreground block">
                            SAP: {r.asset.sapAssetCode}
                          </span>
                        )}
                      </TableCell>

                      {/* Equipment Details */}
                      <TableCell>
                        <div className="font-semibold text-foreground line-clamp-1">{r.asset?.name}</div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Building className="w-3 h-3 shrink-0" />
                          <span>{r.asset?.location?.name || 'Unassigned Station'}</span>
                        </div>
                      </TableCell>

                      {/* Work Order Title & Description */}
                      <TableCell>
                        <div className="font-semibold text-foreground">{r.title}</div>
                        {r.description && (
                          <div className="text-[11px] text-muted-foreground line-clamp-1">
                            {r.description}
                          </div>
                        )}
                        {r.notes && (
                          <div className="text-[10px] text-muted-foreground italic mt-0.5">
                            Note: {r.notes}
                          </div>
                        )}
                      </TableCell>

                      {/* Type */}
                      <TableCell>{getTypeBadge(r.type)}</TableCell>

                      {/* Status */}
                      <TableCell>{getStatusBadge(r.status)}</TableCell>

                      {/* Scheduled / Completed Dates */}
                      <TableCell className="text-muted-foreground text-[11px]">
                        <div>
                          {r.scheduledAt
                            ? new Date(r.scheduledAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })
                            : '—'}
                        </div>
                        {r.completedAt && (
                          <div className="text-[10px] text-emerald-600 font-medium">
                            Done: {new Date(r.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                        )}
                      </TableCell>

                      {/* Cost */}
                      <TableCell className="font-semibold">
                        {r.cost !== null && r.cost !== undefined && Number(r.cost) > 0 ? (
                          <span>BDT {Number(r.cost).toLocaleString()}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {r.status === 'SCHEDULED' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleStartMaintenance(r.id)}
                                className="h-7 px-2 text-[11px] gap-1 border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100"
                                title="Begin maintenance service"
                              >
                                <Play className="w-3 h-3 fill-current" />
                                <span>Start</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleCancelMaintenance(r.id)}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                title="Cancel order"
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}

                          {r.status === 'IN_PROGRESS' && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => openCompleteModal(r)}
                                className="h-7 px-2.5 text-[11px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                                title="Mark service finished and restore asset"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Complete</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleCancelMaintenance(r.id)}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                                title="Cancel order"
                              >
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}

                          {r.status === 'COMPLETED' && (
                            <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-200 bg-emerald-50/50">
                              Archived
                            </Badge>
                          )}

                          {r.status === 'CANCELLED' && (
                            <span className="text-[10px] text-muted-foreground italic">Cancelled</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* TAB 2: Recurring Schedules Table */}
        {activeTab === 'schedules' && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 text-[11px]">
                  <TableHead className="w-[140px]">Asset Code</TableHead>
                  <TableHead className="w-[220px]">Equipment</TableHead>
                  <TableHead>Schedule Title &amp; Description</TableHead>
                  <TableHead className="w-[110px]">Type</TableHead>
                  <TableHead className="w-[120px]">Frequency</TableHead>
                  <TableHead className="w-[120px]">Next Due Date</TableHead>
                  <TableHead className="w-[130px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                      <p className="text-xs text-muted-foreground mt-2">Loading recurring schedules...</p>
                    </TableCell>
                  </TableRow>
                ) : filteredSchedules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 space-y-2">
                      <Calendar className="w-8 h-8 text-muted-foreground/50 mx-auto" />
                      <p className="text-xs font-semibold text-foreground">No Recurring Preventive Schedules</p>
                      <p className="text-[11px] text-muted-foreground">
                        Create periodic preventive schedules (e.g. 30, 90, 180, or 365 days) for plant machinery.
                      </p>
                      <Button
                        size="sm"
                        onClick={() => setIsScheduleModalOpen(true)}
                        className="h-8 gap-1 text-xs mt-2"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Create Preventive Schedule</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSchedules.map((s) => {
                    const isOverdue = s.nextDueDate && new Date(s.nextDueDate) < new Date();
                    return (
                      <TableRow key={s.id} className="text-xs hover:bg-muted/30">
                        <TableCell className="font-mono font-bold text-primary">
                          <Link href={`/assets/${s.asset?.id}`} className="hover:underline flex items-center gap-1">
                            <span>{s.asset?.assetCode}</span>
                            <ExternalLink className="w-2.5 h-2.5 text-muted-foreground" />
                          </Link>
                          {s.asset?.sapAssetCode && (
                            <span className="text-[10px] font-normal text-muted-foreground block">
                              SAP: {s.asset.sapAssetCode}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-foreground line-clamp-1">{s.asset?.name}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {s.asset?.location?.name || 'Unassigned Station'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-foreground">{s.title}</div>
                          {s.description && (
                            <div className="text-[11px] text-muted-foreground line-clamp-1">
                              {s.description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{getTypeBadge(s.type)}</TableCell>
                        <TableCell className="font-medium text-foreground">
                          Every {s.frequencyDays || 90} Days
                        </TableCell>
                        <TableCell>
                          {s.nextDueDate ? (
                            <span
                              className={`font-semibold flex items-center gap-1 ${
                                isOverdue ? 'text-rose-600 font-bold' : 'text-foreground'
                              }`}
                            >
                              {isOverdue && <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                              <span>
                                {new Date(s.nextDueDate).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">As needed</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setFormSelectedAsset(s.asset);
                              setFormAssetQuery(s.asset.assetCode);
                              setFormType(s.type);
                              setFormTitle(s.title);
                              setFormDescription(s.description || '');
                              setIsRecordModalOpen(true);
                            }}
                            className="h-7 px-2 text-[11px] gap-1 border-primary/30 text-primary hover:bg-primary/10"
                            title="Spawn a new work order from this schedule"
                          >
                            <Play className="w-3 h-3 fill-current" />
                            <span>Trigger Order</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* MODAL 1: Create New Service Work Order */}
      {isRecordModalOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-card border rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 sm:p-5 border-b flex items-center justify-between bg-muted/20">
              <div className="space-y-0.5">
                <h2 className="text-base sm:text-lg font-bold tracking-tight">Log Maintenance Work Order</h2>
                <p className="text-xs text-muted-foreground">
                  Schedule service on machinery. Automatically flags asset as IN_MAINTENANCE.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsRecordModalOpen(false)}
                className="h-8 w-8 rounded-full"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <form onSubmit={handleCreateRecord} className="p-4 sm:p-5 space-y-4 overflow-y-auto">
              {formError && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Asset Autocomplete Picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Select Equipment Asset <span className="text-destructive">*</span>
                </label>
                {formSelectedAsset ? (
                  <div className="p-3 rounded-xl border bg-primary/5 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-primary">
                          {formSelectedAsset.assetCode}
                        </span>
                        {formSelectedAsset.sapAssetCode && (
                          <span className="text-[10px] font-mono text-muted-foreground">
                            (SAP: {formSelectedAsset.sapAssetCode})
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-foreground line-clamp-1">
                        {formSelectedAsset.name}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setFormSelectedAsset(null)}
                      className="h-7 text-xs text-muted-foreground hover:text-destructive"
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      placeholder="Type asset code (e.g. ABL-6020...) or equipment name"
                      value={formAssetQuery}
                      onChange={(e) => handleSearchAsset(e.target.value)}
                      className="pl-8 text-xs"
                    />
                    {assetSearching && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    )}

                    {assetSearchResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 border rounded-xl bg-card shadow-lg z-20 overflow-hidden divide-y text-xs">
                        {assetSearchResults.map((a) => (
                          <div
                            key={a.id}
                            onClick={() => {
                              setFormSelectedAsset(a);
                              setFormAssetQuery(a.assetCode);
                              setAssetSearchResults([]);
                              if (!formTitle) setFormTitle(`Maintenance: ${a.name}`);
                            }}
                            className="p-2.5 hover:bg-muted/50 cursor-pointer flex items-center justify-between"
                          >
                            <div>
                              <span className="font-mono font-bold text-primary mr-2">{a.assetCode}</span>
                              <span className="text-foreground font-medium">{a.name}</span>
                            </div>
                            <span className="text-[10px] text-muted-foreground">{a.location?.name || ''}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Maintenance Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Service Type</label>
                  <select
                    value={formType}
                    onChange={(e: any) => setFormType(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border bg-background text-xs font-semibold"
                  >
                    <option value="PREVENTIVE">PREVENTIVE (Routine Service)</option>
                    <option value="CORRECTIVE">CORRECTIVE (Breakdown / Repair)</option>
                    <option value="INSPECTION">INSPECTION (Calibration / Check)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Scheduled Date</label>
                  <Input
                    type="date"
                    required
                    value={formScheduledDate}
                    onChange={(e) => setFormScheduledDate(e.target.value)}
                  />
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Work Order Title <span className="text-destructive">*</span>
                </label>
                <Input
                  required
                  placeholder="e.g., Q4 Spindle Replacement & Lubrication"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Service Details / Work Scope</label>
                <textarea
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border bg-background text-xs focus:ring-1 focus:ring-primary/20 outline-none"
                  placeholder="Describe failure symptoms, required replacement parts, or calibration criteria..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                />
              </div>

              {/* Estimated Cost & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Estimated Budget (BDT)</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 5000"
                    value={formCost}
                    onChange={(e) => setFormCost(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Technician / Vendor Remarks</label>
                  <Input
                    placeholder="e.g. In-house electrician / Apex Workshop"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="pt-3 border-t flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsRecordModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isSubmitting} className="gap-1.5 shadow-sm">
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>Schedule Service</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Create Preventive Schedule */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-card border rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 sm:p-5 border-b flex items-center justify-between bg-muted/20">
              <div className="space-y-0.5">
                <h2 className="text-base sm:text-lg font-bold tracking-tight">Create Preventive Schedule</h2>
                <p className="text-xs text-muted-foreground">
                  Set recurring maintenance intervals for machines and plant systems.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsScheduleModalOpen(false)}
                className="h-8 w-8 rounded-full"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <form onSubmit={handleCreateSchedule} className="p-4 sm:p-5 space-y-4 overflow-y-auto">
              {formError && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Equipment Asset Picker */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Select Target Machine <span className="text-destructive">*</span>
                </label>
                {schedSelectedAsset ? (
                  <div className="p-3 rounded-xl border bg-primary/5 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="font-mono text-xs font-bold text-primary">
                        {schedSelectedAsset.assetCode}
                      </span>
                      <p className="text-xs font-semibold text-foreground line-clamp-1">
                        {schedSelectedAsset.name}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSchedSelectedAsset(null)}
                      className="h-7 text-xs text-muted-foreground hover:text-destructive"
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <Input
                      placeholder="Search asset code or machine name"
                      value={schedAssetQuery}
                      onChange={(e) => handleSearchSchedAsset(e.target.value)}
                      className="pl-8 text-xs"
                    />
                    {schedSearching && (
                      <Loader2 className="w-3.5 h-3.5 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    )}

                    {schedSearchResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 border rounded-xl bg-card shadow-lg z-20 overflow-hidden divide-y text-xs">
                        {schedSearchResults.map((a) => (
                          <div
                            key={a.id}
                            onClick={() => {
                              setSchedSelectedAsset(a);
                              setSchedAssetQuery(a.assetCode);
                              setSchedSearchResults([]);
                              if (!schedTitle) setSchedTitle(`Routine Preventive Maintenance: ${a.name}`);
                            }}
                            className="p-2.5 hover:bg-muted/50 cursor-pointer flex items-center justify-between"
                          >
                            <span className="font-mono font-bold text-primary mr-2">{a.assetCode}</span>
                            <span className="text-foreground font-medium">{a.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Maintenance Type & Frequency */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Schedule Type</label>
                  <select
                    value={schedType}
                    onChange={(e: any) => setSchedType(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border bg-background text-xs font-semibold"
                  >
                    <option value="PREVENTIVE">PREVENTIVE (Periodic)</option>
                    <option value="INSPECTION">INSPECTION (Compliance)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Cycle Frequency</label>
                  <select
                    value={schedFrequencyDays}
                    onChange={(e) => setSchedFrequencyDays(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border bg-background text-xs font-semibold"
                  >
                    <option value="30">Monthly (Every 30 Days)</option>
                    <option value="60">Bi-Monthly (Every 60 Days)</option>
                    <option value="90">Quarterly (Every 90 Days)</option>
                    <option value="180">Semi-Annual (Every 180 Days)</option>
                    <option value="365">Annual (Every 365 Days)</option>
                  </select>
                </div>
              </div>

              {/* Title & Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Schedule Title <span className="text-destructive">*</span>
                </label>
                <Input
                  required
                  placeholder="e.g. Quarterly Hydraulics Oil Flush & Sensor Calibration"
                  value={schedTitle}
                  onChange={(e) => setSchedTitle(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Routine Description</label>
                <textarea
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border bg-background text-xs focus:ring-1 focus:ring-primary/20 outline-none"
                  placeholder="Service checklist steps, grease types, filter model references..."
                  value={schedDescription}
                  onChange={(e) => setSchedDescription(e.target.value)}
                />
              </div>

              <div className="pt-3 border-t flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsScheduleModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isSubmitting} className="gap-1.5 shadow-sm">
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calendar className="w-3.5 h-3.5" />}
                  <span>Save Schedule</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Complete Maintenance Service */}
      {completeTarget && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-card border rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
            <div className="p-4 sm:p-5 border-b flex items-center justify-between bg-emerald-500/10">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-xs uppercase">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Finalize Service Completion</span>
                </div>
                <h2 className="text-base font-bold tracking-tight text-foreground">
                  {completeTarget.title}
                </h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCompleteTarget(null)}
                className="h-8 w-8 rounded-full"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <form onSubmit={handleFinishComplete} className="p-4 sm:p-5 space-y-4">
              <div className="p-3 rounded-xl border bg-muted/30 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Serviced Asset:</span>
                  <strong className="font-mono text-primary">{completeTarget.asset?.assetCode}</strong>
                </div>
                <div className="text-muted-foreground line-clamp-1">{completeTarget.asset?.name}</div>
                <div className="text-[11px] text-emerald-700 font-semibold pt-1">
                  ⚡ Asset status will be automatically restored to ACTIVE in database.
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Parts / Material Cost (BDT)</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={completeCost}
                    onChange={(e) => setCompleteCost(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Labor / Vendor Cost (BDT)</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={completeLaborCost}
                    onChange={(e) => setCompleteLaborCost(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Service Notes / Work Performed</label>
                <textarea
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border bg-background text-xs focus:ring-1 focus:ring-primary/20 outline-none"
                  placeholder="Replaced worn bearing, flushed lubrication fluid, tested 20-cycle trial run with 0 errors..."
                  value={completeNotes}
                  onChange={(e) => setCompleteNotes(e.target.value)}
                />
              </div>

              <div className="pt-3 border-t flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCompleteTarget(null)}
                  disabled={isCompleting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isCompleting}
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                >
                  {isCompleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Sign-Off &amp; Restore Asset</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

