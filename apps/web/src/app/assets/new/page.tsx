'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Save, Network, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface LocationItem {
  id: string;
  name: string;
  code: string;
  type: 'COMPANY' | 'UNIT' | 'BLOCK' | 'LINE';
  parentId?: string | null;
}

export default function NewAssetPage() {
  const [submitted, setSubmitted] = useState(false);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    sapAssetCode: '',
    categoryId: 'cat_heavy_machinery',
    serialNumber: '',
    model: '',
    manufacturer: '',
    company: 'CMBD',
    unit: 'CMBD-U01',
    block: 'BLOCK-C',
    line: 'LINE-01',
    purchaseCost: '',
  });

  useEffect(() => {
    async function loadLocations() {
      setLoadingLocations(true);
      try {
        const res = await fetch('/api/locations');
        if (res.ok) {
          const json = await res.json();
          const list: LocationItem[] = Array.isArray(json?.data)
            ? json.data
            : Array.isArray(json)
            ? json
            : [];
          setLocations(list);

          const companies = list.filter((l) => l.type === 'COMPANY');
          const units = list.filter((l) => l.type === 'UNIT');
          const blocks = list.filter((l) => l.type === 'BLOCK');
          const lines = list.filter((l) => l.type === 'LINE');

          setFormData((prev) => ({
            ...prev,
            company: companies[0]?.code || companies[0]?.name || 'CMBD',
            unit: units[0]?.code || units[0]?.name || 'CMBD-U01',
            block: blocks[0]?.code || blocks[0]?.name || 'BLOCK-C',
            line: lines[0]?.code || lines[0]?.name || 'LINE-01',
          }));
        }
      } catch (e) {
        console.error('Error fetching locations:', e);
      } finally {
        setLoadingLocations(false);
      }
    }
    loadLocations();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const companies = locations.filter((l) => l.type === 'COMPANY');
  const units = locations.filter((l) => l.type === 'UNIT');
  const blocks = locations.filter((l) => l.type === 'BLOCK');
  const lines = locations.filter((l) => l.type === 'LINE');

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href="/assets">
          <Button variant="ghost" size="sm" className="gap-1.5 -ml-2">
            <ArrowLeft className="w-4 h-4" />
            <span>Cancel</span>
          </Button>
        </Link>
        <span className="text-xs font-semibold text-muted-foreground">New Equipment</span>
      </div>

      <Card>
        <CardHeader className="p-4 sm:p-6 pb-2">
          <CardTitle className="text-lg sm:text-xl">Register New Asset</CardTitle>
          <CardDescription className="text-xs">
            Enter equipment details, SAP asset identification, and station location
          </CardDescription>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 pt-2">
          {submitted ? (
            <div className="p-6 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <h3 className="font-bold text-base">Asset Registered Successfully!</h3>
              <p className="text-xs text-muted-foreground">
                Assigned sequence tag <strong>AST-2024-00106</strong> linked with SAP reference{' '}
                <strong>{formData.sapAssetCode}</strong>.
              </p>
              <div className="pt-2 flex justify-center gap-2">
                <Link href="/assets">
                  <Button variant="outline" size="sm">
                    View Inventory
                  </Button>
                </Link>
                <Button size="sm" onClick={() => setSubmitted(false)}>
                  Register Another
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Asset Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Asset Name <span className="text-destructive">*</span>
                </label>
                <Input
                  required
                  placeholder="e.g. 5-Axis CNC Milling Center"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              {/* SAP Asset Code (Primary requirement) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>SAP Asset Code (ERP Sync) <span className="text-destructive">*</span></span>
                  <span className="text-[10px] text-primary font-mono font-medium">Required for ERP</span>
                </label>
                <Input
                  required
                  placeholder="e.g. SAP-EQ-90412"
                  value={formData.sapAssetCode}
                  onChange={(e) => setFormData({ ...formData, sapAssetCode: e.target.value })}
                  className="font-mono bg-muted/20"
                />
              </div>

              {/* Location Hierarchy Box (Company > Unit > Block > Line) */}
              <div className="p-3.5 rounded-xl border bg-muted/20 space-y-3">
                <div className="flex items-center space-x-2">
                  <Network className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Station Location (Company &gt; Unit &gt; Block &gt; Line)
                  </span>
                  {loadingLocations && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">1. Company</label>
                    <select
                      className="w-full h-10 px-3 rounded-lg border bg-background text-xs"
                      value={formData.company}
                      onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    >
                      {companies.length > 0 ? (
                        companies.map((c) => (
                          <option key={c.id} value={c.code || c.name}>
                            {c.name} {c.code && c.code !== c.name ? `(${c.code})` : ''}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="CMBD">CMBD</option>
                          <option value="ABL">ABL</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">2. Unit (Plant)</label>
                    <select
                      className="w-full h-10 px-3 rounded-lg border bg-background text-xs"
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    >
                      {units.length > 0 ? (
                        units.map((u) => (
                          <option key={u.id} value={u.code || u.name}>
                            {u.name}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="CMBD-U01">CMBD-U01</option>
                          <option value="CMBD-U02">CMBD-U02</option>
                          <option value="CMBD-U03">CMBD-U03</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">3. Block (Building)</label>
                    <select
                      className="w-full h-10 px-3 rounded-lg border bg-background text-xs"
                      value={formData.block}
                      onChange={(e) => setFormData({ ...formData, block: e.target.value })}
                    >
                      {blocks.length > 0 ? (
                        blocks.map((b) => (
                          <option key={b.id} value={b.code || b.name}>
                            {b.name}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="BLOCK-A">BLOCK-A</option>
                          <option value="BLOCK-B">BLOCK-B</option>
                          <option value="BLOCK-C">BLOCK-C</option>
                          <option value="BLOCK-D">BLOCK-D</option>
                          <option value="BLOCK-E">BLOCK-E</option>
                          <option value="BLOCK-J">BLOCK-J</option>
                        </>
                      )}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">4. Line (Station)</label>
                    <select
                      className="w-full h-10 px-3 rounded-lg border bg-background text-xs font-semibold text-primary"
                      value={formData.line}
                      onChange={(e) => setFormData({ ...formData, line: e.target.value })}
                    >
                      {lines.length > 0 ? (
                        lines.map((l) => (
                          <option key={l.id} value={l.code || l.name}>
                            {l.name}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="LINE-01">Line 01</option>
                          <option value="LINE-02">Line 02</option>
                          <option value="LINE-03">Line 03</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>
              </div>

              {/* Physical Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Manufacturer</label>
                  <Input
                    placeholder="e.g. DMG Mori"
                    value={formData.manufacturer}
                    onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Model</label>
                  <Input
                    placeholder="e.g. DMU 50"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Serial Number</label>
                  <Input
                    placeholder="e.g. SN-88912"
                    value={formData.serialNumber}
                    onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                  />
                </div>
              </div>

              {/* Financial Detail */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Purchase Cost ($ USD)</label>
                <Input
                  type="number"
                  placeholder="e.g. 145000"
                  value={formData.purchaseCost}
                  onChange={(e) => setFormData({ ...formData, purchaseCost: e.target.value })}
                />
              </div>

              {/* Submit Button */}
              <Button type="submit" size="lg" className="w-full gap-2 shadow-md">
                <Save className="w-5 h-5" />
                <span>Save Asset &amp; Generate QR Tag</span>
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
