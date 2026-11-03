'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Save,
  Loader2,
  Building2,
  ShieldCheck,
  DollarSign,
  Layers,
  Wrench,
  CheckCircle2,
  AlertCircle,
  Network,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

export interface EditableAssetData {
  id: string;
  assetCode: string;
  sapAssetCode: string;
  name: string;
  description?: string | null;
  status: string;
  categoryId: string;
  category?: { id: string; name: string; code?: string };
  serialNumber?: string | null;
  model?: string | null;
  manufacturer?: string | null;
  color?: string | null;
  condition?: string | null;
  purchaseDate?: string | null;
  purchaseCost?: number | string | null;
  depreciationMethod?: string | null;
  depreciationRate?: number | string | null;
  usefulLifeYears?: number | null;
  locationId?: string | null;
  location?: { id: string; name: string; code?: string; type?: string };
  departmentId?: string | null;
  department?: { id: string; name: string; code?: string };
  vendorId?: string | null;
  invoiceNumber?: string | null;
  warrantyExpiry?: string | null;
  warrantyDetails?: string | null;
  notes?: string | null;
}

interface ReferenceOption {
  id: string;
  name: string;
  code?: string;
  type?: string;
}

interface EditAssetModalProps {
  asset: EditableAssetData | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: EditableAssetData) => void;
}

