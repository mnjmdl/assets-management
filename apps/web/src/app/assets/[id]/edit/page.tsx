'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Save,
  Loader2,
  Building2,
  ShieldCheck,
  DollarSign,
  Layers,
  Wrench,
  AlertCircle,
  Network,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { EditableAssetData } from '@/components/assets/edit-asset-modal';

interface ReferenceOption {
  id: string;
  name: string;
  code?: string;
  type?: string;
}

export default function EditAssetPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [asset, setAsset] = useState<EditableAssetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [activeTab, setActiveTab] = useState<'basic' | 'specs' | 'location' | 'financials'>('basic');

  // Reference options
  const [categories, setCategories] = useState<ReferenceOption[]>([]);
  const [locations, setLocations] = useState<ReferenceOption[]>([]);
  const [departments, setDepartments] = useState<ReferenceOption[]>([]);

  // Form fields
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

  useEffect(() => {
    async function initData() {
      setLoading(true);
      try {
        const [assetRes, refsRes] = await Promise.all([
          fetch(`/api/assets/${params.id}`),
          fetch('/api/assets/reference-options'),
        ]);

        if (!assetRes.ok) {
          throw new Error('Failed to load asset details from server');
        }

        const assetJson = await assetRes.json();
        const a: EditableAssetData = assetJson?.data !== undefined ? assetJson.data : assetJson;
        setAsset(a);

        setFormData({
          name: a.name || '',
          sapAssetCode: a.sapAssetCode || '',
          categoryId: a.categoryId || a.category?.id || '',
          status: a.status || 'ACTIVE',
          condition: a.condition || 'GOOD',
          description: a.description || '',
          model: a.model || '',
          manufacturer: a.manufacturer || '',
          serialNumber: a.serialNumber || '',
          color: a.color || '',
          locationId: a.locationId || a.location?.id || '',
          departmentId: a.departmentId || a.department?.id || '',
          purchaseCost:
            a.purchaseCost !== null && a.purchaseCost !== undefined ? String(a.purchaseCost) : '',
          purchaseDate: formatDateForInput(a.purchaseDate),
          depreciationMethod: a.depreciationMethod || 'STRAIGHT_LINE',
          depreciationRate:
            a.depreciationRate !== null && a.depreciationRate !== undefined
              ? String(a.depreciationRate)
              : '',
          usefulLifeYears:
            a.usefulLifeYears !== null && a.usefulLifeYears !== undefined
              ? String(a.usefulLifeYears)
              : '',
          invoiceNumber: a.invoiceNumber || '',
          warrantyExpiry: formatDateForInput(a.warrantyExpiry),
          warrantyDetails: a.warrantyDetails || '',
          notes: a.notes || '',
        });

        if (refsRes.ok) {
          const refsJson = await refsRes.json();
          const rData = refsJson?.data || refsJson || {};
          if (Array.isArray(rData.categories)) setCategories(rData.categories);
          if (Array.isArray(rData.locations)) setLocations(rData.locations);
          if (Array.isArray(rData.departments)) setDepartments(rData.departments);
        }
      } catch (err: any) {
        setError(err.message || 'Error loading asset');
      } finally {
        setLoading(false);
      }
    }

    initData();
  }, [params.id]);

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

      const res = await fetch(`/api/assets/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.message || 'Failed to update asset');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push(`/assets/${params.id}`);
      }, 1200);
    } catch (err: any) {
      console.error('Error updating asset:', err);
      setError(err.message || 'An error occurred while updating the asset');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
        <p className="text-sm text-muted-foreground">Loading asset configuration...</p>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="max-w-md mx-auto py-12 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
        <h2 className="text-lg font-bold">Asset Not Found</h2>
        <p className="text-xs text-muted-foreground">{error || `No asset found with ID ${params.id}`}</p>
        <Link href="/assets">
          <Button size="sm">Back to Inventory</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <Link href={`/assets/${params.id}`}>
          <Button variant="ghost" size="sm" className="gap-1.5 -ml-2">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Asset</span>
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
            {asset.assetCode}
          </span>
          <Badge variant="outline" className="text-xs">
            {formData.status}
          </Badge>
        </div>
      </div>

      <Card className="border-primary/20 shadow-sm overflow-hidden">
        <CardHeader className="p-4 sm:p-6 pb-3 border-b bg-muted/20">
          <CardTitle className="text-lg sm:text-xl flex items-center justify-between">
            <span>Edit Asset Profile</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Update asset identification, operational status, location placement, and financial capitalization.
          </CardDescription>
        </CardHeader>

        {/* Tab Buttons */}
        <div className="flex border-b bg-muted/10 px-4 text-xs font-semibold overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('basic')}
            className={`py-3 px-3.5 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
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
            className={`py-3 px-3.5 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
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
            className={`py-3 px-3.5 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
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
            className={`py-3 px-3.5 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'financials'
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Financials & Warranty</span>
          </button>
        </div>

        <CardContent className="p-4 sm:p-6">
          {success ? (
            <div className="p-8 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto animate-bounce" />
              <h3 className="font-bold text-base text-foreground">Asset Updated Successfully!</h3>
              <p className="text-xs text-muted-foreground">
                Redirecting back to asset profile...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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
                      Asset Title / Name <span className="text-destructive">*</span>
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
              <div className="pt-4 border-t flex items-center justify-between">
                <Link href={`/assets/${params.id}`}>
                  <Button type="button" variant="outline" size="sm" disabled={isSubmitting}>
                    Cancel
                  </Button>
                </Link>
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
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

