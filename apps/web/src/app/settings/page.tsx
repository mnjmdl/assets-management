'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Settings,
  Building,
  Boxes,
  ClipboardCheck,
  Wrench,
  Tags,
  Users,
  Activity,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Edit2,
  Shield,
  KeyRound,
  Database,
  Server,
  Clock,
  Sparkles,
  LogOut,
} from 'lucide-react';
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

interface SystemStats {
  assetsCount: number;
  activeAssetsCount: number;
  categoriesCount: number;
  locationsCount: number;
  auditsCount: number;
  sessionsCount: number;
  usersCount: number;
  maintenanceCount: number;
  vendorsCount: number;
  dbStatus: string;
  serverTime: string;
  nodeVersion: string;
  uptimeSeconds: number;
}

interface CategoryItem {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  isActive: boolean;
  _count?: { assets: number };
}

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
  phone?: string | null;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string | null;
  _count?: { assignedAssets: number; auditSessions: number };
}

type TabType =
  | 'general'
  | 'assets'
  | 'audits'
  | 'maintenance'
  | 'categories'
  | 'users'
  | 'system';

export default function SettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSignOut = () => {
    document.cookie = 'auth_token=; path=/; max-age=0; SameSite=Lax;';
    document.cookie = 'accessToken=; path=/; max-age=0; SameSite=Lax;';
    localStorage.removeItem('token');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    sessionStorage.clear();
    router.push('/login?signedOut=true');
    router.refresh();
  };

  // Settings State
  const [settings, setSettings] = useState<Record<string, string>>({});

  // System Stats State
  const [stats, setStats] = useState<SystemStats | null>(null);

  // Categories State
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    code: '',
    description: '',
    isActive: true,
  });

  // Users State
  const [users, setUsers] = useState<UserItem[]>([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'AUDITOR',
    phone: '',
  });

  // Fetch all initial data
  const loadData = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [resSettings, resStats, resCategories, resUsers] = await Promise.all([
        fetch('/api/settings'),
        fetch('/api/settings/stats'),
        fetch('/api/settings/categories'),
        fetch('/api/settings/users'),
      ]);

      if (resSettings.ok) {
        const json = await resSettings.json();
        setSettings(json?.data || json || {});
      }
      if (resStats.ok) {
        const json = await resStats.json();
        setStats(json?.data || json);
      }
      if (resCategories.ok) {
        const json = await resCategories.json();
        setCategories(json?.data || json || []);
      }
      if (resUsers.ok) {
        const json = await resUsers.json();
        setUsers(json?.data || json || []);
      }
    } catch (err: any) {
      console.error('Failed to load settings data:', err);
      setErrorMessage(err?.message || 'Failed to load configuration data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Save Settings
  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setSaveMessage(null);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || 'Failed to update system settings');
      }

      const json = await res.json();
      setSettings(json?.data || json || settings);
      setSaveMessage('Configuration settings saved successfully!');
      setTimeout(() => setSaveMessage(null), 3500);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error updating settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSettingChange = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  // Category Actions
  const handleOpenCategoryModal = (cat?: CategoryItem) => {
    if (cat) {
      setEditingCategory(cat);
      setCategoryForm({
        name: cat.name,
        code: cat.code,
        description: cat.description || '',
        isActive: cat.isActive,
      });
    } else {
      setEditingCategory(null);
      setCategoryForm({
        name: '',
        code: `CAT-${Math.floor(1000 + Math.random() * 9000)}`,
        description: '',
        isActive: true,
      });
    }
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        const res = await fetch(`/api/settings/categories/${editingCategory.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(categoryForm),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || 'Failed to update category');
        }
      } else {
        const res = await fetch('/api/settings/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(categoryForm),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || 'Failed to create category');
        }
      }

      setIsCategoryModalOpen(false);
      // Refresh categories
      const res = await fetch('/api/settings/categories');
      if (res.ok) {
        const json = await res.json();
        setCategories(json?.data || json || []);
      }
      setSaveMessage(editingCategory ? 'Category updated!' : 'Category created!');
      setTimeout(() => setSaveMessage(null), 3500);
    } catch (err: any) {
      alert(err.message || 'Failed to save category');
    }
  };

  const handleDeleteCategory = async (cat: CategoryItem) => {
    if (!confirm(`Are you sure you want to delete category "${cat.name}"?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/settings/categories/${cat.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to delete category');
      }

      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
      setSaveMessage(`Category "${cat.name}" removed successfully!`);
      setTimeout(() => setSaveMessage(null), 3500);
    } catch (err: any) {
      alert(err.message || 'Cannot delete category');
    }
  };

  // User Actions
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/settings/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userForm),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to create user');
      }

      setIsUserModalOpen(false);
      setUserForm({ name: '', email: '', password: '', role: 'AUDITOR', phone: '' });

      // Refresh users
      const refreshRes = await fetch('/api/settings/users');
      if (refreshRes.ok) {
        const json = await refreshRes.json();
        setUsers(json?.data || json || []);
      }
      setSaveMessage('New user registered successfully!');
      setTimeout(() => setSaveMessage(null), 3500);
    } catch (err: any) {
      alert(err.message || 'Failed to create user');
    }
  };

  const handleToggleUserStatus = async (user: UserItem) => {
    try {
      const res = await fetch(`/api/settings/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to update user status');
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isActive: !user.isActive } : u))
      );
      setSaveMessage(`User "${user.name}" status updated!`);
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to change user status');
    }
  };

  const navItems = [
    { id: 'general' as TabType, label: 'General & Org', icon: Building },
    { id: 'assets' as TabType, label: 'Asset Policies', icon: Boxes },
    { id: 'audits' as TabType, label: 'Audit Rules', icon: ClipboardCheck },
    { id: 'maintenance' as TabType, label: 'Maintenance & Alerts', icon: Wrench },
    { id: 'categories' as TabType, label: `Categories (${categories.length})`, icon: Tags },
    { id: 'users' as TabType, label: `Users & Roles (${users.length})`, icon: Users },
    { id: 'system' as TabType, label: 'System Health', icon: Activity },
  ];

  if (loading) {
    return (
      <Card className="p-12 text-center flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-xs sm:text-sm text-muted-foreground">Loading system settings...</p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Page Title & Status Banner */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b pb-3.5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary" />
            <span>System Settings</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Configure enterprise organization policies, barcode schemes, audit constraints &amp; security
          </p>
        </div>

        <div className="flex items-center gap-2 pt-1 sm:pt-0">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="gap-1.5 h-9 shadow-2xs"
            title="Reload Settings"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reload</span>
          </Button>

          {activeTab !== 'categories' && activeTab !== 'users' && activeTab !== 'system' && (
            <Button
              size="sm"
              onClick={() => handleSaveSettings()}
              disabled={saving}
              className="gap-1.5 h-9 shadow-sm"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {saveMessage && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs sm:text-sm flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="font-medium">{saveMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs sm:text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="font-medium">{errorMessage}</span>
        </div>
      )}

      {/* Main Settings Navigation Tabs */}
      <div className="flex overflow-x-auto no-scrollbar gap-1.5 p-1 rounded-xl bg-muted/40 border text-xs">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : ''}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* ─── TAB 1: General & Organization ─────────────────────────────────── */}
      {activeTab === 'general' && (
        <Card className="border bg-card shadow-xs">
          <CardHeader className="pb-4">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Building className="w-5 h-5 text-primary" />
              <span>Organization &amp; Regional Parameters</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Primary enterprise profile, currency, and operational timezone used across reporting and audits.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Legal Organization / Company Name
                  </label>
                  <Input
                    className="h-9 text-xs"
                    value={settings.company_name || ''}
                    onChange={(e) => handleSettingChange('company_name', e.target.value)}
                    placeholder="e.g. CMBD Enterprise / ABL Group"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Displays on audit reports, export certificates, and system headers.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Company Short Code
                  </label>
                  <Input
                    className="h-9 text-xs font-mono"
                    value={settings.company_code || ''}
                    onChange={(e) => handleSettingChange('company_code', e.target.value)}
                    placeholder="e.g. CMBD"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Used as default company root identifier in location hierarchy.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Default Currency Symbol
                  </label>
                  <select
                    className="w-full h-9 px-3 rounded-lg border bg-background text-xs font-medium"
                    value={settings.currency || 'USD ($)'}
                    onChange={(e) => handleSettingChange('currency', e.target.value)}
                  >
                    <option value="USD ($)">USD ($) - US Dollar</option>
                    <option value="BDT (৳)">BDT (৳) - Bangladeshi Taka</option>
                    <option value="EUR (€)">EUR (€) - Euro</option>
                    <option value="GBP (£)">GBP (£) - British Pound</option>
                    <option value="INR (₹)">INR (₹) - Indian Rupee</option>
                    <option value="AED (د.إ)">AED (د.إ) - UAE Dirham</option>
                  </select>
                  <p className="text-[10px] text-muted-foreground">
                    Applied to asset procurement costs and depreciation valuations.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    System Timezone
                  </label>
                  <select
                    className="w-full h-9 px-3 rounded-lg border bg-background text-xs font-medium"
                    value={settings.timezone || 'Asia/Dhaka'}
                    onChange={(e) => handleSettingChange('timezone', e.target.value)}
                  >
                    <option value="Asia/Dhaka">Asia/Dhaka (GMT+6)</option>
                    <option value="UTC">UTC (Coordinated Universal Time)</option>
                    <option value="America/New_York">America/New_York (EST/EDT)</option>
                    <option value="Europe/London">Europe/London (GMT/BST)</option>
                    <option value="Asia/Dubai">Asia/Dubai (GMT+4)</option>
                    <option value="Asia/Kolkata">Asia/Kolkata (GMT+5:30)</option>
                    <option value="Asia/Singapore">Asia/Singapore (GMT+8)</option>
                  </select>
                  <p className="text-[10px] text-muted-foreground">
                    Controls scan timestamps and scheduled maintenance calendar alerts.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Fiscal Year Start Month
                  </label>
                  <select
                    className="w-full h-9 px-3 rounded-lg border bg-background text-xs font-medium"
                    value={settings.fiscal_year_start || 'July'}
                    onChange={(e) => handleSettingChange('fiscal_year_start', e.target.value)}
                  >
                    <option value="January">January</option>
                    <option value="April">April</option>
                    <option value="July">July</option>
                    <option value="October">October</option>
                  </select>
                  <p className="text-[10px] text-muted-foreground">
                    Financial cycle calculation baseline for annual depreciation reports.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Operations Support Email
                  </label>
                  <Input
                    className="h-9 text-xs"
                    type="email"
                    value={settings.contact_email || ''}
                    onChange={(e) => handleSettingChange('contact_email', e.target.value)}
                    placeholder="admin@assets.com"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Recipients of critical discrepancy and warranty expiry alerts.
                  </p>
                </div>
              </div>

              <div className="pt-3 flex justify-end">
                <Button type="submit" disabled={saving} size="sm" className="gap-1.5">
                  <Save className="w-4 h-4" />
                  <span>Save General Settings</span>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ─── TAB 2: Asset Policies ─────────────────────────────────────────── */}
      {activeTab === 'assets' && (
        <Card className="border bg-card shadow-xs">
          <CardHeader className="pb-4">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Boxes className="w-5 h-5 text-primary" />
              <span>Asset Identification &amp; Valuation Rules</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Tag generation prefixes, QR/Barcode syntax formatting, and standard depreciation policies.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Asset Tag Prefix
                  </label>
                  <Input
                    className="h-9 text-xs font-mono"
                    value={settings.asset_prefix || 'AST-'}
                    onChange={(e) => handleSettingChange('asset_prefix', e.target.value)}
                    placeholder="e.g. AST-"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Prefix assigned to newly registered assets (e.g. AST-2026-0001).
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    QR / Barcode Payload Template
                  </label>
                  <Input
                    className="h-9 text-xs font-mono"
                    value={settings.barcode_format || 'AST:{assetCode}'}
                    onChange={(e) => handleSettingChange('barcode_format', e.target.value)}
                    placeholder="e.g. AST:{assetCode}"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Encoding format for optical QR codes and physical asset tags.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Standard Depreciation Method
                  </label>
                  <select
                    className="w-full h-9 px-3 rounded-lg border bg-background text-xs font-medium"
                    value={settings.default_depreciation || 'STRAIGHT_LINE'}
                    onChange={(e) => handleSettingChange('default_depreciation', e.target.value)}
                  >
                    <option value="STRAIGHT_LINE">Straight Line (SLM)</option>
                    <option value="DECLINING_BALANCE">Written Down Value / Declining Balance</option>
                    <option value="SUM_OF_YEARS_DIGITS">Sum of Years Digits</option>
                  </select>
                  <p className="text-[10px] text-muted-foreground">
                    Default method assigned when creating machinery, computers, and furniture.
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/20">
                    <div>
                      <span className="text-xs font-semibold block text-foreground">
                        Require Serial Number
                      </span>
                      <span className="text-[11px] text-muted-foreground block">
                        Prevent asset creation if manufacturer serial number is empty.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-primary accent-primary cursor-pointer"
                      checked={settings.require_serial_number === 'true'}
                      onChange={(e) =>
                        handleSettingChange('require_serial_number', String(e.target.checked))
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/20">
                    <div>
                      <span className="text-xs font-semibold block text-foreground">
                        Auto-Calculate Net Book Value
                      </span>
                      <span className="text-[11px] text-muted-foreground block">
                        Dynamically recalculate current asset valuation on reports.
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-primary accent-primary cursor-pointer"
                      checked={settings.auto_calc_depreciation === 'true'}
                      onChange={(e) =>
                        handleSettingChange('auto_calc_depreciation', String(e.target.checked))
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 flex justify-end">
                <Button type="submit" disabled={saving} size="sm" className="gap-1.5">
                  <Save className="w-4 h-4" />
                  <span>Save Asset Policies</span>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ─── TAB 3: Audit Rules ────────────────────────────────────────────── */}
      {activeTab === 'audits' && (
        <Card className="border bg-card shadow-xs">
          <CardHeader className="pb-4">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-primary" />
              <span>Physical Audit &amp; Verification Rules</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Batch processing boundaries, cross-location constraints, and automated discrepancy flags.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Checklist Pre-population Batch Size
                  </label>
                  <Input
                    className="h-9 text-xs"
                    type="number"
                    value={settings.audit_batch_size || '1000'}
                    onChange={(e) => handleSettingChange('audit_batch_size', e.target.value)}
                    placeholder="1000"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Number of database items inserted per chunk when initializing enterprise audit sessions.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Default Audit Scope Filter
                  </label>
                  <select
                    className="w-full h-9 px-3 rounded-lg border bg-background text-xs font-medium"
                    value={settings.audit_default_scope || 'LOCATION'}
                    onChange={(e) => handleSettingChange('audit_default_scope', e.target.value)}
                  >
                    <option value="LOCATION">LOCATION (Company / Unit / Block Hierarchy)</option>
                    <option value="ALL">ALL (Entire Enterprise Inventory)</option>
                    <option value="CATEGORY">CATEGORY (Asset Class Filter)</option>
                  </select>
                  <p className="text-[10px] text-muted-foreground">
                    Default selection when launching new verification plans.
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/20">
                  <div>
                    <span className="text-xs font-semibold block text-foreground">
                      Strict Location Hierarchy Enforcement
                    </span>
                    <span className="text-[11px] text-muted-foreground block">
                      Reject audit sessions created outside parent company/unit tree with 400 Bad Request.
                    </span>
                  </div>
                  <Badge variant="outline" className="text-[10px] py-0 px-2 text-emerald-600 border-emerald-500/30">
                    ENFORCED
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/20">
                  <div>
                    <span className="text-xs font-semibold block text-foreground">
                      Auto-Flag Mismatched Scans as Discrepancies
                    </span>
                    <span className="text-[11px] text-muted-foreground block">
                      Instantly record MISMATCH items into the discrepancy ledger when scanned at unexpected stations.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-primary accent-primary cursor-pointer"
                    checked={settings.auto_flag_discrepancies === 'true'}
                    onChange={(e) =>
                      handleSettingChange('auto_flag_discrepancies', String(e.target.checked))
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/20">
                  <div>
                    <span className="text-xs font-semibold block text-foreground">
                      Require Managerial Review Sign-off
                    </span>
                    <span className="text-[11px] text-muted-foreground block">
                      Prevent final completion of audit plans until all discrepancies have been reviewed.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-primary accent-primary cursor-pointer"
                    checked={settings.audit_require_reviewer === 'true'}
                    onChange={(e) =>
                      handleSettingChange('audit_require_reviewer', String(e.target.checked))
                    }
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end">
                <Button type="submit" disabled={saving} size="sm" className="gap-1.5">
                  <Save className="w-4 h-4" />
                  <span>Save Audit Rules</span>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ─── TAB 4: Maintenance & Alerts ───────────────────────────────────── */}
      {activeTab === 'maintenance' && (
        <Card className="border bg-card shadow-xs">
          <CardHeader className="pb-4">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Wrench className="w-5 h-5 text-primary" />
              <span>Preventative Maintenance &amp; Expiry Thresholds</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Configure advance notice periods for warranties, service reminders, and retention.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Warranty Expiration Warning (Days)
                  </label>
                  <Input
                    className="h-9 text-xs"
                    type="number"
                    value={settings.warranty_alert_days || '30'}
                    onChange={(e) => handleSettingChange('warranty_alert_days', e.target.value)}
                    placeholder="30"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Days in advance to surface expiring warranty alerts on dashboard.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Maintenance Overdue Notice (Days)
                  </label>
                  <Input
                    className="h-9 text-xs"
                    type="number"
                    value={settings.maintenance_alert_days || '7'}
                    onChange={(e) => handleSettingChange('maintenance_alert_days', e.target.value)}
                    placeholder="7"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Threshold before a scheduled service is marked critically OVERDUE.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    Audit Trail Log Retention (Days)
                  </label>
                  <Input
                    className="h-9 text-xs"
                    type="number"
                    value={settings.audit_trail_retention_days || '365'}
                    onChange={(e) =>
                      handleSettingChange('audit_trail_retention_days', e.target.value)
                    }
                    placeholder="365"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Historical retention period for forensic modification logs.
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/20">
                  <div>
                    <span className="text-xs font-semibold block text-foreground">
                      Automated Maintenance Reminders
                    </span>
                    <span className="text-[11px] text-muted-foreground block">
                      Trigger daily notifications to assigned technicians for upcoming service schedules.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-primary accent-primary cursor-pointer"
                    checked={settings.auto_maintenance_reminders === 'true'}
                    onChange={(e) =>
                      handleSettingChange('auto_maintenance_reminders', String(e.target.checked))
                    }
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/20">
                  <div>
                    <span className="text-xs font-semibold block text-foreground">
                      Email Dispatch on Major Discrepancy
                    </span>
                    <span className="text-[11px] text-muted-foreground block">
                      Send email alert when an asset is flagged as DAMAGED or MISSING during an audit.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-primary accent-primary cursor-pointer"
                    checked={settings.email_alerts_enabled === 'true'}
                    onChange={(e) =>
                      handleSettingChange('email_alerts_enabled', String(e.target.checked))
                    }
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end">
                <Button type="submit" disabled={saving} size="sm" className="gap-1.5">
                  <Save className="w-4 h-4" />
                  <span>Save Maintenance Policies</span>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ─── TAB 5: Categories ─────────────────────────────────────────────── */}
      {activeTab === 'categories' && (
        <Card className="border bg-card shadow-xs">
          <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Tags className="w-5 h-5 text-primary" />
                <span>Asset Classification Classes ({categories.length})</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Asset classes (Factory Buildings, Machinery, Office Computers, FF&amp;E) and their assigned assets.
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => handleOpenCategoryModal()}
              className="gap-1.5 h-9 shadow-sm shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add Category</span>
            </Button>
          </CardHeader>
          <CardContent className="p-0 sm:p-6 sm:pt-0">
            <div className="border rounded-xl overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="text-xs font-bold">Category Name</TableHead>
                    <TableHead className="text-xs font-bold">Code</TableHead>
                    <TableHead className="text-xs font-bold">Description</TableHead>
                    <TableHead className="text-xs font-bold text-center">Assigned Assets</TableHead>
                    <TableHead className="text-xs font-bold text-center">Status</TableHead>
                    <TableHead className="text-xs font-bold text-right pr-4">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((cat) => {
                    const count = cat._count?.assets || 0;
                    return (
                      <TableRow key={cat.id} className="hover:bg-muted/10 text-xs">
                        <TableCell className="font-semibold text-foreground">
                          {cat.name}
                        </TableCell>
                        <TableCell className="font-mono text-muted-foreground">
                          {cat.code}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-xs truncate">
                          {cat.description || '—'}
                        </TableCell>
                        <TableCell className="text-center font-bold">
                          <Badge variant="outline" className="text-[11px] font-medium">
                            {count.toLocaleString()} assets
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {cat.isActive ? (
                            <Badge variant="success" className="text-[10px] py-0 px-2">
                              ACTIVE
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] py-0 px-2">
                              INACTIVE
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right pr-4">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => handleOpenCategoryModal(cat)}
                              title="Edit Category"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            {count === 0 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDeleteCategory(cat)}
                                title="Delete Category"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── TAB 6: Users & Roles ──────────────────────────────────────────── */}
      {activeTab === 'users' && (
        <Card className="border bg-card shadow-xs">
          <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <span>Personnel, Auditors &amp; Access Controls ({users.length})</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Manage system users, define security roles (Super Admin, Auditor, Asset Manager), and toggle access.
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => setIsUserModalOpen(true)}
              className="gap-1.5 h-9 shadow-sm shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add User</span>
            </Button>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 sm:pt-0 space-y-4">
            {/* Active User Session Card */}
            <div className="p-3.5 rounded-xl border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm border border-primary/20 shrink-0">
                  SA
                </div>
                <div>
                  <span className="font-semibold text-xs text-foreground block">
                    Current Signed In Account: System Admin (system.admin@assets.com)
                  </span>
                  <span className="text-[11px] text-muted-foreground block">
                    Role: SUPER_ADMIN • Active enterprise session token stored
                  </span>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10 h-9 shrink-0"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </Button>
            </div>

            <div className="border rounded-xl overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="text-xs font-bold">User Name</TableHead>
                    <TableHead className="text-xs font-bold">Email Address</TableHead>
                    <TableHead className="text-xs font-bold">Role</TableHead>
                    <TableHead className="text-xs font-bold">Contact</TableHead>
                    <TableHead className="text-xs font-bold text-center">Status</TableHead>
                    <TableHead className="text-xs font-bold text-right pr-4">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id} className="hover:bg-muted/10 text-xs">
                      <TableCell className="font-semibold text-foreground">
                        {u.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] py-0 px-2 font-medium ${
                            u.role === 'SUPER_ADMIN'
                              ? 'border-purple-500/40 text-purple-600 bg-purple-500/5'
                              : u.role === 'AUDITOR'
                              ? 'border-primary/40 text-primary bg-primary/5'
                              : 'border-muted text-muted-foreground'
                          }`}
                        >
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{u.phone || '—'}</TableCell>
                      <TableCell className="text-center">
                        {u.isActive ? (
                          <Badge variant="success" className="text-[10px] py-0 px-2">
                            ACTIVE
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px] py-0 px-2">
                            DISABLED
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => handleToggleUserStatus(u)}
                        >
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── TAB 7: System Health ──────────────────────────────────────────── */}
      {activeTab === 'system' && stats && (
        <div className="space-y-4">
          {/* Key Metrics Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="p-4 border bg-card">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                Total Plant Assets
              </span>
              <span className="text-2xl font-bold text-foreground">
                {stats.assetsCount.toLocaleString()}
              </span>
              <span className="text-[10px] text-emerald-600 block mt-0.5">
                {stats.activeAssetsCount.toLocaleString()} active in inventory
              </span>
            </Card>

            <Card className="p-4 border bg-card">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                Hierarchy Locations
              </span>
              <span className="text-2xl font-bold text-primary">{stats.locationsCount}</span>
              <span className="text-[10px] text-muted-foreground block mt-0.5">
                Companies, units &amp; blocks
              </span>
            </Card>

            <Card className="p-4 border bg-card">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                Asset Categories
              </span>
              <span className="text-2xl font-bold text-amber-600">{stats.categoriesCount}</span>
              <span className="text-[10px] text-muted-foreground block mt-0.5">
                Factory &amp; office classes
              </span>
            </Card>

            <Card className="p-4 border bg-card">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                Audit Plans
              </span>
              <span className="text-2xl font-bold text-foreground">{stats.auditsCount}</span>
              <span className="text-[10px] text-muted-foreground block mt-0.5">
                {stats.sessionsCount} session walk(s)
              </span>
            </Card>
          </div>

          {/* Database & Environment Info */}
          <Card className="border bg-card shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <Database className="w-5 h-5 text-emerald-600" />
                <span>MSSQL Database &amp; Runtime Environment</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time operational status, service uptime, and backend container telemetry.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl border bg-muted/20 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                    MSSQL Database Link
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                      CONNECTED &amp; HEALTHY
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl border bg-muted/20 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                    Node.js Engine
                  </span>
                  <span className="text-sm font-semibold font-mono text-foreground">
                    {stats.nodeVersion} (x64)
                  </span>
                </div>

                <div className="p-3 rounded-xl border bg-muted/20 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                    API Process Uptime
                  </span>
                  <span className="text-sm font-semibold font-mono text-foreground">
                    {Math.floor(stats.uptimeSeconds / 60)} minutes ({stats.uptimeSeconds}s)
                  </span>
                </div>

                <div className="p-3 rounded-xl border bg-muted/20 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                    Server Clock (UTC)
                  </span>
                  <span className="text-xs font-mono text-muted-foreground">
                    {new Date(stats.serverTime).toUTCString()}
                  </span>
                </div>

                <div className="p-3 rounded-xl border bg-muted/20 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                    Active System Users
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {stats.usersCount} Administrator(s)
                  </span>
                </div>

                <div className="p-3 rounded-xl border bg-muted/20 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                    Maintenance Tickets
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {stats.maintenanceCount} Record(s) logged
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── Category Modal ─────────────────────────────────────────────────── */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-base font-bold text-foreground">
                {editingCategory ? 'Edit Asset Category' : 'Create New Asset Category'}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={() => setIsCategoryModalOpen(false)}
              >
                ✕
              </Button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Category Name</label>
                <Input
                  required
                  className="h-9 text-xs"
                  placeholder="e.g. Electrical Generators"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Class Code</label>
                <Input
                  required
                  className="h-9 text-xs font-mono"
                  placeholder="e.g. CAT-4500"
                  value={categoryForm.code}
                  onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Description (Optional)</label>
                <textarea
                  rows={2}
                  className="w-full p-2.5 rounded-lg border bg-background text-xs resize-none"
                  placeholder="General plant machinery and standby power units"
                  value={categoryForm.description}
                  onChange={(e) =>
                    setCategoryForm({ ...categoryForm, description: e.target.value })
                  }
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="catActive"
                  className="h-4 w-4 rounded border-primary accent-primary"
                  checked={categoryForm.isActive}
                  onChange={(e) =>
                    setCategoryForm({ ...categoryForm, isActive: e.target.checked })
                  }
                />
                <label htmlFor="catActive" className="text-xs font-medium text-foreground cursor-pointer">
                  Active for new asset creation
                </label>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCategoryModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  {editingCategory ? 'Update Category' : 'Create Category'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── User Creation Modal ────────────────────────────────────────────── */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-base font-bold text-foreground">Add New System User</h2>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                onClick={() => setIsUserModalOpen(false)}
              >
                ✕
              </Button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Full Name</label>
                <Input
                  required
                  className="h-9 text-xs"
                  placeholder="e.g. Tariqul Islam"
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Work Email</label>
                <Input
                  required
                  type="email"
                  className="h-9 text-xs"
                  placeholder="e.g. auditor@assets.com"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Temporary Password (min 6 chars)
                </label>
                <Input
                  required
                  type="password"
                  className="h-9 text-xs"
                  placeholder="••••••••"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Security Role</label>
                <select
                  className="w-full h-9 px-3 rounded-lg border bg-background text-xs font-medium"
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
                >
                  <option value="AUDITOR">Auditor (Floor scan verification &amp; discrepancy logging)</option>
                  <option value="ASSET_MANAGER">Asset Manager (Audit plans, approvals &amp; reports)</option>
                  <option value="TECHNICIAN">Technician (Maintenance &amp; repairs)</option>
                  <option value="EMPLOYEE">Employee (Asset custodian)</option>
                  <option value="SUPER_ADMIN">Super Admin (System configuration)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Phone Number (Optional)</label>
                <Input
                  className="h-9 text-xs"
                  placeholder="+880 1700-000000"
                  value={userForm.phone}
                  onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsUserModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Register User
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

