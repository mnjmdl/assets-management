'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import {
  ChevronRight,
  ChevronDown,
  Building,
  Factory,
  Layers,
  Cpu,
  Plus,
  Boxes,
  Search,
  FolderTree,
  QrCode,
  Printer,
  X,
  ExternalLink,
  Loader2,
  AlertCircle,
  Download,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { createPlacardPng } from '@/lib/qr-placard';

interface LocationNode {
  id: string;
  name: string;
  code: string;
  type: 'COMPANY' | 'UNIT' | 'BLOCK' | 'LINE';
  qrCode?: string;
  parentId?: string | null;
  assetCount?: number;
  totalAssetCount?: number;
  building?: string;
  floor?: string;
  room?: string;
  description?: string;
  children?: LocationNode[];
}

export default function LocationsPage() {
  const [tree, setTree] = useState<LocationNode[]>([]);
  const [flatLocations, setFlatLocations] = useState<LocationNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // Modals state
  const [selectedQrNode, setSelectedQrNode] = useState<LocationNode | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [downloadPlacardUrl, setDownloadPlacardUrl] = useState<string>('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // New location form state
  const [newLocation, setNewLocation] = useState({
    name: '',
    code: '',
    type: 'UNIT' as 'COMPANY' | 'UNIT' | 'BLOCK' | 'LINE',
    parentId: '',
    building: '',
    floor: '',
    room: '',
    description: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch live location tree from DB
  const fetchTree = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/locations/tree');
      if (!res.ok) {
        throw new Error('Failed to load locations from database.');
      }
      const json = await res.json();
      const data: LocationNode[] = json?.data !== undefined ? json.data : json;

      if (Array.isArray(data)) {
        setTree(data);

        // Auto-expand all top-level nodes
        const defaultExpanded: Record<string, boolean> = {};
        const flatten = (nodes: LocationNode[]) => {
          nodes.forEach((n) => {
            defaultExpanded[n.id] = true;
            if (n.children && n.children.length > 0) {
              flatten(n.children);
            }
          });
        };
        flatten(data);
        setExpandedNodes(defaultExpanded);

        // Flatten all nodes for parent selection in Add modal
        const flat: LocationNode[] = [];
        const extractFlat = (nodes: LocationNode[]) => {
          nodes.forEach((n) => {
            flat.push(n);
            if (n.children && n.children.length > 0) {
              extractFlat(n.children);
            }
          });
        };
        extractFlat(data);
        setFlatLocations(flat);
      } else {
        setTree([]);
        setFlatLocations([]);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading live locations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTree();
  }, []);

  // Generate real QR code and download placard with location name & code
  useEffect(() => {
    let isCancelled = false;
    if (selectedQrNode) {
      const qrString = selectedQrNode.qrCode || `LOC:${selectedQrNode.code}`;
      QRCode.toDataURL(qrString, {
        width: 400,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then(async (rawUrl) => {
          if (isCancelled) return;
          setQrDataUrl(rawUrl);
          const placardUrl = await createPlacardPng({
            qrDataUrl: rawUrl,
            titleCode: selectedQrNode.code,
          });
          if (!isCancelled) {
            setDownloadPlacardUrl(placardUrl);
          }
        })
        .catch(console.error);
    } else {
      setQrDataUrl('');
      setDownloadPlacardUrl('');
    }

    return () => {
      isCancelled = true;
    };
  }, [selectedQrNode]);

  const toggleNode = (id: string) => {
    setExpandedNodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCreateLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    try {
      const payload: any = {
        name: newLocation.name.trim(),
        code: newLocation.code.trim().toUpperCase(),
        type: newLocation.type,
      };

      if (newLocation.type !== 'COMPANY') {
        if (!newLocation.parentId) {
          throw new Error(`A ${newLocation.type} requires a parent location in the hierarchy.`);
        }
        payload.parentId = newLocation.parentId;
      }

      if (newLocation.building) payload.building = newLocation.building.trim();
      if (newLocation.floor) payload.floor = newLocation.floor.trim();
      if (newLocation.room) payload.room = newLocation.room.trim();
      if (newLocation.description) payload.description = newLocation.description.trim();

      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(resData.message || 'Failed to create location in database.');
      }

      // Reset form and refresh tree
      setIsAddModalOpen(false);
      setNewLocation({
        name: '',
        code: '',
        type: 'UNIT',
        parentId: '',
        building: '',
        floor: '',
        room: '',
        description: '',
      });
      fetchTree();
    } catch (err: any) {
      setFormError(err.message || 'Error creating location.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'COMPANY':
        return <Building className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      case 'UNIT':
        return <Factory className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case 'BLOCK':
        return <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'LINE':
        return <Cpu className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      default:
        return <FolderTree className="w-4 h-4" />;
    }
  };

  // Filter tree recursively based on search text
  const filterTree = (nodes: LocationNode[]): LocationNode[] => {
    if (!search.trim()) return nodes;
    const query = search.toLowerCase();
    const result: LocationNode[] = [];

    for (const node of nodes) {
      const matchesSelf =
        node.name.toLowerCase().includes(query) ||
        node.code.toLowerCase().includes(query) ||
        node.type.toLowerCase().includes(query);

      const filteredChildren = node.children ? filterTree(node.children) : [];

      if (matchesSelf || filteredChildren.length > 0) {
        result.push({
          ...node,
          children: filteredChildren,
        });
      }
    }

    return result;
  };

  const renderNode = (node: LocationNode, depth: number = 0) => {
    const isExpanded = expandedNodes[node.id];
    const hasChildren = node.children && node.children.length > 0;
    const totalAssets = node.totalAssetCount !== undefined ? node.totalAssetCount : node.assetCount || 0;

    return (
      <div key={node.id} className="space-y-1">
        <div
          className={`flex items-center justify-between p-2.5 sm:p-3 rounded-lg border transition-all hover:bg-accent/40 active:bg-accent/60 ${
            depth === 0 ? 'bg-primary/5 font-semibold' : 'bg-card'
          }`}
          style={{ marginLeft: `${Math.min(depth * 16, 48)}px` }}
        >
          <div className="flex items-center space-x-2.5 min-w-0">
            {hasChildren ? (
              <button
                onClick={() => toggleNode(node.id)}
                className="p-1 -m-1 rounded hover:bg-muted text-muted-foreground focus:outline-none"
                aria-label="Toggle node"
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            ) : (
              <span className="w-4 h-4 flex-shrink-0" />
            )}

            <div className="flex-shrink-0">{getTypeIcon(node.type)}</div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs sm:text-sm font-medium truncate">{node.name}</span>
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">
                  {node.type}
                </Badge>
              </div>
              <span className="text-[11px] font-mono text-muted-foreground block truncate">{node.code}</span>
            </div>
          </div>

          <div className="flex items-center space-x-1.5 flex-shrink-0">
            {/* Live Asset Counter */}
            <span
              className="text-xs text-muted-foreground flex items-center gap-1 mr-1 bg-muted/40 px-2 py-0.5 rounded"
              title={`${totalAssets} equipment stationed here`}
            >
              <Boxes className="w-3.5 h-3.5 text-primary" />
              <span className="font-mono font-medium">{totalAssets.toLocaleString()}</span>
            </span>

            {/* View & Print Scannable Location QR Tag */}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 text-primary shadow-xs hover:bg-primary/10"
              onClick={() => setSelectedQrNode(node)}
              title="View & Print Scannable Station Tag"
            >
              <QrCode className="w-4 h-4" />
            </Button>

            {/* Add Child Node shortcut */}
            {node.type !== 'LINE' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={() => {
                  const nextType =
                    node.type === 'COMPANY' ? 'UNIT' : node.type === 'UNIT' ? 'BLOCK' : 'LINE';
                  setNewLocation((prev) => ({
                    ...prev,
                    type: nextType as any,
                    parentId: node.id,
                  }));
                  setIsAddModalOpen(true);
                }}
                title={`Add subordinate under ${node.name}`}
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="space-y-1">{node.children!.map((child) => renderNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  const filteredTree = filterTree(tree);

  // Parent options based on selected type in Add modal
  const eligibleParents = flatLocations.filter((loc) => {
    if (newLocation.type === 'UNIT') return loc.type === 'COMPANY';
    if (newLocation.type === 'BLOCK') return loc.type === 'UNIT';
    if (newLocation.type === 'LINE') return loc.type === 'BLOCK';
    return false;
  });

  return (
    <div className="space-y-5 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Location Hierarchy</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Strict 4-level enterprise structure: <strong>Company &gt; Unit &gt; Block &gt; Line</strong>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchTree} className="gap-1.5 h-9">
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </Button>
          <Button
            onClick={() => {
              setNewLocation({
                name: '',
                code: '',
                type: tree.length === 0 ? 'COMPANY' : 'UNIT',
                parentId: tree.length > 0 ? tree[0].id : '',
                building: '',
                floor: '',
                room: '',
                description: '',
              });
              setIsAddModalOpen(true);
            }}
            className="gap-2 shadow-sm h-9"
          >
            <Plus className="w-4 h-4" />
            <span>Add Location</span>
          </Button>
        </div>
      </div>

      {/* Hierarchy Level Legend */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="p-2.5 rounded-lg border bg-purple-500/5 border-purple-500/20 flex items-center space-x-2">
          <Building className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <div>
            <div className="text-xs font-semibold">1. Company</div>
            <div className="text-[10px] text-muted-foreground">Top root organization</div>
          </div>
        </div>
        <div className="p-2.5 rounded-lg border bg-blue-500/5 border-blue-500/20 flex items-center space-x-2">
          <Factory className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <div>
            <div className="text-xs font-semibold">2. Unit</div>
            <div className="text-[10px] text-muted-foreground">Plant or facility branch</div>
          </div>
        </div>
        <div className="p-2.5 rounded-lg border bg-amber-500/5 border-amber-500/20 flex items-center space-x-2">
          <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          <div>
            <div className="text-xs font-semibold">3. Block</div>
            <div className="text-[10px] text-muted-foreground">Building / workshop section</div>
          </div>
        </div>
        <div className="p-2.5 rounded-lg border bg-emerald-500/5 border-emerald-500/20 flex items-center space-x-2">
          <Cpu className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <div>
            <div className="text-xs font-semibold">4. Line</div>
            <div className="text-[10px] text-muted-foreground">Assembly / operational line</div>
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search live locations by name, code (e.g. ABL-CORP)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Main Tree View (Live Database Only) */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Live Database Locations</CardTitle>
              <CardDescription>
                Live physical hierarchy stationed in Microsoft SQL Server
              </CardDescription>
            </div>
            {!loading && (
              <Badge variant="secondary" className="font-mono text-xs">
                {flatLocations.length} locations
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-1.5 p-3 sm:p-6 pt-0">
          {loading && (
            <div className="py-12 text-center flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Querying live location hierarchy...</p>
            </div>
          )}

          {error && (
            <div className="py-8 text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold">Failed to load locations</p>
                <p className="text-xs text-muted-foreground">{error}</p>
              </div>
              <Button variant="outline" size="sm" onClick={fetchTree}>
                Retry
              </Button>
            </div>
          )}

          {!loading && !error && filteredTree.length > 0 && (
            filteredTree.map((company) => renderNode(company))
          )}

          {!loading && !error && filteredTree.length === 0 && (
            <div className="py-12 text-center border border-dashed rounded-lg bg-card space-y-3">
              <FolderTree className="w-10 h-10 text-muted-foreground/60 mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">
                  {search ? 'No matching locations found' : 'No Locations Found in Database'}
                </p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {search
                    ? `No location matches "${search}". Try a different search term.`
                    : 'Create your root enterprise Company location to establish your physical hierarchy.'}
                </p>
              </div>
              {!search && (
                <Button
                  size="sm"
                  onClick={() => {
                    setNewLocation({
                      name: 'Apex ABL Manufacturing',
                      code: 'ABL-CORP',
                      type: 'COMPANY',
                      parentId: '',
                      building: '',
                      floor: '',
                      room: '',
                      description: 'Root enterprise manufacturing location',
                    });
                    setIsAddModalOpen(true);
                  }}
                  className="gap-1.5 text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Root Company</span>
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* QR Code Printable Modal for any Location Station */}
      {selectedQrNode && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="w-full max-w-sm border-2 border-primary shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <CardHeader className="flex flex-row items-center justify-between pb-2 no-print">
              <div>
                <CardTitle className="text-base">Location Station Placard</CardTitle>
                <CardDescription className="text-xs">
                  Physical scannable placard for factory station audits
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={() => setSelectedQrNode(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>

            <CardContent className="space-y-4 pt-2 text-center">
              {/* Real Scannable QR Code Container (Only this prints) */}
              <div className="print-area">
                <div className="print-tag-box bg-white dark:bg-slate-900 border-2 border-primary/30 rounded-2xl p-6 flex flex-col items-center justify-center space-y-3 shadow-inner">
                  <div className="w-48 h-48 bg-white p-2 rounded-xl border shadow flex items-center justify-center">
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt={`Scannable QR Placard for ${selectedQrNode.code}`}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  <div className="pt-1">
                    <span className="font-mono text-base font-bold tracking-wider text-foreground block">
                      {selectedQrNode.code}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 no-print">
                <div className="flex gap-2">
                  <Button className="w-1/2 gap-2 shadow" onClick={() => window.print()}>
                    <Printer className="w-4 h-4" />
                    <span>Print Placard</span>
                  </Button>
                  {(downloadPlacardUrl || qrDataUrl) && (
                    <a
                      href={downloadPlacardUrl || qrDataUrl}
                      download={`LOC-${selectedQrNode.code}.png`}
                      className="w-1/2 inline-flex"
                    >
                      <Button variant="outline" className="w-full gap-2 text-xs">
                        <Download className="w-4 h-4" />
                        <span>Download QR</span>
                      </Button>
                    </a>
                  )}
                </div>

                <Link
                  href={`/scan?code=${encodeURIComponent(selectedQrNode.code)}`}
                  className="block w-full"
                >
                  <Button variant="outline" className="w-full gap-2 text-xs">
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Audit All Equipment at this Station</span>
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Location Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <Card className="w-full max-w-md border shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base">Add Location Node</CardTitle>
                <CardDescription className="text-xs">
                  Register a physical level in the 4-level hierarchy
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={() => setIsAddModalOpen(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>

            <form onSubmit={handleCreateLocation}>
              <CardContent className="space-y-3.5 text-xs">
                {formError && (
                  <div className="p-2.5 rounded bg-destructive/10 border border-destructive/20 text-destructive text-xs">
                    {formError}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="font-semibold block">Hierarchy Level</label>
                  <select
                    value={newLocation.type}
                    onChange={(e) => {
                      const newType = e.target.value as any;
                      setNewLocation((prev) => ({
                        ...prev,
                        type: newType,
                        parentId: '',
                      }));
                    }}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs"
                  >
                    <option value="COMPANY">1. COMPANY (Top root level)</option>
                    <option value="UNIT">2. UNIT (Plant or facility under Company)</option>
                    <option value="BLOCK">3. BLOCK (Workshop section under Unit)</option>
                    <option value="LINE">4. LINE (Operational station under Block)</option>
                  </select>
                </div>

                {newLocation.type !== 'COMPANY' && (
                  <div className="space-y-1">
                    <label className="font-semibold block">
                      Parent {newLocation.type === 'UNIT' ? 'Company' : newLocation.type === 'BLOCK' ? 'Unit' : 'Block'} *
                    </label>
                    <select
                      value={newLocation.parentId}
                      onChange={(e) => setNewLocation((prev) => ({ ...prev, parentId: e.target.value }))}
                      required
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs font-medium"
                    >
                      <option value="">Select parent location...</option>
                      {eligibleParents.map((parent) => (
                        <option key={parent.id} value={parent.id}>
                          {parent.name} ({parent.code})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="font-semibold block">Location Name *</label>
                  <Input
                    placeholder="e.g. Unit 01 - Heavy Machining"
                    value={newLocation.name}
                    onChange={(e) => setNewLocation((prev) => ({ ...prev, name: e.target.value }))}
                    required
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold block">Unique Station / Line Code *</label>
                  <Input
                    placeholder="e.g. ABL-UNIT-01 or LINE-CNC-01"
                    value={newLocation.code}
                    onChange={(e) => setNewLocation((prev) => ({ ...prev, code: e.target.value }))}
                    required
                    className="h-9 text-xs font-mono uppercase"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-muted-foreground block text-[11px]">Building</label>
                    <Input
                      placeholder="Bldg 01"
                      value={newLocation.building}
                      onChange={(e) => setNewLocation((prev) => ({ ...prev, building: e.target.value }))}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-muted-foreground block text-[11px]">Floor</label>
                    <Input
                      placeholder="Floor 2"
                      value={newLocation.floor}
                      onChange={(e) => setNewLocation((prev) => ({ ...prev, floor: e.target.value }))}
                      className="h-8 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-muted-foreground block text-[11px]">Room / Bay</label>
                    <Input
                      placeholder="Bay A"
                      value={newLocation.room}
                      onChange={(e) => setNewLocation((prev) => ({ ...prev, room: e.target.value }))}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-muted-foreground block text-[11px]">Description (Optional)</label>
                  <Input
                    placeholder="Operational notes or station specifications"
                    value={newLocation.description}
                    onChange={(e) => setNewLocation((prev) => ({ ...prev, description: e.target.value }))}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAddModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={isSubmitting} className="gap-1.5">
                    {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Save Location</span>
                  </Button>
                </div>
              </CardContent>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
