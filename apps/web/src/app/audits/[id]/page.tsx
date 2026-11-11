'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import useSWR from 'swr';
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
  ChevronDown,
  ChevronUp,
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
  ExternalLink,
  PanelLeftClose,
  PanelLeftOpen,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
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

  const {
    data: rawPlan,
    error: planError,
    isLoading: planLoading,
    mutate: mutatePlan,
  } = useSWR(planId ? `/api/audits/plans/${planId}` : null, {
    refreshInterval: 30000, // Auto-update every 30 seconds
    revalidateOnFocus: true, // Auto-refresh when tab/window becomes active
    revalidateOnReconnect: true,
  });

  const plan: AuditPlanDetails | null =
    rawPlan?.data !== undefined ? rawPlan.data : rawPlan || null;
  const loading = planLoading && !plan;
  const error = planError ? planError?.message || 'Could not load plan details' : null;

  // Selected active session & items
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isSessionsCollapsed, setIsSessionsCollapsed] = useState(false);

  const selectedSession = useMemo(() => {
    return plan?.sessions.find((s) => s.id === selectedSessionId) || null;
  }, [plan?.sessions, selectedSessionId]);

  useEffect(() => {
    if (plan?.sessions && plan.sessions.length > 0 && !selectedSessionId) {
      setSelectedSessionId(plan.sessions[0].id);
    }
  }, [plan, selectedSessionId]);

  const {
    data: rawItems,
    isLoading: itemsLoading,
    mutate: mutateSessionItems,
  } = useSWR(selectedSessionId ? `/api/audits/sessions/${selectedSessionId}/items` : null, {
    refreshInterval: 30000, // Auto-update every 30 seconds
    revalidateOnFocus: true, // Auto-refresh when tab/window becomes active
    revalidateOnReconnect: true,
  });

  const sessionItems: AuditItem[] = Array.isArray(rawItems?.data)
    ? rawItems.data
    : Array.isArray(rawItems)
      ? rawItems
      : [];
  const loadingItems = itemsLoading && sessionItems.length === 0;

  const { data: rawLocations } = useSWR('/api/locations');
  const locations: LocationOption[] = Array.isArray(rawLocations?.data)
    ? rawLocations.data
    : Array.isArray(rawLocations)
      ? rawLocations
      : [];

  // Pending Transfers SWR to track active transfer requests
  const { data: rawTransfers, mutate: mutateTransfers } = useSWR(
    '/api/transfers?status=PENDING&limit=200',
    {
      refreshInterval: 30000, // Auto-update every 30 seconds
      revalidateOnFocus: true,
    },
  );

  // Auto-refresh when browser window/tab becomes active or visible
  useEffect(() => {
    const handleActive = () => {
      mutatePlan();
      if (selectedSessionId) {
        mutateSessionItems();
      }
      mutateTransfers();
    };

    window.addEventListener('focus', handleActive);
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleActive();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleActive);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [mutatePlan, mutateSessionItems, mutateTransfers, selectedSessionId]);
  const pendingTransfers: any[] = Array.isArray(rawTransfers?.data)
    ? rawTransfers.data
    : Array.isArray(rawTransfers)
      ? rawTransfers
      : [];

  // Transfer Generation Modal State
  const [transferModalItems, setTransferModalItems] = useState<AuditItem[] | null>(null);
  const [transferReason, setTransferReason] = useState<string>('');
  const [isGeneratingTransfer, setIsGeneratingTransfer] = useState(false);
  const [transferFormError, setTransferFormError] = useState<string | null>(null);
  const [transferSuccessBanner, setTransferSuccessBanner] = useState<string | null>(null);
  const [generatedTransferAssetIds, setGeneratedTransferAssetIds] = useState<Set<string>>(new Set());

  const getPendingTransferForAsset = (assetId: string) => {
    return (
      generatedTransferAssetIds.has(assetId) ||
      pendingTransfers.find((t: any) => t.assetId === assetId)
    );
  };

  const handleOpenTransferModal = (itemOrItems: AuditItem | AuditItem[]) => {
    const items = Array.isArray(itemOrItems) ? itemOrItems : [itemOrItems];
    if (items.length === 0) return;
    setTransferModalItems(items);
    setTransferFormError(null);
    if (items.length === 1) {
      const item = items[0];
      const fromName = item.expectedLocation?.name || 'Unassigned Location';
      const toName = item.foundLocation?.name || 'Current Station';
      setTransferReason(
        `Audit relocation: Asset ${item.asset.assetCode} physically found at ${toName} (previously assigned to ${fromName})`,
      );
    } else {
      setTransferReason(
        `Audit relocation: Batch transfer for ${items.length} relocated assets physically found during audit session`,
      );
    }
  };

  const handleConfirmTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferModalItems || transferModalItems.length === 0) return;

    setIsGeneratingTransfer(true);
    setTransferFormError(null);

    try {
      const validItems = transferModalItems.filter((i) => Boolean(i.foundLocation));
      if (validItems.length === 0) {
        throw new Error('None of the selected assets have a detected physical location');
      }

      const promises = validItems.map((item) =>
        fetch('/api/transfers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assetId: item.asset.id,
            toLocationId: item.foundLocation!.id,
            reason: transferReason.trim(),
          }),
        }).then(async (res) => {
          if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            throw new Error(
              errJson?.message || `Failed to generate transfer for ${item.asset.assetCode}`,
            );
          }
          return item.asset.id;
        }),
      );

      const transferredAssetIds = await Promise.all(promises);

      setGeneratedTransferAssetIds((prev) => {
        const next = new Set(prev);
        transferredAssetIds.forEach((id) => next.add(id));
        return next;
      });

      await mutateTransfers();
      setSelectedChecklistIds(new Set());

      if (validItems.length === 1) {
        const item = validItems[0];
        const fromName = item.expectedLocation?.name || 'Previous Location';
        const toName = item.foundLocation?.name || 'Current Location';
        setTransferSuccessBanner(
          `Location transfer request generated for ${item.asset.assetCode} (${fromName} → ${toName})! It is now pending approval in Transfers.`,
        );
      } else {
        setTransferSuccessBanner(
          `Batch transfer requests generated for ${validItems.length} relocated assets! They are now pending approval in Transfers.`,
        );
      }
      setTimeout(() => setTransferSuccessBanner(null), 8000);

      setTransferModalItems(null);
    } catch (err: any) {
      setTransferFormError(err.message || 'Could not generate transfer');
    } finally {
      setIsGeneratingTransfer(false);
    }
  };

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

  // Checklist Multi-Selection State
  const [selectedChecklistIds, setSelectedChecklistIds] = useState<Set<string>>(new Set());
  const [isBatchUpdating, setIsBatchUpdating] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  // Clear selection when session changes
  useEffect(() => {
    setSelectedChecklistIds(new Set());
  }, [selectedSessionId]);

  // Sync indeterminate state of master select-all checkbox
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        selectedChecklistIds.size > 0 &&
        selectedChecklistIds.size < filteredSessionItems.length;
    }
  }, [selectedChecklistIds, filteredSessionItems.length]);

  const toggleSelectAll = () => {
    if (filteredSessionItems.length === 0) return;
    const allFilteredSelected = filteredSessionItems.every((i) =>
      selectedChecklistIds.has(i.id),
    );
    if (allFilteredSelected) {
      setSelectedChecklistIds((prev) => {
        const next = new Set(prev);
        filteredSessionItems.forEach((i) => next.delete(i.id));
        return next;
      });
    } else {
      setSelectedChecklistIds((prev) => {
        const next = new Set(prev);
        filteredSessionItems.forEach((i) => next.add(i.id));
        return next;
      });
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedChecklistIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const isMismatchItem = (item: AuditItem) => {
    return (
      item.status === 'MISMATCH' ||
      item.status === 'LOCATION_MISMATCH' ||
      Boolean(
        item.expectedLocation &&
        item.foundLocation &&
        item.expectedLocation.id !== item.foundLocation.id,
      )
    );
  };

  const selectedItems = useMemo(() => {
    return sessionItems.filter((i) => selectedChecklistIds.has(i.id));
  }, [sessionItems, selectedChecklistIds]);

  const allSelectedAreMismatch = useMemo(() => {
    if (selectedItems.length === 0) return false;
    return selectedItems.every(isMismatchItem);
  }, [selectedItems]);

  const allSelectedArePending = useMemo(() => {
    if (selectedItems.length === 0) return false;
    return selectedItems.every((i) => i.status === 'PENDING');
  }, [selectedItems]);

  const pendingTransferSelectedCount = useMemo(() => {
    return selectedItems.filter((i) => getPendingTransferForAsset(i.asset.id)).length;
  }, [selectedItems, generatedTransferAssetIds, pendingTransfers]);

  const handleBatchAction = async (
    action: 'MARK_MISSING' | 'MARK_VERIFIED' | 'RESET_PENDING',
  ) => {
    if (!selectedSessionId || selectedChecklistIds.size === 0) return;

    const actionLabel =
      action === 'MARK_MISSING'
        ? 'MISSING'
        : action === 'MARK_VERIFIED'
          ? 'VERIFIED'
          : 'PENDING';

    if (
      !confirm(
        `Are you sure you want to batch update ${selectedChecklistIds.size} selected asset(s) to ${actionLabel}?`,
      )
    ) {
      return;
    }

    setIsBatchUpdating(true);
    try {
      const res = await fetch(`/api/audits/sessions/${selectedSessionId}/items/batch`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemIds: Array.from(selectedChecklistIds),
          action,
          notes: `Batch updated to ${actionLabel} from Session Inventory Checklist`,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to update selected items');
      }

      await fetchPlanDetails();
      await mutateSessionItems();
      const updatedCount = selectedChecklistIds.size;
      setSelectedChecklistIds(new Set());
      setTransferSuccessBanner(
        `Batch updated ${updatedCount} asset(s) to ${actionLabel} successfully.`,
      );
      setTimeout(() => setTransferSuccessBanner(null), 6000);
    } catch (e: any) {
      alert(e.message || 'Error processing batch action');
    } finally {
      setIsBatchUpdating(false);
    }
  };

  const handleExportSelectedToCsv = () => {
    if (selectedChecklistIds.size === 0 || !selectedSessionId) return;
    const selectedItems = sessionItems.filter((i) => selectedChecklistIds.has(i.id));
    if (selectedItems.length === 0) return;

    const headers = [
      'Asset Code',
      'Asset Name',
      'Model',
      'Expected Location',
      'Physical Location',
      'Status',
      'Condition',
    ];
    const rows = selectedItems.map((i) => [
      `"${i.asset.assetCode}"`,
      `"${(i.asset.name || '').replace(/"/g, '""')}"`,
      `"${(i.asset.model || '').replace(/"/g, '""')}"`,
      `"${(i.expectedLocation?.name || 'Unassigned').replace(/"/g, '""')}"`,
      `"${(i.foundLocation?.name || 'Not scanned yet').replace(/"/g, '""')}"`,
      `"${i.status}"`,
      `"${i.condition || '-'}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Session-Selected-Assets-${selectedSessionId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
  const [isSubmittingSession, setIsSubmittingSession] = useState(false);
  const [sessionFormError, setSessionFormError] = useState<string | null>(null);
  const [sessionForm, setSessionForm] = useState({
    locationId: '',
    notes: '',
  });

  const fetchPlanDetails = async () => {
    await Promise.all([
      mutatePlan(),
      selectedSessionId ? mutateSessionItems() : Promise.resolve(),
      mutateTransfers(),
    ]);
  };

  const fetchSessionItems = async (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setChecklistPage(1);
    setChecklistSearch('');
    setChecklistStatusFilter('ALL');
  };

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
        mutateSessionItems([]);
      }
    } catch (e: any) {
      alert(e.message || 'Could not delete session');
    }
  };

  const handleCompleteSession = async (sessionId: string) => {
    const isSelected = selectedSessionId === sessionId;
    const targetItems = isSelected ? sessionItems : [];
    const pendingCount = targetItems.filter((i) => i.status === 'PENDING').length;
    let markUnscannedAsMissing = false;

    if (pendingCount > 0) {
      const choice = confirm(
        `Session Completion Notice:\nThere are ${pendingCount} expected assets that were NOT scanned in this session.\n\nClick OK to mark all ${pendingCount} remaining items as MISSING.\nClick Cancel to complete the session while leaving them as PENDING.`,
      );
      markUnscannedAsMissing = choice;
    }

    try {
      const res = await fetch(`/api/audits/sessions/${sessionId}/complete`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markUnscannedAsMissing }),
      });
      if (!res.ok) {
        throw new Error('Failed to mark session as complete');
      }
      await fetchPlanDetails();
      if (isSelected) {
        await mutateSessionItems();
      }
    } catch (e: any) {
      alert(e.message || 'Could not complete session');
    }
  };

  const handleMarkSessionUnscannedMissing = async (sessionId: string) => {
    const pendingCount = sessionItems.filter((i) => i.status === 'PENDING').length;
    if (pendingCount === 0) {
      alert('There are no pending unscanned items in this session.');
      return;
    }
    if (
      !confirm(
        `Are you sure you want to mark all ${pendingCount} unscanned items in this session as MISSING?`,
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/audits/sessions/${sessionId}/mark-unscanned-missing`, {
        method: 'PUT',
      });
      if (!res.ok) throw new Error('Failed to mark unscanned items as missing');
      await fetchPlanDetails();
      await mutateSessionItems();
      alert(`Successfully marked ${pendingCount} items as MISSING.`);
    } catch (e: any) {
      alert(e.message || 'Could not mark items as missing');
    }
  };

  const handleMarkSingleItemMissing = async (itemId: string, assetCode: string) => {
    if (!selectedSessionId) return;
    if (!confirm(`Mark equipment "${assetCode}" as MISSING in this session?`)) return;

    try {
      const res = await fetch(`/api/audits/sessions/${selectedSessionId}/items/${itemId}/mark-missing`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Marked as MISSING during web review' }),
      });
      if (!res.ok) throw new Error('Failed to mark item as missing');
      await fetchPlanDetails();
      await mutateSessionItems();
    } catch (e: any) {
      alert(e.message || 'Could not mark item as missing');
    }
  };

  const handleApproveMissingAsLost = async (discrepancyId: string, assetCode: string) => {
    const notes = prompt(
      `MANAGER APPROVAL:\nConfirm write-off for equipment "${assetCode}"?\n\nThis will update the master catalog status to LOST and create an audit trail.\n\nEnter approval notes:`,
      'Confirmed missing during inventory audit review',
    );
    if (notes === null) return; // User cancelled

    try {
      const res = await fetch(`/api/audits/discrepancies/${discrepancyId}/approve-lost`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to approve missing asset');
      }
      await fetchPlanDetails();
      if (selectedSessionId) {
        await mutateSessionItems();
      }
      alert(`Asset "${assetCode}" has been approved as LOST and updated in master catalog.`);
    } catch (e: any) {
      alert(e.message || 'Could not approve missing asset');
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
      if (selectedSessionId === sessionId) {
        await mutateSessionItems();
      }
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
      case 'LOCATION_MISMATCH':
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
            title="Auto-refreshes on active & every 30s. Click to refresh immediately."
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

      {/* Main Workspace: Left Sessions Sidebar + Right Checklist Area */}
      <div className="flex flex-col lg:flex-row gap-4 items-start w-full">
        {/* Left Column: Sessions Sidebar */}
        <aside
          className={cn(
            'transition-all duration-300 ease-in-out shrink-0 select-none w-full',
            isSessionsCollapsed ? 'lg:w-14' : 'lg:w-[310px] xl:w-[330px]'
          )}
        >
          {isSessionsCollapsed ? (
            /* Collapsed Rail View */
            <div className="bg-card border rounded-xl p-2 flex flex-col items-center gap-2 shadow-2xs">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsSessionsCollapsed(false)}
                className="h-8 w-8 text-primary hover:bg-primary/10 rounded-lg shrink-0"
                title="Expand Sessions Sidebar"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsSessionModalOpen(true)}
                className="h-8 w-8 rounded-lg shrink-0 text-muted-foreground hover:text-foreground"
                title="Start New Session"
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>

              <div className="w-6 h-px bg-border my-0.5" />

              {/* Quick Session Picker Icons */}
              <div className="space-y-1.5 w-full flex flex-col items-center">
                {plan.sessions.map((sess) => {
                  const isSelected = sess.id === selectedSessionId;
                  return (
                    <button
                      key={sess.id}
                      onClick={() => setSelectedSessionId(sess.id)}
                      title={`${sess.location?.name || 'All Scoped Stations'} (${sess._count?.items || 0} items) • Status: ${sess.status}`}
                      className={cn(
                        'h-9 w-9 rounded-lg flex items-center justify-center transition-all relative group',
                        isSelected
                          ? 'bg-primary text-primary-foreground shadow-xs font-bold ring-2 ring-primary/40'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent hover:border-border'
                      )}
                    >
                      <Building className="w-4 h-4 shrink-0" />
                      {Boolean(sess._count?.items) && (
                        <span
                          className={cn(
                            'absolute -top-1 -right-1 text-[9px] px-1 rounded-full font-mono font-bold leading-tight',
                            isSelected
                              ? 'bg-primary-foreground text-primary border border-primary'
                              : 'bg-muted text-foreground border'
                          )}
                        >
                          {sess._count?.items}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Expanded Full Sidebar View */
            <div className="space-y-3 bg-card border p-3 rounded-xl shadow-2xs">
              <div className="flex items-center justify-between pb-2 border-b">
                <div className="flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-primary shrink-0" />
                  <h2 className="font-bold text-sm tracking-tight text-foreground">
                    Active Sessions ({plan.sessions.length})
                  </h2>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsSessionModalOpen(true)}
                    className="h-7 px-2 gap-1 text-xs"
                    title="Start New Session"
                  >
                    <Plus className="w-3 h-3" />
                    <span>New</span>
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsSessionsCollapsed(true)}
                    className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-lg"
                    title="Collapse Sessions Sidebar"
                  >
                    <PanelLeftClose className="w-4 h-4" />
                  </Button>
                </div>
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
                <div className="space-y-2.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                  {plan.sessions.map((sess) => {
                    const isSelected = sess.id === selectedSessionId;
                    return (
                      <Card
                        key={sess.id}
                        onClick={() => setSelectedSessionId(sess.id)}
                        className={`cursor-pointer transition-all ${isSelected
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
          )}
        </aside>

        {/* Right Column: Pre-Populated Checklist & Scan Status Table */}
        <div className="flex-1 min-w-0 w-full space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {isSessionsCollapsed && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSessionsCollapsed(false)}
                  className="h-7 px-2 text-xs gap-1 text-primary border-primary/30 hover:bg-primary/5 shadow-2xs"
                  title="Expand Sessions Sidebar"
                >
                  <PanelLeftOpen className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline font-medium">Sessions</span>
                </Button>
              )}
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
                {sessionItems.filter((i) => i.status === 'PENDING').length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleMarkSessionUnscannedMissing(selectedSessionId)}
                    className="h-8 gap-1.5 text-xs text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10 shadow-2xs font-semibold"
                    title={`Mark ${sessionItems.filter((i) => i.status === 'PENDING').length} unscanned assets as MISSING`}
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                    <span>
                      Mark {sessionItems.filter((i) => i.status === 'PENDING').length} Unscanned as MISSING
                    </span>
                  </Button>
                )}

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

          {/* Location Transfer Success Banner */}
          {transferSuccessBanner && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs flex items-center justify-between gap-2 shadow-2xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{transferSuccessBanner}</span>
              </div>
              <Link
                href="/transfers"
                target="_blank"
                className="font-semibold underline shrink-0 hover:opacity-80 flex items-center gap-1"
              >
                <span>Open Transfers</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          )}

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
            <div className="space-y-3">
              {/* Top-Level Multiple Selection Batch Actions Bar */}
              {selectedChecklistIds.size > 0 && (
                <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-1 shadow-xs">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-primary text-primary-foreground font-bold text-xs px-2.5 py-0.5">
                      {selectedChecklistIds.size} Selected
                    </Badge>
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      of {filteredSessionItems.length} in view
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedChecklistIds(new Set())}
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Clear
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Transfer Button when all selected are mismatch */}
                    {allSelectedAreMismatch && (
                      <>
                        {pendingTransferSelectedCount === selectedItems.length ? (
                          <Badge
                            variant="outline"
                            className="h-8 px-2.5 text-xs gap-1.5 border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-medium shadow-2xs"
                            title="All selected mismatch assets already have transfer requests pending approval"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                            <span>Transfers Pending ({selectedChecklistIds.size})</span>
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isGeneratingTransfer || isBatchUpdating}
                            onClick={() =>
                              handleOpenTransferModal(
                                selectedItems.filter(
                                  (i) =>
                                    isMismatchItem(i) &&
                                    !getPendingTransferForAsset(i.asset.id),
                                ),
                              )
                            }
                            className="h-8 gap-1.5 text-xs border-amber-400 text-amber-800 bg-amber-50 hover:bg-amber-100 hover:text-amber-900 shadow-2xs font-bold dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700 animate-in fade-in zoom-in-95"
                            title={`Generate location transfer request(s) for ${selectedChecklistIds.size} relocated asset(s)`}
                          >
                            <ArrowLeftRight className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            <span>Transfer ({selectedChecklistIds.size})</span>
                          </Button>
                        )}
                      </>
                    )}

                    {/* Batch Mark as MISSING - only show if all selected rows are PENDING */}
                    {allSelectedArePending && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isBatchUpdating}
                        onClick={() => handleBatchAction('MARK_MISSING')}
                        className="h-8 gap-1.5 text-xs text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10 font-semibold shadow-2xs"
                        title="Mark all selected assets as MISSING"
                      >
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                        <span>Mark MISSING ({selectedChecklistIds.size})</span>
                      </Button>
                    )}


                    {/* Batch Reset to PENDING */}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isBatchUpdating}
                      onClick={() => handleBatchAction('RESET_PENDING')}
                      className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground shadow-2xs"
                      title="Reset all selected assets back to PENDING"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset Status</span>
                    </Button>

                    {/* Export Selected to CSV */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleExportSelectedToCsv}
                      className="h-8 gap-1.5 text-xs shadow-2xs font-medium"
                      title="Export selected asset checklist items to CSV"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export CSV</span>
                    </Button>
                  </div>
                </div>
              )}

              <Card className="overflow-hidden border bg-card">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 text-[11px]">
                        <TableHead className="w-[42px] px-3">
                          <input
                            ref={selectAllRef}
                            type="checkbox"
                            id="selectAllChecklistItems"
                            aria-label="Select all assets in this checklist"
                            checked={
                              filteredSessionItems.length > 0 &&
                              filteredSessionItems.every((i) => selectedChecklistIds.has(i.id))
                            }
                            onChange={toggleSelectAll}
                            className="h-4 w-4 rounded border-muted-foreground/40 text-primary accent-primary cursor-pointer align-middle"
                          />
                        </TableHead>
                        <TableHead className="w-[135px] min-w-[125px]">Asset Code</TableHead>
                        <TableHead>Asset Name</TableHead>
                        <TableHead className="w-[120px]">Expected Location</TableHead>
                        <TableHead className="w-[120px]">Physical Location</TableHead>
                        <TableHead className="w-[90px]">Audit Status</TableHead>
                        <TableHead className="w-[90px]">Condition</TableHead>
                        <TableHead className="w-[110px] text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSessionItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
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
                          <TableRow
                            key={item.id}
                            className={`text-xs hover:bg-muted/30 transition-colors ${
                              selectedChecklistIds.has(item.id) ? 'bg-primary/5 dark:bg-primary/10' : ''
                            }`}
                          >
                            <TableCell className="px-3">
                              <input
                                type="checkbox"
                                aria-label={`Select asset ${item.asset.assetCode}`}
                                checked={selectedChecklistIds.has(item.id)}
                                onChange={() => toggleSelectItem(item.id)}
                                className="h-4 w-4 rounded border-muted-foreground/40 text-primary accent-primary cursor-pointer align-middle"
                              />
                            </TableCell>
                            <TableCell className="font-mono font-semibold text-primary whitespace-nowrap">
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
                              {/* Location Mismatch Transfer Action */}
                              {(item.status === 'MISMATCH' ||
                                item.status === 'LOCATION_MISMATCH' ||
                                Boolean(
                                  item.expectedLocation &&
                                  item.foundLocation &&
                                  item.expectedLocation.id !== item.foundLocation.id,
                                )) && (
                                  <>
                                    {getPendingTransferForAsset(item.asset.id) ? (
                                      <Link href={`/transfers?code=${item.asset.assetCode}`} target="_blank">
                                        <Badge
                                          variant="outline"
                                          className="h-7 px-2.5 text-[10px] gap-1 border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 hover:bg-blue-100 cursor-pointer shadow-2xs font-medium"
                                          title="Transfer request is pending approval in Transfers menu"
                                        >
                                          <CheckCircle2 className="w-3 h-3 text-blue-600 shrink-0" />
                                          <span>Transfer Pending</span>
                                          <ExternalLink className="w-2.5 h-2.5 opacity-70" />
                                        </Badge>
                                      </Link>
                                    ) : (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleOpenTransferModal(item)}
                                        className="h-7 px-2.5 text-[11px] gap-1.5 border-amber-400 text-amber-800 bg-amber-50 hover:bg-amber-100 hover:text-amber-900 shadow-2xs font-semibold dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700"
                                        title={`Generate transfer request from ${item.expectedLocation?.name || 'previous location'} to ${item.foundLocation?.name || 'current location'}`}
                                      >
                                        <ArrowLeftRight className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                        <span>Transfer</span>
                                      </Button>
                                    )}
                                  </>
                                )}

                              {/* Damage Repair Action */}
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

                              {/* Missing Discrepancy Manager Approval */}
                              {item.status === 'MISSING' && item.discrepancy && (
                                <>
                                  {item.discrepancy.resolvedAt ? (
                                    <Badge
                                      variant="outline"
                                      className="h-7 px-2 text-[10px] gap-1 border-rose-400 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 shadow-2xs font-medium"
                                      title="Manager write-off approval completed"
                                    >
                                      <CheckCircle2 className="w-3 h-3 text-rose-600 shrink-0" />
                                      <span>Lost Approved</span>
                                    </Badge>
                                  ) : (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleApproveMissingAsLost(item.discrepancy!.id, item.asset.assetCode)}
                                      className="h-7 px-2 text-[11px] gap-1 border-rose-400 text-rose-800 bg-rose-50 hover:bg-rose-100 hover:text-rose-900 shadow-2xs font-semibold dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-700"
                                      title={`Manager approval: write off asset ${item.asset.assetCode} and set status to LOST in master registry`}
                                    >
                                      <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                                      <span>Approve as LOST</span>
                                    </Button>
                                  )}
                                </>
                              )}

                              {/* Single Item Mark Missing Action */}
                              {item.status === 'PENDING' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleMarkSingleItemMissing(item.id, item.asset.assetCode)}
                                  className="h-7 px-2 text-[11px] gap-1 border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 hover:text-amber-800"
                                  title={`Mark asset ${item.asset.assetCode} as MISSING`}
                                >
                                  <AlertCircle className="w-3 h-3 text-amber-600" />
                                  <span>Mark Missing</span>
                                </Button>
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
                              className={`h-7 min-w-7 px-2 text-xs font-semibold ${safeChecklistPage === p ? 'shadow-xs' : 'hover:bg-muted'
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
          </div>
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

      {/* Location Transfer Generation Modal */}
      {transferModalItems && transferModalItems.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-card w-full max-w-lg rounded-xl shadow-2xl border p-5 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3 border-b pb-3">
              <div className="space-y-0.5">
                <h3 className="font-bold text-base flex items-center gap-2 text-foreground">
                  <ArrowLeftRight className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  <span>
                    {transferModalItems.length === 1
                      ? 'Generate Location Transfer'
                      : `Generate Batch Transfers (${transferModalItems.length})`}
                  </span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  {transferModalItems.length === 1
                    ? 'Relocate asset to verified physical station based on audit findings'
                    : `Relocate ${transferModalItems.length} assets to their verified physical stations based on audit findings`}
                </p>
              </div>
              <button
                onClick={() => setTransferModalItems(null)}
                className="p-1 rounded-md text-muted-foreground hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {transferFormError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-lg text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{transferFormError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmTransfer} className="space-y-4 text-xs">
              {transferModalItems.length === 1 ? (
                <>
                  {/* Asset Details Box */}
                  <div className="p-3 bg-muted/40 border rounded-lg space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-sm text-foreground">
                        {transferModalItems[0].asset.assetCode}
                      </span>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {transferModalItems[0].asset.model || 'Equipment'}
                      </Badge>
                    </div>
                    <div className="text-foreground font-medium text-xs">
                      {transferModalItems[0].asset.name}
                    </div>
                  </div>

                  {/* Transfer Route: Previous Location -> Current Location */}
                  <div className="grid grid-cols-2 gap-3 p-3 bg-accent/30 border rounded-lg">
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-muted-foreground block">
                        Previous Location (From)
                      </span>
                      <div className="font-medium text-foreground flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">
                          {transferModalItems[0].expectedLocation?.name || 'Unassigned'}
                        </span>
                      </div>
                      {transferModalItems[0].expectedLocation?.code && (
                        <span className="text-[10px] font-mono text-muted-foreground block">
                          Code: {transferModalItems[0].expectedLocation.code}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 border-l pl-3 border-border">
                      <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 block flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>Current Location (To)</span>
                      </span>
                      <div className="font-bold text-foreground truncate">
                        {transferModalItems[0].foundLocation?.name || 'Current Station'}
                      </div>
                      {transferModalItems[0].foundLocation?.code && (
                        <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 block">
                          Code: {transferModalItems[0].foundLocation.code}
                        </span>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Batch Relocated Assets Preview List */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        Relocated Assets ({transferModalItems.length})
                      </span>
                      <span>Routing to physical station</span>
                    </div>
                    <div className="max-h-48 overflow-y-auto rounded-lg border divide-y bg-muted/20">
                      {transferModalItems.map((item) => (
                        <div
                          key={item.id}
                          className="p-2.5 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-foreground">
                                {item.asset.assetCode}
                              </span>
                              <span className="text-muted-foreground truncate">
                                {item.asset.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                              <span className="truncate">
                                {item.expectedLocation?.name || 'Unassigned'}
                              </span>
                              <ArrowLeftRight className="w-3 h-3 text-amber-500 shrink-0" />
                              <span className="font-medium text-emerald-600 dark:text-emerald-400 truncate">
                                {item.foundLocation?.name || 'Current Station'}
                              </span>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-[10px] shrink-0 font-mono">
                            {item.asset.model || 'Equipment'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Transfer Reason */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Transfer Reason & Audit Notes
                </label>
                <textarea
                  rows={3}
                  className="w-full p-2.5 rounded-lg border bg-background text-xs resize-none"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="Reason for transfer..."
                  required
                />
                <p className="text-[10px] text-muted-foreground">
                  A pending transfer request will be generated and routed for approval in the Transfers menu.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setTransferModalItems(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isGeneratingTransfer}
                  className="gap-1.5 shadow-sm bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                >
                  {isGeneratingTransfer ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Transferring...</span>
                    </>
                  ) : (
                    <>
                      <ArrowLeftRight className="w-4 h-4" />
                      <span>
                        {transferModalItems.length === 1
                          ? 'Generate Transfer'
                          : `Generate ${transferModalItems.length} Transfers`}
                      </span>
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

