'use client';

import useSWR from 'swr';
import Link from 'next/link';
import {
  QrCode,
  PlusCircle,
  Network,
  Boxes,
  ArrowUpRight,
  ShieldCheck,
  Wrench,
  DollarSign,
  Search,
  FileSpreadsheet,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

interface AssetSummary {
  id: string;
  name: string;
  assetCode: string;
  sapAssetCode: string;
  status: string;
  category?: { name: string };
  location?: { name: string };
  purchaseCost?: number | string | null;
}

export default function DashboardPage() {
  const { data: rawKpi, isLoading: kpiLoading } = useSWR('/api/dashboard/kpis');
  const { data: rawAssets, isLoading: assetsLoading } = useSWR(
    '/api/assets?limit=5&sortBy=createdAt&sortOrder=desc'
  );

  const loading = kpiLoading && assetsLoading && !rawKpi && !rawAssets;
  const kpiData = rawKpi?.data || rawKpi || {};
  const assetsList: AssetSummary[] = Array.isArray(rawAssets?.data)
    ? rawAssets.data
    : Array.isArray(rawAssets)
    ? rawAssets
    : [];

  const totalAssets = kpiData.totalAssets || rawAssets?.meta?.total || assetsList.length || 0;
  const activeAssets = kpiData.activeAssets || 0;
  const maintenanceCount = kpiData.assetsInMaintenance ?? kpiData.maintenanceCount ?? 0;
  const totalValue = kpiData.totalAssetValue ?? kpiData.totalValue ?? 0;
  const recentAssets = assetsList;

  const formatCurrency = (val: number) => {
    if (val >= 10000000) return `BDT ${(val / 10000000).toFixed(2)} Cr`;
    if (val >= 100000) return `BDT ${(val / 100000).toFixed(2)} Lakh`;
    if (val >= 1000) return `BDT ${(val / 1000).toFixed(1)}k`;
    return `BDT ${val.toLocaleString()}`;
  };

  const kpis = [
    {
      label: 'Total Assets',
      value: loading ? '—' : totalAssets.toLocaleString(),
      change: totalAssets > 0 ? 'Enterprise registry' : 'No records yet',
      icon: Boxes,
      color: 'text-blue-600',
    },
    {
      label: 'Active in Field',
      value: loading ? '—' : activeAssets.toLocaleString(),
      change: totalAssets > 0 ? `${((activeAssets / (totalAssets || 1)) * 100).toFixed(1)}% operational` : '0% operational',
      icon: ShieldCheck,
      color: 'text-emerald-600',
    },
    {
      label: 'In Maintenance',
      value: loading ? '—' : maintenanceCount.toLocaleString(),
      change: maintenanceCount > 0 ? 'Service scheduled' : 'None scheduled',
      icon: Wrench,
      color: 'text-amber-600',
    },
    {
      label: 'Book Value',
      value: loading ? '—' : formatCurrency(totalValue),
      change: totalValue > 0 ? 'Cost capitalization' : 'BDT 0.00',
      icon: DollarSign,
      color: 'text-purple-600',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Operations Dashboard</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Asset lifecycle, audit sessions, and location tracking
          </p>
        </div>
      </div>

      {/* Quick Search Card for SAP / Asset Code */}
      <Card className="bg-gradient-to-r from-primary/5 via-card to-secondary/20 border-primary/20">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by Asset Code, SAP Asset Code, or Serial Number..."
                className="pl-10 bg-background/80"
              />
            </div>
            <Link href="/locations">
              <Button variant="secondary" className="w-full sm:w-auto gap-2">
                <Network className="w-4 h-4" />
                <span>Explore Location Tree</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <Card key={idx} className="relative overflow-hidden">
              <CardHeader className="p-3 sm:p-5 pb-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground line-clamp-1">
                    {kpi.label}
                  </span>
                  <div className={`p-1.5 rounded-md bg-secondary/80 ${kpi.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-5 pt-0">
                <div className="text-xl sm:text-2xl font-bold tracking-tight">{kpi.value}</div>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 line-clamp-1">
                  {kpi.change}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions Grid for Mobile Thumbs */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Link href="/scan" className="block">
          <div className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl border bg-card text-center hover:bg-accent/50 transition-all active:scale-95 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-1.5">
              <QrCode className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold">Audit Scan</span>
            <span className="text-[10px] text-muted-foreground hidden xs:block">Dual camera</span>
          </div>
        </Link>

        <Link href="/locations" className="block">
          <div className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl border bg-card text-center hover:bg-accent/50 transition-all active:scale-95 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-1.5">
              <Network className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold">Location Tree</span>
            <span className="text-[10px] text-muted-foreground hidden xs:block">Company &gt; Line</span>
          </div>
        </Link>

        <Link href="/assets" className="block">
          <div className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl border bg-card text-center hover:bg-accent/50 transition-all active:scale-95 shadow-sm">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center mb-1.5">
              <Boxes className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold">All Assets</span>
            <span className="text-[10px] text-muted-foreground hidden xs:block">Real inventory</span>
          </div>
        </Link>
      </div>

      {/* Recent Assets List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle>Recent Assets</CardTitle>
            <CardDescription>Latest equipment registered in the database</CardDescription>
          </div>
          <Link href="/assets">
            <Button variant="ghost" size="sm" className="gap-1 text-xs">
              <span>View All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && (
            <div className="p-8 text-center flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-xs">Loading latest assets...</span>
            </div>
          )}

          {!loading && recentAssets.length > 0 && (
            recentAssets.map((asset) => (
              <div
                key={asset.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-lg border bg-muted/20 hover:bg-muted/40 transition-colors gap-3"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-sm">{asset.name}</span>
                    <Badge variant={asset.status === 'ACTIVE' ? 'default' : 'secondary'}>
                      {asset.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="font-mono text-primary font-medium">{asset.assetCode}</span>
                    {asset.sapAssetCode && (
                      <span className="font-mono bg-secondary px-1.5 py-0.5 rounded text-[11px]">
                        SAP: {asset.sapAssetCode}
                      </span>
                    )}
                    <span>{asset.category?.name || 'General Asset'}</span>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Network className="w-3 h-3 flex-shrink-0" />
                    <span className="line-clamp-1">{asset.location?.name || 'Apex ABL Manufacturing'}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0">
                  <span className="text-sm font-semibold">
                    {asset.purchaseCost ? `BDT ${Number(asset.purchaseCost).toLocaleString()}` : '—'}
                  </span>
                  <Link href={`/assets/${asset.id}`}>
                    <Button variant="outline" size="sm" className="h-8 text-xs">
                      Details
                    </Button>
                  </Link>
                </div>
              </div>
            ))
          )}

          {!loading && recentAssets.length === 0 && (
            <div className="p-8 text-center text-muted-foreground border border-dashed rounded-lg bg-card space-y-3">
              <Boxes className="w-8 h-8 mx-auto text-muted-foreground/60" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">No Assets in Database</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Import your fixed assets spreadsheet to load real equipment records.
                </p>
              </div>
              <Link href="/assets/import" className="inline-block pt-1">
                <Button size="sm" className="gap-2">
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Import Excel File</span>
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
