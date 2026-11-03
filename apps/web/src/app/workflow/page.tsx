'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Printer,
  FileDown,
  ArrowLeft,
  Boxes,
  QrCode,
  Network,
  ClipboardCheck,
  ArrowLeftRight,
  Wrench,
  Truck,
  BarChart3,
  Settings,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ChevronRight,
  Database,
  Smartphone,
  Eye,
  RefreshCw,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function WorkflowPage() {
  const [activeSection, setActiveSection] = useState<string>('all');

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadOfflineHtml = () => {
    const contentElement = document.querySelector('.print-area');
    if (!contentElement) return;

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Enterprise Assets Management & Auditing System - Operating Workflow Manual</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      margin: 30px auto;
      max-width: 960px;
      color: #0f172a;
      background: #ffffff;
      line-height: 1.6;
      padding: 0 20px;
    }
    @page { margin: 15mm; size: auto; }
    h1, h2, h3 { color: #0f172a; margin-top: 1.2em; margin-bottom: 0.4em; }
    .border { border: 1px solid #cbd5e1; border-radius: 12px; padding: 16px; margin-bottom: 16px; background: #ffffff; }
    .grid { display: grid; gap: 12px; }
    .grid-cols-1 { grid-template-columns: 1fr; }
    .grid-cols-4, .md\\:grid-cols-4 { grid-template-columns: repeat(4, 1fr); }
    .grid-cols-3, .md\\:grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
    .grid-cols-5, .sm\\:grid-cols-5 { grid-template-columns: repeat(5, 1fr); }
    code { font-family: monospace; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
    .text-muted-foreground { color: #64748b; }
    .font-bold { font-weight: 700; }
    .text-primary { color: #2563eb; }
    .text-emerald-600 { color: #059669; }
    .text-amber-600 { color: #d97706; }
    .text-purple-600 { color: #7c3aed; }
    .rounded-xl { border-radius: 12px; }
    .p-3 { padding: 12px; }
    .p-4 { padding: 16px; }
    .p-6 { padding: 24px; }
    .bg-card { background: #ffffff; }
    .bg-muted\\/20, .bg-muted\\/10 { background: #f8fafc; }
    .print\\:hidden { display: none !important; }
    @media print {
      body { margin: 0; padding: 0; }
      .border { break-inside: avoid; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  ${contentElement.innerHTML}
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Assets-Management-Operating-Workflow-Manual.html';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const sections = [
    { id: 'all', label: 'Complete Manual' },
    { id: 'architecture', label: '1. Architecture & Security' },
    { id: 'lifecycle', label: '2. Asset Lifecycle' },
    { id: 'hierarchy', label: '3. Location Hierarchy' },
    { id: 'audits', label: '4. Physical Audit SOP' },
    { id: 'transfers', label: '5. Transfers' },
    { id: 'maintenance', label: '6. Maintenance' },
    { id: 'reporting', label: '7. Reporting' },
  ];

  return (
    <div className="print-area print-doc space-y-6 pb-12 print:p-0 print:m-0 print:space-y-4 print:text-slate-900 print:bg-white print:visible">
      {/* ─── Non-printable Control Toolbar ───────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 print:hidden">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link href="/">
              <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2 text-muted-foreground">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              System Operating Workflow &amp; User Manual
            </h1>
            <Badge variant="outline" className="border-primary/40 text-primary bg-primary/5 text-xs">
              SOP v2.4
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground pl-6">
            Standard Operating Procedures (SOP) &bull; Enterprise Asset Verification, QR Auditing, and Lifecycle Management
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleDownloadOfflineHtml}
            variant="outline"
            size="sm"
            className="gap-2 h-9 shadow-2xs font-semibold"
            title="Download Standalone HTML Manual"
          >
            <FileDown className="w-4 h-4 text-primary" />
            <span>Download Offline HTML</span>
          </Button>

          <Button
            onClick={handlePrint}
            size="sm"
            className="gap-2 h-9 shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            title="Export as PDF or Send to Printer"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Save as PDF</span>
          </Button>
        </div>
      </div>

      {/* ─── Printable Document Header ────────────────────────────────────── */}
      <div className="rounded-2xl border bg-card p-6 shadow-xs space-y-4 print:border-none print:shadow-none print:p-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold shadow-xs">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <span className="font-extrabold text-lg sm:text-xl text-foreground block tracking-tight">
                Assets Management &amp; Physical Auditing System
              </span>
              <span className="text-xs text-muted-foreground block font-medium">
                Enterprise Industrial PWA &bull; Operating Guideline &bull; CMBD Enterprise / ABL Group
              </span>
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <span className="block font-semibold text-foreground">Document ID: SOP-AST-2026-01</span>
            <span className="block">Revision: 2.4.0 (Enterprise)</span>
            <span className="block">Target Scope: 13,470 Plant Assets</span>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 print:grid-cols-4 text-xs">
          <div className="p-3 rounded-xl border bg-muted/20 space-y-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">
              Total Monitored Assets
            </span>
            <span className="text-xl font-bold text-foreground">13,470 Units</span>
            <span className="text-[11px] text-muted-foreground block">14 Equipment Categories</span>
          </div>
          <div className="p-3 rounded-xl border bg-muted/20 space-y-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">
              Multi-Tier Locations
            </span>
            <span className="text-xl font-bold text-primary">18 Facilities</span>
            <span className="text-[11px] text-muted-foreground block">Company &gt; Unit &gt; Block</span>
          </div>
          <div className="p-3 rounded-xl border bg-muted/20 space-y-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">
              Auditing Accuracy
            </span>
            <span className="text-xl font-bold text-emerald-600">100% Real-Time</span>
            <span className="text-[11px] text-muted-foreground block">Optical Camera QR Scanners</span>
          </div>
          <div className="p-3 rounded-xl border bg-muted/20 space-y-1">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">
              Security Standard
            </span>
            <span className="text-xl font-bold text-purple-600">JWT + RBAC</span>
            <span className="text-[11px] text-muted-foreground block">Next.js Edge Middleware</span>
          </div>
        </div>
      </div>

      {/* ─── SECTION 1: Architecture & Security Workflow ─────────────────── */}
      <Card className="border bg-card shadow-xs print:break-inside-avoid print:shadow-none print:border-gray-300">
        <CardHeader className="pb-3 border-b bg-muted/10">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <CardTitle className="text-base sm:text-lg">
              1. System Architecture &amp; Security Boundary
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            How clients, the Next.js edge proxy, NestJS API, and Microsoft SQL Server interact securely.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-4 rounded-xl border bg-card space-y-2">
              <div className="flex items-center gap-2 text-primary font-bold">
                <Smartphone className="w-4 h-4" />
                <span>Client Layer (PWA)</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Next.js 14 Progressive Web App with offline caching capabilities, camera scanner integration, and responsive layout for barcode terminals, tablets, and desktop workstations.
              </p>
            </div>

            <div className="p-4 rounded-xl border bg-card space-y-2">
              <div className="flex items-center gap-2 text-purple-600 font-bold">
                <ShieldCheck className="w-4 h-4" />
                <span>Security &amp; API Layer</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                Next.js Edge Middleware intercepts unauthenticated page requests, redirecting to <code>/login</code>. API proxy automatically injects bearer tokens. NestJS enforces RBAC on sensitive mutations.
              </p>
            </div>

            <div className="p-4 rounded-xl border bg-card space-y-2">
              <div className="flex items-center gap-2 text-emerald-600 font-bold">
                <Database className="w-4 h-4" />
                <span>Database Engine (MSSQL)</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                High-availability Microsoft SQL Server handling 13,470+ equipment records with chunked batch insertions (1,000 items/chunk) to eliminate buffer overflows during plant-wide audits.
              </p>
            </div>
          </div>

          {/* User Role Matrix */}
          <div className="space-y-2 pt-2">
            <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground block">
              User Roles &amp; Access Permissions Matrix
            </span>
            <div className="border rounded-xl overflow-hidden text-xs">
              <div className="grid grid-cols-4 bg-muted/40 font-bold p-2.5 border-b">
                <span>Role</span>
                <span>Permissions</span>
                <span>Scope</span>
                <span>Target Users</span>
              </div>
              <div className="grid grid-cols-4 p-2.5 border-b hover:bg-muted/10">
                <span className="font-semibold text-purple-600">SUPER_ADMIN</span>
                <span className="text-muted-foreground">Full system configuration, database, user provisioning, audit deletion</span>
                <span>Global Enterprise</span>
                <span>System Administrators</span>
              </div>
              <div className="grid grid-cols-4 p-2.5 border-b hover:bg-muted/10">
                <span className="font-semibold text-primary">ASSET_MANAGER</span>
                <span className="text-muted-foreground">Audit plan publishing, discrepancy review, transfer approvals, reports</span>
                <span>Company Tree</span>
                <span>Plant Heads, Audit Leads</span>
              </div>
              <div className="grid grid-cols-4 p-2.5 border-b hover:bg-muted/10">
                <span className="font-semibold text-amber-600">AUDITOR</span>
                <span className="text-muted-foreground">Initiate audit sessions, scan QR tags, record missing/damaged status</span>
                <span>Assigned Location</span>
                <span>Floor Audit Field Staff</span>
              </div>
              <div className="grid grid-cols-4 p-2.5 hover:bg-muted/10">
                <span className="font-semibold text-foreground">TECHNICIAN</span>
                <span className="text-muted-foreground">Update maintenance work orders, record parts replaced, service tickets</span>
                <span>Assigned Equipment</span>
                <span>Maintenance Engineers</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── SECTION 2: End-to-End Asset Lifecycle ───────────────────────── */}
      <Card className="border bg-card shadow-xs print:break-inside-avoid print:shadow-none print:border-gray-300">
        <CardHeader className="pb-3 border-b bg-muted/10">
          <div className="flex items-center gap-2">
            <Boxes className="w-5 h-5 text-primary" />
            <CardTitle className="text-base sm:text-lg">
              2. Complete Asset Lifecycle Workflow
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            From procurement and barcode tagging to operational deployment, maintenance, and retirement.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {/* Step Progression Flowchart */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-center text-xs">
            <div className="p-3 rounded-xl border bg-card space-y-1 relative">
              <span className="h-6 w-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center mx-auto text-xs">1</span>
              <span className="font-bold block text-foreground">Procurement</span>
              <span className="text-[11px] text-muted-foreground block">Invoice, SAP code, vendor contract, warranty term</span>
            </div>

            <div className="p-3 rounded-xl border bg-card space-y-1 relative">
              <span className="h-6 w-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center mx-auto text-xs">2</span>
              <span className="font-bold block text-foreground">Tagging</span>
              <span className="text-[11px] text-muted-foreground block">Generate QR code: <code>AST:&#123;code&#125;</code> and print physical placard</span>
            </div>

            <div className="p-3 rounded-xl border bg-card space-y-1 relative">
              <span className="h-6 w-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center mx-auto text-xs">3</span>
              <span className="font-bold block text-foreground">Station Assignment</span>
              <span className="text-[11px] text-muted-foreground block">Assign to Company &gt; Unit &gt; Block Station</span>
            </div>

            <div className="p-3 rounded-xl border bg-card space-y-1 relative">
              <span className="h-6 w-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center mx-auto text-xs">4</span>
              <span className="font-bold block text-foreground">Verification &amp; Care</span>
              <span className="text-[11px] text-muted-foreground block">Scheduled audits, optical QR scans, preventative upkeep</span>
            </div>

            <div className="p-3 rounded-xl border bg-card space-y-1 relative">
              <span className="h-6 w-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center mx-auto text-xs">5</span>
              <span className="font-bold block text-foreground">Retirement</span>
              <span className="text-[11px] text-muted-foreground block">Zero net book value, write-off, or physical decommissioning</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl border bg-muted/20 text-xs text-muted-foreground space-y-1">
            <span className="font-semibold text-foreground block">Valuation &amp; Depreciation Formula:</span>
            <span>
              The system calculates current net book value using Straight Line (SLM):{' '}
              <code className="text-primary font-semibold">Book Value = Purchase Cost - ((Cost / Useful Life Years) &times; Elapsed Years)</code>.
              Assets are classified into 14 distinct categories with predefined economic life cycles.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ─── SECTION 3: 4-Tier Location Hierarchy ────────────────────────── */}
      <Card className="border bg-card shadow-xs print:break-inside-avoid print:shadow-none print:border-gray-300">
        <CardHeader className="pb-3 border-b bg-muted/10">
          <div className="flex items-center gap-2">
            <Network className="w-5 h-5 text-primary" />
            <CardTitle className="text-base sm:text-lg">
              3. 4-Tier Location Hierarchy &amp; Audit Scope Inheritance
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            Organizational layout preventing cross-plant contamination during inventory checks.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 rounded-xl border bg-card space-y-1 border-primary/30">
              <Badge variant="outline" className="text-[10px] font-bold border-primary/40 text-primary">TIER 1: COMPANY</Badge>
              <span className="font-bold block text-foreground">Enterprises</span>
              <span className="text-[11px] text-muted-foreground block">
                Root organizations (e.g. <code>ABL</code>, <code>CMBD</code>). Defines legal asset ownership and broad audit bounds.
              </span>
            </div>

            <div className="p-3.5 rounded-xl border bg-card space-y-1 border-primary/20">
              <Badge variant="outline" className="text-[10px] font-bold border-sky-500/40 text-sky-600">TIER 2: UNIT</Badge>
              <span className="font-bold block text-foreground">Operational Plants</span>
              <span className="text-[11px] text-muted-foreground block">
                Manufacturing facilities (e.g. <code>CMBD-U01</code>, <code>CMBD-U02</code>, <code>ABLU1</code>). Contains physical buildings.
              </span>
            </div>

            <div className="p-3.5 rounded-xl border bg-card space-y-1 border-primary/20">
              <Badge variant="outline" className="text-[10px] font-bold border-amber-500/40 text-amber-600">TIER 3: BLOCK</Badge>
              <span className="font-bold block text-foreground">Factory Floors</span>
              <span className="text-[11px] text-muted-foreground block">
                Specific plant sectors (e.g. <code>BLOCK-A</code> through <code>BLOCK-E</code>, <code>B14F</code>).
              </span>
            </div>

            <div className="p-3.5 rounded-xl border bg-card space-y-1 border-primary/20">
              <Badge variant="outline" className="text-[10px] font-bold border-emerald-500/40 text-emerald-600">TIER 4: LINE</Badge>
              <span className="font-bold block text-foreground">Production Stations</span>
              <span className="text-[11px] text-muted-foreground block">
                Individual workstations and conveyor lines where machinery and equipment operate.
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 text-xs space-y-1">
            <span className="font-bold text-foreground block">Hierarchical Scope Filtering Rule:</span>
            <p className="text-muted-foreground leading-relaxed">
              When an Audit Plan is initiated for a Company (e.g. <code>Scope: LOCATION (CMBD)</code>), all child Units, Blocks, and Stations under <code>CMBD</code> are recursively computed. Auditors creating sessions under this plan will strictly see only those descendant locations. The backend rejects any out-of-scope location submission with <code>400 Bad Request</code>.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ─── SECTION 4: Physical Verification SOP ────────────────────────── */}
      <Card className="border bg-card shadow-xs print:break-inside-avoid print:shadow-none print:border-gray-300">
        <CardHeader className="pb-3 border-b bg-muted/10">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-primary" />
            <CardTitle className="text-base sm:text-lg">
              4. Physical Audit &amp; Optical QR Verification SOP
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            Standard Operating Procedure for field auditors performing inventory verification walks.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="space-y-3 text-xs">
            <div className="flex items-start gap-3 p-3.5 rounded-xl border bg-card">
              <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center shrink-0 text-xs">A</span>
              <div className="space-y-1">
                <span className="font-bold text-foreground block">Step 1: Create Audit Plan</span>
                <p className="text-muted-foreground">
                  Asset Manager defines plan name (e.g. <em>"CMBD Annual Machinery Audit"</em>), selects <code>Scope: LOCATION</code>, and specifies the parent company or plant unit. Target scheduled date is assigned.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl border bg-card">
              <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center shrink-0 text-xs">B</span>
              <div className="space-y-1">
                <span className="font-bold text-foreground block">Step 2: Start Audit Session (Location Pre-population)</span>
                <p className="text-muted-foreground">
                  The field auditor starts an audit session, selecting the specific block or station. The backend database automatically populates expected assets in safe 1,000-item chunks.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl border bg-card">
              <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center shrink-0 text-xs">C</span>
              <div className="space-y-1">
                <span className="font-bold text-foreground block">Step 3: Optical Camera QR Scanning</span>
                <p className="text-muted-foreground">
                  Auditor uses the PWA QR camera or barcode reader at <code>/scan</code> or within the session checklist. The system verifies the scanned asset against the expected location:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                  <span className="p-1.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-500/20 text-center">
                    VERIFIED (Location Matches)
                  </span>
                  <span className="p-1.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 font-semibold border border-amber-500/20 text-center">
                    MISMATCH (Found at Other Station)
                  </span>
                  <span className="p-1.5 rounded bg-rose-500/10 text-rose-700 dark:text-rose-400 font-semibold border border-rose-500/20 text-center">
                    DAMAGED (Physical Defect Logged)
                  </span>
                  <span className="p-1.5 rounded bg-destructive/10 text-destructive font-semibold border border-destructive/20 text-center">
                    MISSING (Not Found on Floor)
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl border bg-card">
              <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center shrink-0 text-xs">D</span>
              <div className="space-y-1">
                <span className="font-bold text-foreground block">Step 4: Discrepancy Resolution &amp; Manager Review</span>
                <p className="text-muted-foreground">
                  All flagged items appear in the Discrepancies Ledger. Asset managers examine found locations, approve transfers to update official station records, or dispatch maintenance repair orders for damaged machinery.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── SECTION 5: Transfers, Maintenance & Vendors ──────────────────── */}
      <Card className="border bg-card shadow-xs print:break-inside-avoid print:shadow-none print:border-gray-300">
        <CardHeader className="pb-3 border-b bg-muted/10">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5 text-primary" />
            <CardTitle className="text-base sm:text-lg">
              5. Transfers, Maintenance Work Orders &amp; Vendor Management
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            Custody movement, preventative upkeep scheduling, and supplier contracts.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-4 rounded-xl border bg-card space-y-2">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <ArrowLeftRight className="w-4 h-4 text-primary" />
                <span>Asset Transfers</span>
              </span>
              <p className="text-muted-foreground">
                Formal relocation between departments or plant blocks. Status lifecycle: <code>REQUESTED &rarr; APPROVED &rarr; IN_TRANSIT &rarr; COMPLETED</code>. Automatically records historical custodian changes in audit trail.
              </p>
            </div>

            <div className="p-4 rounded-xl border bg-card space-y-2">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-amber-600" />
                <span>Maintenance Work Orders</span>
              </span>
              <p className="text-muted-foreground">
                Corrective and preventative service tickets. Technicians log labor hours, replacement parts, and maintenance costs. Automated thresholds alert when service is overdue (default: 7 days).
              </p>
            </div>

            <div className="p-4 rounded-xl border bg-card space-y-2">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-emerald-600" />
                <span>Vendors &amp; Warranties</span>
              </span>
              <p className="text-muted-foreground">
                Centralized supplier directory. Links asset purchase records to vendor contracts and invoices. Automatic alert banners highlight equipment with warranties expiring within 30 days.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── SECTION 6: Compliance Reporting ─────────────────────────────── */}
      <Card className="border bg-card shadow-xs print:break-inside-avoid print:shadow-none print:border-gray-300">
        <CardHeader className="pb-3 border-b bg-muted/10">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            <CardTitle className="text-base sm:text-lg">
              6. Audit Compliance &amp; Executive Reporting
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            Audit status certificates, asset valuation reconciliation, and compliance metrics.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-3 text-xs">
          <p className="text-muted-foreground leading-relaxed">
            The reporting module at <code>/reports</code> consolidates verification results across all sessions under an audit plan. It produces:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
            <li><strong>Verification Coverage Rate</strong>: Percentage of expected plant inventory physically scanned and verified on the floor.</li>
            <li><strong>Discrepancy Breakdown</strong>: Itemized counts of location mismatches, physical damages, and missing equipment.</li>
            <li><strong>Reconciled Asset Valuation</strong>: Total financial book value confirmed versus assets under dispute.</li>
            <li><strong>Audit Sign-off Certificate</strong>: Printable executive audit compliance certificate signed by the supervising Asset Manager and Auditor.</li>
          </ul>
        </CardContent>
      </Card>

      {/* ─── Printable Document Footer ────────────────────────────────────── */}
      <div className="border-t pt-4 text-center text-xs text-muted-foreground print:text-gray-500">
        <p className="font-semibold text-foreground">
          Assets Management &amp; Auditing System &bull; Enterprise Operating Manual
        </p>
        <p className="text-[11px] mt-0.5">
          Generated from Antigravity Enterprise Engine &bull; Confidential &bull; For Internal Plant Operations Use Only
        </p>
      </div>
    </div>
  );
}

