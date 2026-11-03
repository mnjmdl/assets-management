'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Truck,
  Plus,
  Search,
  Building,
  Mail,
  Phone,
  Globe,
  MapPin,
  Pencil,
  Trash2,
  RotateCw,
  Loader2,
  ExternalLink,
  Boxes,
  Wrench,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Check,
  X,
  ShieldCheck,
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

interface VendorItem {
  id: string;
  name: string;
  code: string;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
  serviceTypes?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    assets: number;
    maintenanceRecords?: number;
    maintenanceSchedules?: number;
  };
}

interface VendorStats {
  total: number;
  active: number;
  inactive: number;
  totalAssetsSupplied: number;
  totalServiceOrders: number;
}

const PRESET_SERVICE_TYPES = [
  'Equipment Supplier',
  'OEM Spare Parts',
  'Preventive Maintenance',
  'Calibration & Testing',
  'Electrical & Automation',
  'Hydraulics & Pneumatics',
];

export default function VendorsPage() {
  const [vendors, setVendors] = useState<VendorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stats
  const [stats, setStats] = useState<VendorStats>({
    total: 0,
    active: 0,
    inactive: 0,
    totalAssetsSupplied: 0,
    totalServiceOrders: 0,
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<VendorItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    website: '',
    serviceTypes: [] as string[],
    customServiceType: '',
    isActive: true,
  });

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, vendorsRes] = await Promise.all([
        fetch('/api/vendors/stats'),
        fetch('/api/vendors?limit=100'),
      ]);

      if (statsRes.ok) {
        const sJson = await statsRes.json();
        setStats(sJson?.data || sJson || {});
      }

      if (vendorsRes.ok) {
        const vJson = await vendorsRes.json();
        const vList = Array.isArray(vJson?.data) ? vJson.data : Array.isArray(vJson) ? vJson : [];
        setVendors(vList);
      }
    } catch (err: any) {
      console.error('Error fetching vendors:', err);
      setError(err.message || 'Could not load vendors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    setEditingVendor(null);
    setFormData({
      name: '',
      code: '',
      contactPerson: '',
      email: '',
      phone: '',
      address: '',
      website: '',
      serviceTypes: ['Equipment Supplier'],
      customServiceType: '',
      isActive: true,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (vendor: VendorItem) => {
    setEditingVendor(vendor);
    const parsedServices = vendor.serviceTypes
      ? vendor.serviceTypes.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    setFormData({
      name: vendor.name,
      code: vendor.code,
      contactPerson: vendor.contactPerson || '',
      email: vendor.email || '',
      phone: vendor.phone || '',
      address: vendor.address || '',
      website: vendor.website || '',
      serviceTypes: parsedServices,
      customServiceType: '',
      isActive: vendor.isActive,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleToggleServiceType = (type: string) => {
    setFormData((prev) => {
      const exists = prev.serviceTypes.includes(type);
      return {
        ...prev,
        serviceTypes: exists
          ? prev.serviceTypes.filter((t) => t !== type)
          : [...prev.serviceTypes, type],
      };
    });
  };

  const handleAddCustomServiceType = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();
    const trimmed = formData.customServiceType.trim();
    if (trimmed && !formData.serviceTypes.includes(trimmed)) {
      setFormData((prev) => ({
        ...prev,
        serviceTypes: [...prev.serviceTypes, trimmed],
        customServiceType: '',
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setFormError('Vendor name is required');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        name: formData.name.trim(),
        code: formData.code.trim() || undefined,
        contactPerson: formData.contactPerson.trim() || undefined,
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        address: formData.address.trim() || undefined,
        website: formData.website.trim() || undefined,
        serviceTypes: formData.serviceTypes.join(', ') || undefined,
        isActive: formData.isActive,
      };

      const url = editingVendor ? `/api/vendors/${editingVendor.id}` : '/api/vendors';
      const method = editingVendor ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.message || 'Failed to save vendor');
      }

      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      console.error('Error saving vendor:', err);
      setFormError(err.message || 'Failed to save vendor record');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (vendor: VendorItem) => {
    try {
      const res = await fetch(`/api/vendors/${vendor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !vendor.isActive }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.message || 'Failed to update vendor status');
      }
      fetchData();
    } catch (e: any) {
      alert(e.message || 'Error updating vendor status');
    }
  };

  // Filter vendors
  const filteredVendors = vendors.filter((v) => {
    if (statusFilter === 'ACTIVE' && !v.isActive) return false;
    if (statusFilter === 'INACTIVE' && v.isActive) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = v.name?.toLowerCase().includes(q);
      const matchCode = v.code?.toLowerCase().includes(q);
      const matchContact = v.contactPerson?.toLowerCase().includes(q);
      const matchEmail = v.email?.toLowerCase().includes(q);
      const matchPhone = v.phone?.toLowerCase().includes(q);
      const matchServices = v.serviceTypes?.toLowerCase().includes(q);
      if (!matchName && !matchCode && !matchContact && !matchEmail && !matchPhone && !matchServices) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="space-y-5 pb-12 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Truck className="w-6 h-6 text-primary" />
            <span>Vendors &amp; Suppliers Directory</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Manage equipment manufacturers, OEM suppliers, and third-party maintenance contractors.
          </p>
        </div>
        <Button onClick={openCreateModal} className="gap-1.5 text-xs h-9 shadow-sm">
          <Plus className="w-3.5 h-3.5" />
          <span>+ Register New Vendor</span>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="p-3.5 border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Total Vendors
            </span>
            <Truck className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold text-foreground mt-1">{stats.total}</div>
          <span className="text-[10px] text-muted-foreground">Registered suppliers</span>
        </Card>

        <Card className="p-3.5 border bg-card border-emerald-200/50 dark:border-emerald-900/30">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Active Partners
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">{stats.active}</div>
          <span className="text-[10px] text-muted-foreground">Eligible for orders</span>
        </Card>

        <Card className="p-3.5 border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Inactive
            </span>
            <XCircle className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="text-2xl font-bold text-foreground mt-1">{stats.inactive}</div>
          <span className="text-[10px] text-muted-foreground">Archived vendors</span>
        </Card>

        <Card className="p-3.5 border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Supplied Assets
            </span>
            <Boxes className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-primary mt-1">{stats.totalAssetsSupplied}</div>
          <span className="text-[10px] text-muted-foreground">In active inventory</span>
        </Card>

        <Card className="p-3.5 border bg-card">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Service Work Orders
            </span>
            <Wrench className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-amber-700 dark:text-amber-400 mt-1">
            {stats.totalServiceOrders}
          </div>
          <span className="text-[10px] text-muted-foreground">Maintenance tasks</span>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="border shadow-xs overflow-hidden">
        {/* Search & Filter Bar */}
        <div className="p-3 sm:p-4 border-b bg-background flex flex-wrap items-center justify-between gap-2.5">
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Search vendor name, code, contact person, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs bg-muted/20"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground font-medium">Status:</span>
              <select
                value={statusFilter}
                onChange={(e: any) => setStatusFilter(e.target.value)}
                className="h-8 px-2.5 rounded-lg border bg-background text-xs font-semibold text-foreground"
              >
                <option value="ALL">All ({vendors.length})</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive Only</option>
              </select>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={fetchData}
              className="h-8 text-xs gap-1"
              title="Refresh directory"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Vendors Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 text-[11px]">
                <TableHead className="w-[200px]">Vendor Name &amp; Code</TableHead>
                <TableHead className="w-[180px]">Contact Person</TableHead>
                <TableHead className="w-[220px]">Contact Info</TableHead>
                <TableHead>Services Provided</TableHead>
                <TableHead className="w-[120px] text-center">Linked Records</TableHead>
                <TableHead className="w-[90px]">Status</TableHead>
                <TableHead className="w-[120px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                    <p className="text-xs text-muted-foreground mt-2">Loading vendors directory...</p>
                  </TableCell>
                </TableRow>
              ) : filteredVendors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 space-y-2">
                    <Truck className="w-8 h-8 text-muted-foreground/50 mx-auto" />
                    <p className="text-xs font-semibold text-foreground">No Vendors Found</p>
                    <p className="text-[11px] text-muted-foreground">
                      Register equipment manufacturers, spare parts suppliers, and repair contractors.
                    </p>
                    <Button onClick={openCreateModal} size="sm" className="h-8 gap-1 text-xs mt-2">
                      <Plus className="w-3.5 h-3.5" />
                      <span>Register First Vendor</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                filteredVendors.map((v) => {
                  const services = v.serviceTypes
                    ? v.serviceTypes.split(',').map((s) => s.trim()).filter(Boolean)
                    : [];

                  return (
                    <TableRow key={v.id} className="text-xs hover:bg-muted/30">
                      {/* Name & Code */}
                      <TableCell>
                        <div className="font-bold text-foreground flex items-center gap-1.5">
                          <span>{v.name}</span>
                          {v.website && (
                            <a
                              href={v.website.startsWith('http') ? v.website : `https://${v.website}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-muted-foreground hover:text-primary"
                              title="Open Website"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-primary font-semibold mt-0.5">
                          {v.code}
                        </div>
                      </TableCell>

                      {/* Contact Person */}
                      <TableCell>
                        <div className="font-medium text-foreground">
                          {v.contactPerson || <span className="text-muted-foreground italic">—</span>}
                        </div>
                        {v.address && (
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5 line-clamp-1">
                            <MapPin className="w-2.5 h-2.5 shrink-0" />
                            <span>{v.address}</span>
                          </div>
                        )}
                      </TableCell>

                      {/* Contact Info */}
                      <TableCell>
                        <div className="space-y-0.5">
                          {v.email && (
                            <div className="flex items-center gap-1 text-[11px]">
                              <Mail className="w-3 h-3 text-muted-foreground shrink-0" />
                              <a href={`mailto:${v.email}`} className="text-primary hover:underline truncate">
                                {v.email}
                              </a>
                            </div>
                          )}
                          {v.phone && (
                            <div className="flex items-center gap-1 text-[11px]">
                              <Phone className="w-3 h-3 text-muted-foreground shrink-0" />
                              <a href={`tel:${v.phone}`} className="text-foreground hover:underline font-mono">
                                {v.phone}
                              </a>
                            </div>
                          )}
                          {!v.email && !v.phone && (
                            <span className="text-muted-foreground italic text-[11px]">—</span>
                          )}
                        </div>
                      </TableCell>

                      {/* Services Provided */}
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          {services.length > 0 ? (
                            services.map((srv, idx) => (
                              <Badge
                                key={idx}
                                variant="outline"
                                className="text-[10px] py-0 px-1.5 font-normal bg-muted/40"
                              >
                                {srv}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-muted-foreground italic text-[11px]">General Supplier</span>
                          )}
                        </div>
                      </TableCell>

                      {/* Linked Assets & Maintenance */}
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Link
                            href={`/assets?search=${encodeURIComponent(v.name)}`}
                            className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                            title="View supplied equipment in inventory"
                          >
                            <Boxes className="w-3 h-3" />
                            <span>{v._count?.assets || 0}</span>
                          </Link>
                          <span className="text-muted-foreground text-[10px]">•</span>
                          <span
                            className="inline-flex items-center gap-1 text-muted-foreground"
                            title="Maintenance work orders"
                          >
                            <Wrench className="w-3 h-3" />
                            <span>{v._count?.maintenanceRecords || 0}</span>
                          </span>
                        </div>
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        {v.isActive ? (
                          <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-[10px] py-0 font-medium">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] py-0 font-medium text-muted-foreground">
                            Inactive
                          </Badge>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditModal(v)}
                            className="h-7 w-7 text-muted-foreground hover:text-amber-600 hover:bg-amber-50"
                            title="Edit vendor profile"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleActive(v)}
                            className={`h-7 w-7 ${
                              v.isActive
                                ? 'text-muted-foreground hover:text-destructive hover:bg-destructive/10'
                                : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={v.isActive ? 'Deactivate vendor' : 'Activate vendor'}
                          >
                            {v.isActive ? <X className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* CREATE & EDIT VENDOR MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
          <div className="bg-card border rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 sm:p-5 border-b flex items-center justify-between bg-muted/20">
              <div className="space-y-0.5">
                <h2 className="text-base sm:text-lg font-bold tracking-tight">
                  {editingVendor ? `Edit Vendor: ${editingVendor.name}` : 'Register New Vendor / Partner'}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Equipment supplier and third-party maintenance service provider profile.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsModalOpen(false)}
                className="h-8 w-8 rounded-full"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto">
              {formError && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Vendor Name & Code */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Vendor / Company Name <span className="text-destructive">*</span>
                  </label>
                  <Input
                    required
                    placeholder="e.g. Siemens Industry Automation"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>Vendor Code</span>
                    <span className="text-[10px] text-muted-foreground">Auto if blank</span>
                  </label>
                  <Input
                    placeholder="e.g. VND-001"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="font-mono bg-muted/20"
                  />
                </div>
              </div>

              {/* Contact Person & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Primary Contact Person</label>
                  <Input
                    placeholder="e.g. John Doe (Key Account Mgr)"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Phone Number</label>
                  <Input
                    placeholder="e.g. +880 1711 000000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="font-mono"
                  />
                </div>
              </div>

              {/* Email & Website */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Official Email</label>
                  <Input
                    type="email"
                    placeholder="e.g. sales@siemens.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Website URL</label>
                  <Input
                    placeholder="e.g. https://siemens.com"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  />
                </div>
              </div>

              {/* Physical Address */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Physical Office / Factory Address</label>
                <Input
                  placeholder="e.g. Plot 44, Tejgaon Industrial Area, Dhaka"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              {/* Services Provided */}
              <div className="space-y-2 pt-1">
                <label className="text-xs font-semibold text-foreground block">
                  Service Types / Capabilities
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_SERVICE_TYPES.map((type) => {
                    const isSelected = formData.serviceTypes.includes(type);
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => handleToggleServiceType(type)}
                        className={`text-[11px] py-1 px-2.5 rounded-lg border transition-all ${
                          isSelected
                            ? 'bg-primary text-primary-foreground border-primary font-semibold shadow-2xs'
                            : 'bg-background hover:bg-muted/50 text-muted-foreground border-border'
                        }`}
                      >
                        {type}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Input
                    placeholder="Add custom service type (e.g. HVAC, CNC Spindle Repair)..."
                    value={formData.customServiceType}
                    onChange={(e) => setFormData({ ...formData, customServiceType: e.target.value })}
                    onKeyDown={handleAddCustomServiceType}
                    className="text-xs h-8"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddCustomServiceType}
                    className="h-8 text-xs shrink-0"
                  >
                    Add
                  </Button>
                </div>
              </div>

              {/* Active Status Checkbox */}
              <div className="pt-2 flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                />
                <label htmlFor="isActive" className="text-xs font-semibold text-foreground cursor-pointer">
                  Vendor is active for equipment procurement &amp; service contracts
                </label>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isSubmitting} className="gap-1.5 shadow-sm">
                  {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{editingVendor ? 'Save Vendor Changes' : 'Register Vendor'}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

