'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Lock,
  Mail,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Shield,
  ArrowRight,
  Boxes,
  Building2,
  Globe,
  Settings2,
  Activity,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  COMPANY_API_PRESETS,
  DEFAULT_COMPANY_PRESET,
  normalizeApiUrl,
  getCompanyPreset,
} from '@/config/companies';
import { clearAllLocalOfflineData, getUnsyncedQueueCount } from '@/lib/offline/db';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const signedOut = searchParams.get('signedOut') === 'true';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(
    signedOut ? 'You have been successfully signed out.' : null,
  );

  // Multi-Company Environment Switcher State
  const [selectedCode, setSelectedCode] = useState<string>(DEFAULT_COMPANY_PRESET.code);
  const [serverUrl, setServerUrl] = useState<string>(DEFAULT_COMPANY_PRESET.url);
  const [customUrlInput, setCustomUrlInput] = useState<string>('');
  const [showCustomInput, setShowCustomInput] = useState<boolean>(false);

  // Ping / Reachability status
  const [pingStatus, setPingStatus] = useState<'idle' | 'testing' | 'connected' | 'error'>('idle');
  const [pingLatency, setPingLatency] = useState<number | null>(null);
  const [pingError, setPingError] = useState<string | null>(null);

  // Outbox protection dialog
  const [unsyncedCount, setUnsyncedCount] = useState<number>(0);
  const [showUnsyncedDialog, setShowUnsyncedDialog] = useState<boolean>(false);
  const [pendingTargetPreset, setPendingTargetPreset] = useState<{
    code: string;
    url: string;
  } | null>(null);

  const isDev =
    process.env.NODE_ENV === 'development' ||
    process.env.NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS === 'true';

  // Helper to read cookie value in browser
  const getCookie = (name: string): string | null => {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
    return match ? decodeURIComponent(match[3]) : null;
  };

  // 1. Initialize Company Preset and Outbox Count from storage / cookies
  useEffect(() => {
    try {
      const storedCode = localStorage.getItem('company_code') || getCookie('company_code');
      const storedUrl = localStorage.getItem('api_backend_url') || getCookie('api_backend_url');

      if (storedCode === 'CUSTOM' && storedUrl) {
        setSelectedCode('CUSTOM');
        setServerUrl(storedUrl);
        setCustomUrlInput(storedUrl);
        setShowCustomInput(true);
      } else if (storedCode) {
        const matched = getCompanyPreset(storedCode, storedCode);
        if (matched) {
          setSelectedCode(matched.code);
          setServerUrl(matched.url);
        } else if (storedUrl) {
          setSelectedCode('CUSTOM');
          setServerUrl(storedUrl);
          setCustomUrlInput(storedUrl);
          setShowCustomInput(true);
        }
      } else if (storedUrl) {
        const matched = getCompanyPreset(storedUrl);
        if (matched) {
          setSelectedCode(matched.code);
          setServerUrl(matched.url);
        } else {
          setSelectedCode('CUSTOM');
          setServerUrl(storedUrl);
          setCustomUrlInput(storedUrl);
          setShowCustomInput(true);
        }
      }
    } catch {}

    // Check unsynced offline records count
    getUnsyncedQueueCount()
      .then((count) => setUnsyncedCount(count))
      .catch(() => setUnsyncedCount(0));
  }, []);

  // 2. Clear credentials and local data when switching company
  const applyCompanySwitch = async (
    targetCode: string,
    targetUrl: string,
    options?: { preserveQueue?: boolean },
  ) => {
    const normalizedUrl = normalizeApiUrl(targetUrl);

    // Clear session cookies and localStorage tokens from previous company
    document.cookie = 'auth_token=; path=/; max-age=0; SameSite=Lax;';
    document.cookie = 'accessToken=; path=/; max-age=0; SameSite=Lax;';
    localStorage.removeItem('token');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    sessionStorage.clear();

    // Clear cached offline IndexedDB data (assets/plans/locations from previous company)
    await clearAllLocalOfflineData({ preserveQueue: options?.preserveQueue ?? false });

    // Store new company code & API endpoint
    document.cookie = `api_backend_url=${normalizedUrl}; path=/; max-age=31536000; SameSite=Lax;`;
    document.cookie = `company_code=${targetCode}; path=/; max-age=31536000; SameSite=Lax;`;
    localStorage.setItem('api_backend_url', normalizedUrl);
    localStorage.setItem('company_code', targetCode);

    // Broadcast instant update to TopNavbar and other tabs
    window.dispatchEvent(new CustomEvent('company_code_changed', { detail: targetCode }));

    // Update local state
    setSelectedCode(targetCode);
    setServerUrl(normalizedUrl);
    setPingStatus('idle');
    setPingLatency(null);
    setPingError(null);
    setError(null);
    setSuccessMsg(`Switched to ${targetCode} environment.`);

    // Refresh unsynced count
    const remaining = await getUnsyncedQueueCount();
    setUnsyncedCount(remaining);
  };

  // 3. User requests company switch with outbox check
  const handleSelectCompany = async (targetCode: string, targetUrl: string) => {
    // If selecting custom, toggle custom input panel
    if (targetCode === 'CUSTOM') {
      setShowCustomInput(true);
      if (selectedCode === 'CUSTOM') return;
    } else {
      setShowCustomInput(false);
    }

    // If clicking already active company, do nothing
    if (selectedCode === targetCode && !showCustomInput) {
      return;
    }

    // Check if unsynced scans exist in local outbox
    const pending = await getUnsyncedQueueCount();
    setUnsyncedCount(pending);

    if (pending > 0 && selectedCode !== targetCode) {
      setPendingTargetPreset({ code: targetCode, url: targetUrl });
      setShowUnsyncedDialog(true);
      return;
    }

    await applyCompanySwitch(targetCode, targetUrl);
  };

  const handleApplyCustomUrl = async () => {
    if (!customUrlInput.trim()) {
      setError('Please enter a valid server URL');
      return;
    }
    const cleanUrl = normalizeApiUrl(customUrlInput);
    await applyCompanySwitch('CUSTOM', cleanUrl);
  };

  // 4. Test API Reachability / Latency
  const handlePingServer = async (targetUrlToTest?: string) => {
    const target = targetUrlToTest || serverUrl;
    setPingStatus('testing');
    setPingError(null);
    const start = performance.now();

    try {
      // Send health check request through Next.js proxy with dynamic backend header
      const res = await fetch('/api/health', {
        method: 'GET',
        headers: {
          'x-backend-url': normalizeApiUrl(target),
          'x-company-code': selectedCode,
        },
        cache: 'no-store',
      });

      const elapsed = Math.round(performance.now() - start);

      if (res.ok) {
        setPingStatus('connected');
        setPingLatency(elapsed);
      } else {
        setPingStatus('error');
        setPingError(`HTTP ${res.status}`);
      }
    } catch (err: any) {
      setPingStatus('error');
      setPingError(err?.message || 'Server unreachable');
    }
  };

  const fillAdminCredentials = () => {
    setEmail('admin@assetmgmt.com');
    setPassword('Password123!');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide both email and password');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      // Ensure backend URL and company code cookies are fresh
      const targetApiUrl = normalizeApiUrl(serverUrl);
      document.cookie = `api_backend_url=${targetApiUrl}; path=/; max-age=31536000; SameSite=Lax;`;
      document.cookie = `company_code=${selectedCode}; path=/; max-age=31536000; SameSite=Lax;`;
      localStorage.setItem('api_backend_url', targetApiUrl);
      localStorage.setItem('company_code', selectedCode);

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-backend-url': targetApiUrl,
          'x-company-code': selectedCode,
        },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(
          json?.message || json?.error || `Invalid credentials (${res.status})`,
        );
      }

      const data = json?.data || json;
      if (data?.accessToken) {
        localStorage.setItem('token', data.accessToken);
        localStorage.setItem('accessToken', data.accessToken);
        if (data.refreshToken) {
          localStorage.setItem('refreshToken', data.refreshToken);
        }
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }

        // Set auth cookie for Next.js middleware and SSR requests
        document.cookie = `auth_token=${data.accessToken}; path=/; max-age=604800; SameSite=Lax;`;

        // Broadcast company code update
        window.dispatchEvent(new CustomEvent('company_code_changed', { detail: selectedCode }));

        setSuccessMsg(`Authentication successful for ${selectedCode}! Redirecting...`);
        const redirectUrl = searchParams.get('redirect') || '/';
        setTimeout(() => {
          router.push(redirectUrl);
          router.refresh();
        }, 350);
      } else {
        throw new Error('Authentication token missing from response');
      }
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const currentPreset = COMPANY_API_PRESETS.find((p) => p.code === selectedCode);

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <Card className="w-full max-w-lg border bg-card shadow-xl overflow-hidden">
        {/* Header Banner */}
        <CardHeader className="text-center space-y-2 pb-4 bg-muted/20 border-b">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-1 text-primary shadow-xs">
            <Boxes className="w-6 h-6" />
          </div>
          <CardTitle className="text-xl font-bold tracking-tight">
            Sign In to Assets Management
          </CardTitle>
          <CardDescription className="text-xs">
            Enterprise multi-company assets inventory and audit controls
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-4">
          {/* Company Environment Switcher Section */}
          <div className="rounded-xl border bg-muted/30 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-primary" />
                <span>Target Company</span>
              </span>
              {unsyncedCount > 0 && (
                <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-500/30 gap-1">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  <span>{unsyncedCount} unsynced in local outbox</span>
                </Badge>
              )}
            </div>

            {/* Company Selection Pills */}
            <div className="grid grid-cols-4 gap-1.5">
              {COMPANY_API_PRESETS.map((preset) => {
                const isActive = selectedCode === preset.code;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectCompany(preset.code, preset.url)}
                    className={`py-2 px-1 text-center rounded-lg text-xs font-semibold transition-all border ${
                      isActive
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs ring-2 ring-primary/20 scale-[1.02]'
                        : 'bg-background hover:bg-muted text-muted-foreground hover:text-foreground border-border/70'
                    }`}
                  >
                    <div className="truncate">{preset.code}</div>
                  </button>
                );
              })}

              {/* Custom Endpoint Option */}
              <button
                type="button"
                onClick={() => handleSelectCompany('CUSTOM', customUrlInput || serverUrl)}
                className={`py-2 px-1 text-center rounded-lg text-xs font-semibold transition-all border flex items-center justify-center gap-1 ${
                  selectedCode === 'CUSTOM'
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs ring-2 ring-primary/20 scale-[1.02]'
                    : 'bg-background hover:bg-muted text-muted-foreground hover:text-foreground border-border/70'
                }`}
              >
                <Settings2 className="w-3 h-3 shrink-0" />
                <span className="truncate">Custom</span>
              </button>
            </div>

            {/* Custom URL Expandable Input */}
            {showCustomInput && (
              <div className="pt-2 border-t space-y-1.5">
                <label className="text-[11px] font-medium text-foreground flex items-center gap-1">
                  <Globe className="w-3 h-3 text-muted-foreground" />
                  <span>Custom Server API URL</span>
                </label>
                <div className="flex gap-1.5">
                  <Input
                    type="url"
                    className="h-8 text-xs font-mono"
                    placeholder="http://192.168.65.50:3001/api/v1"
                    value={customUrlInput}
                    onChange={(e) => setCustomUrlInput(e.target.value)}
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 text-xs px-3 shrink-0"
                    onClick={handleApplyCustomUrl}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            )}

            {/* Active Company & Server Status Footer */}
            <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/50 text-muted-foreground">
              <div className="flex items-center gap-1.5 truncate max-w-[280px]">
                <span className="font-semibold text-foreground truncate">
                  {currentPreset ? currentPreset.name : 'Custom Server'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {pingStatus === 'testing' && (
                  <Badge variant="outline" className="text-[10px] gap-1 py-0 h-5 text-muted-foreground animate-pulse">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    <span>Pinging...</span>
                  </Badge>
                )}
                {pingStatus === 'connected' && (
                  <Badge variant="outline" className="text-[10px] gap-1 py-0 h-5 bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Online ({pingLatency}ms)</span>
                  </Badge>
                )}
                {pingStatus === 'error' && (
                  <Badge variant="outline" className="text-[10px] gap-1 py-0 h-5 bg-destructive/10 text-destructive border-destructive/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-destructive" />
                    <span>{pingError || 'Unreachable'}</span>
                  </Badge>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePingServer()}
                  disabled={pingStatus === 'testing'}
                  className="h-5 text-[10px] px-1.5 text-muted-foreground hover:text-foreground gap-1"
                  title="Test server reachability and latency"
                >
                  <Activity className="w-2.5 h-2.5" />
                  <span>Ping</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Alert Messages */}
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Work Email</span>
              </label>
              <Input
                type="email"
                required
                className="h-10 text-xs"
                placeholder="system.admin@assets.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Password</span>
              </label>
              <Input
                type="password"
                required
                className="h-10 text-xs"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-10 gap-2 shadow-sm font-semibold text-xs mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing In to {selectedCode}...</span>
                </>
              ) : (
                <>
                  <span>Sign In ({selectedCode})</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>

          {/* Quick Demo Fill Helper — Visible only in Development */}
          {isDev && (
            <div className="pt-2 border-t text-center space-y-2">
              <span className="text-[11px] text-muted-foreground block">
                Quick access demo credentials:
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={fillAdminCredentials}
                className="w-full text-xs h-9 gap-1.5 font-medium border-dashed text-muted-foreground hover:text-foreground"
              >
                <Shield className="w-3.5 h-3.5 text-primary" />
                <span>Autofill Super Admin (admin@assetmgmt.com)</span>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Outbox Protection Dialog */}
      <Dialog open={showUnsyncedDialog} onOpenChange={setShowUnsyncedDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mb-1">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <DialogTitle className="text-base font-bold">
              Unsynced Offline Scans Found
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground space-y-2">
              <span className="block font-medium text-foreground">
                You have {unsyncedCount} unsynced offline scans in local storage from your current company session.
              </span>
              <span className="block">
                Switching to <strong className="text-foreground">{pendingTargetPreset?.code}</strong> without syncing may cause data mismatch or orphan your scanned records.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => {
                setShowUnsyncedDialog(false);
                setPendingTargetPreset(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs text-amber-600 border-amber-500/30 hover:bg-amber-500/10"
              onClick={async () => {
                if (pendingTargetPreset) {
                  await applyCompanySwitch(pendingTargetPreset.code, pendingTargetPreset.url, {
                    preserveQueue: true,
                  });
                }
                setShowUnsyncedDialog(false);
                setPendingTargetPreset(null);
              }}
            >
              Keep Outbox & Switch
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="text-xs"
              onClick={async () => {
                if (pendingTargetPreset) {
                  await applyCompanySwitch(pendingTargetPreset.code, pendingTargetPreset.url, {
                    preserveQueue: false,
                  });
                }
                setShowUnsyncedDialog(false);
                setPendingTargetPreset(null);
              }}
            >
              Discard & Switch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[85vh] flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