export function EditAssetModal({ asset, isOpen, onClose, onSuccess }: EditAssetModalProps) {
  const [activeTab, setActiveTab] = useState<'basic' | 'specs' | 'location' | 'financials'>('basic');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reference data
  const [categories, setCategories] = useState<ReferenceOption[]>([]);
  const [locations, setLocations] = useState<ReferenceOption[]>([]);
  const [departments, setDepartments] = useState<ReferenceOption[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(false);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    sapAssetCode: '',
    categoryId: '',
    status: 'ACTIVE',
    condition: 'GOOD',
    description: '',
    model: '',
    manufacturer: '',
    serialNumber: '',
    color: '',
    locationId: '',
    departmentId: '',
    purchaseCost: '',
    purchaseDate: '',
    depreciationMethod: 'STRAIGHT_LINE',
    depreciationRate: '',
    usefulLifeYears: '',
    invoiceNumber: '',
    warrantyExpiry: '',
    warrantyDetails: '',
    notes: '',
  });

  // Fetch reference options
  useEffect(() => {
    if (!isOpen) return;
    setLoadingRefs(true);
    fetch('/api/assets/reference-options')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const data = json?.data || json || {};
        if (Array.isArray(data.categories)) setCategories(data.categories);
        if (Array.isArray(data.locations)) setLocations(data.locations);
        if (Array.isArray(data.departments)) setDepartments(data.departments);
      })
      .catch((err) => console.error('Failed to load asset form reference options:', err))
      .finally(() => setLoadingRefs(false));
  }, [isOpen]);

  // Populate form with asset values
  useEffect(() => {
    if (!asset || !isOpen) return;

    const formatDateForInput = (d?: string | null) => {
      if (!d) return '';
      try {
        const parsed = new Date(d);
        if (isNaN(parsed.getTime())) return '';
        return parsed.toISOString().split('T')[0];
      } catch {
        return '';
      }
    };

    setFormData({
      name: asset.name || '',
      sapAssetCode: asset.sapAssetCode || '',
      categoryId: asset.categoryId || asset.category?.id || '',
      status: asset.status || 'ACTIVE',
      condition: asset.condition || 'GOOD',
      description: asset.description || '',
      model: asset.model || '',
      manufacturer: asset.manufacturer || '',
      serialNumber: asset.serialNumber || '',
      color: asset.color || '',
      locationId: asset.locationId || asset.location?.id || '',
      departmentId: asset.departmentId || asset.department?.id || '',
      purchaseCost:
        asset.purchaseCost !== null && asset.purchaseCost !== undefined
          ? String(asset.purchaseCost)
          : '',
      purchaseDate: formatDateForInput(asset.purchaseDate),
      depreciationMethod: asset.depreciationMethod || 'STRAIGHT_LINE',
      depreciationRate:
        asset.depreciationRate !== null && asset.depreciationRate !== undefined
          ? String(asset.depreciationRate)
          : '',
      usefulLifeYears:
        asset.usefulLifeYears !== null && asset.usefulLifeYears !== undefined
          ? String(asset.usefulLifeYears)
          : '',
      invoiceNumber: asset.invoiceNumber || '',
      warrantyExpiry: formatDateForInput(asset.warrantyExpiry),
      warrantyDetails: asset.warrantyDetails || '',
      notes: asset.notes || '',
    });
    setError(null);
  }, [asset, isOpen]);

  if (!isOpen || !asset) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Asset name is required');
      setActiveTab('basic');
      return;
    }
    if (!formData.sapAssetCode.trim()) {
      setError('SAP Asset Code is required for ERP synchronisation');
      setActiveTab('basic');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const payload: any = {
        name: formData.name.trim(),
        sapAssetCode: formData.sapAssetCode.trim(),
        categoryId: formData.categoryId || undefined,
        status: formData.status,
        condition: formData.condition || null,
        description: formData.description.trim() || null,
        model: formData.model.trim() || null,
        manufacturer: formData.manufacturer.trim() || null,
        serialNumber: formData.serialNumber.trim() || null,
        color: formData.color.trim() || null,
        locationId: formData.locationId || null,
        departmentId: formData.departmentId || null,
        purchaseCost: formData.purchaseCost ? parseFloat(formData.purchaseCost) : null,
        purchaseDate: formData.purchaseDate ? new Date(formData.purchaseDate).toISOString() : null,
        depreciationMethod: formData.depreciationMethod,
        depreciationRate: formData.depreciationRate ? parseFloat(formData.depreciationRate) : null,
        usefulLifeYears: formData.usefulLifeYears ? parseInt(formData.usefulLifeYears, 10) : null,
        invoiceNumber: formData.invoiceNumber.trim() || null,
        warrantyExpiry: formData.warrantyExpiry ? new Date(formData.warrantyExpiry).toISOString() : null,
        warrantyDetails: formData.warrantyDetails.trim() || null,
        notes: formData.notes.trim() || null,
      };

      const res = await fetch(`/api/assets/${asset.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.message || 'Failed to update asset');
      }

      const updatedItem = json?.data !== undefined ? json.data : json;
      onSuccess(updatedItem);
      onClose();
    } catch (err: any) {
      console.error('Error saving asset:', err);
      setError(err.message || 'An error occurred while saving asset');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div
        className="bg-card border rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b flex items-center justify-between bg-muted/20">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                {asset.assetCode}
              </span>
              <Badge variant="outline" className="text-[10px]">
                {formData.status}
              </Badge>
            </div>
            <h2 className="text-base sm:text-lg font-bold tracking-tight">
              Edit Asset: {asset.name}
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b bg-muted/10 px-4 text-xs font-semibold overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('basic')}
            className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'basic'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>General Info</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('specs')}
            className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'specs'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Hardware Specs</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('location')}
            className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'location'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Network className="w-3.5 h-3.5" />
            <span>Station & Dept</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('financials')}
            className={`py-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'financials'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Financials & Warranty</span>
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: General Info */}
          {activeTab === 'basic' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Asset Title / Description <span className="text-destructive">*</span>
                </label>
                <Input
                  required
                  placeholder="e.g. 5-Axis CNC Milling Center"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>SAP Asset Code <span className="text-destructive">*</span></span>
                    <span className="text-[10px] text-primary font-mono font-medium">ERP Sync</span>
                  </label>
                  <Input
                    required
                    placeholder="e.g. 602000001306"
                    value={formData.sapAssetCode}
                    onChange={(e) => setFormData({ ...formData, sapAssetCode: e.target.value })}
                    className="font-mono bg-muted/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Asset Category</label>
                  <select
                    className="w-full h-10 px-3 rounded-lg border bg-background text-xs font-medium"
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  >
                    <option value="">Select Category...</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.code ? `(${c.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Operational Status</label>
                  <select
                    className="w-full h-10 px-3 rounded-lg border bg-background text-xs font-semibold"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="IN_MAINTENANCE">IN_MAINTENANCE</option>
                    <option value="DISPOSED">DISPOSED</option>
                    <option value="RETIRED">RETIRED</option>
                    <option value="DRAFT">DRAFT</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Physical Condition</label>
                  <select
                    className="w-full h-10 px-3 rounded-lg border bg-background text-xs"
                    value={formData.condition}
                    onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                  >
                    <option value="GOOD">GOOD</option>
                    <option value="FAIR">FAIR</option>
                    <option value="POOR">POOR</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Detailed Description / Purpose</label>
                <textarea
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border bg-background text-xs focus:ring-1 focus:ring-primary/20 outline-none"
                  placeholder="Optional technical description or operational context..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* TAB 2: Hardware Specs */}
          {activeTab === 'specs' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Manufacturer / Brand</label>
                  <Input
                    placeholder="e.g. HP / Siemens / DMG Mori"
                    value={formData.manufacturer}
                    onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Model Name / Number</label>
                  <Input
                    placeholder="e.g. EliteDesk 800 G9"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Serial Number</label>
                  <Input
                    placeholder="e.g. SN-889124401"
                    value={formData.serialNumber}
                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                    className="font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Color / Appearance</label>
                  <Input
                    placeholder="e.g. Matte Black"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">General Maintenance Notes</label>
                <textarea
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border bg-background text-xs focus:ring-1 focus:ring-primary/20 outline-none"
                  placeholder="Notes regarding maintenance history, upgrades, or installed attachments..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* TAB 3: Station & Department Placement */}
          {activeTab === 'location' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl border bg-muted/20 space-y-3">
                <div className="flex items-center gap-2">
                  <Network className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Physical Placement Station
                  </span>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    Assigned Facility / Block / Station
                  </label>
                  <select
                    className="w-full h-10 px-3 rounded-lg border bg-background text-xs font-semibold"
                    value={formData.locationId}
                    onChange={(e) => setFormData({ ...formData, locationId: e.target.value })}
                  >
                    <option value="">Unassigned Location</option>
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} {loc.code ? `(${loc.code})` : ''} {loc.type ? `• [${loc.type}]` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border bg-muted/20 space-y-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Department Ownership & Custody
                  </span>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">
                    Operating Department
                  </label>
                  <select
                    className="w-full h-10 px-3 rounded-lg border bg-background text-xs font-semibold"
                    value={formData.departmentId}
                    onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                  >
                    <option value="">Unassigned Department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} {d.code ? `(${d.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Financials & Warranty */}
          {activeTab === 'financials' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Purchase Cost</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 145000"
                    value={formData.purchaseCost}
                    onChange={(e) => setFormData({ ...formData, purchaseCost: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Purchase / Capitalization Date</label>
                  <Input
                    type="date"
                    value={formData.purchaseDate}
                    onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Depreciation Method</label>
                  <select
                    className="w-full h-10 px-3 rounded-lg border bg-background text-xs font-medium"
                    value={formData.depreciationMethod}
                    onChange={(e) => setFormData({ ...formData, depreciationMethod: e.target.value })}
                  >
                    <option value="STRAIGHT_LINE">Straight Line</option>
                    <option value="DECLINING_BALANCE">Declining Balance</option>
                    <option value="NONE">None</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Depreciation Rate (%)</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 10.0"
                    value={formData.depreciationRate}
                    onChange={(e) => setFormData({ ...formData, depreciationRate: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Useful Life (Years)</label>
                  <Input
                    type="number"
                    placeholder="e.g. 5"
                    value={formData.usefulLifeYears}
                    onChange={(e) => setFormData({ ...formData, usefulLifeYears: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Invoice Number</label>
                  <Input
                    placeholder="e.g. INV-2024-9901"
                    value={formData.invoiceNumber}
                    onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                    className="font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Warranty Expiry Date</label>
                  <Input
                    type="date"
                    value={formData.warrantyExpiry}
                    onChange={(e) => setFormData({ ...formData, warrantyExpiry: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Warranty Coverage Details</label>
                <Input
                  placeholder="e.g. 3-Year On-Site Manufacturer Warranty including parts & labor"
                  value={formData.warrantyDetails}
                  onChange={(e) => setFormData({ ...formData, warrantyDetails: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* Form Actions Footer */}
          <div className="pt-3 border-t flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              Editing: <strong className="text-foreground">{asset.assetCode}</strong>
            </span>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isSubmitting} className="gap-1.5 shadow-sm">
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Asset Changes</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

