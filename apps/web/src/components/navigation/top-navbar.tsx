'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Bell,
  Search,
  Wifi,
  Settings,
  ClipboardCheck,
  Boxes,
  LogOut,
  User,
  Shield,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { OfflineSyncBadge } from '@/components/offline/offline-sync-badge';

interface CurrentUser {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
}

export function TopNavbar() {
  const router = useRouter();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser>({
    name: 'System Admin',
    email: 'system.admin@assets.com',
    role: 'SUPER_ADMIN',
  });
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.email) {
          setCurrentUser(parsed);
        }
      }
    } catch {}

    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        }).catch(() => {});
      }
    } catch {}

    // Clear cookies & client-side session tokens
    document.cookie = 'auth_token=; path=/; max-age=0; SameSite=Lax;';
    document.cookie = 'accessToken=; path=/; max-age=0; SameSite=Lax;';
    localStorage.removeItem('token');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    sessionStorage.clear();

    setIsProfileOpen(false);
    router.push('/login?signedOut=true');
    router.refresh();
  };

  const getInitials = (name?: string) => {
    if (!name) return 'SA';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur safe-top">
      <div className="flex h-14 sm:h-16 items-center justify-between px-4 sm:px-6 max-w-7xl mx-auto">
        {/* Brand */}
        <Link href="/" className="flex items-center space-x-2.5 group">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl overflow-hidden shadow-sm shrink-0 border border-primary/20 group-hover:scale-105 transition-transform bg-primary/10">
            <img
              src="/icons/icon-192x192.png"
              alt="Assets Management"
              className="w-full h-full object-cover"
            />
          </div>
          <span className="font-bold text-sm sm:text-base leading-tight tracking-tight group-hover:text-primary transition-colors">
            Assets Management
          </span>
        </Link>

        {/* Right Actions */}
        <div className="flex items-center space-x-2">
          {/* Real-time Offline & Database Sync Status Badge */}
          <OfflineSyncBadge />

          <Link href="/assets" className="hidden sm:inline-flex">
            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground">
              <Search className="w-4 h-4" />
              <span className="sr-only">Search</span>
            </Button>
          </Link>

          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground relative">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive" />
            <span className="sr-only">Notifications</span>
          </Button>

          {/* User Profile Menu with Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsProfileOpen((prev) => !prev)}
              className="flex items-center gap-1.5 p-1 rounded-full hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
              title="User Profile Menu"
              aria-expanded={isProfileOpen}
            >
              <div className="w-8 h-8 rounded-full bg-secondary hover:bg-accent hover:border-primary/40 text-secondary-foreground font-semibold flex items-center justify-center text-xs border transition-colors cursor-pointer select-none">
                {getInitials(currentUser.name)}
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Profile Dropdown Menu */}
            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl border bg-popover p-2 text-popover-foreground shadow-xl animate-in fade-in zoom-in-95 z-50">
                {/* User Header Details */}
                <div className="p-2.5 border-b mb-1">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm border border-primary/20 shrink-0">
                      {getInitials(currentUser.name)}
                    </div>
                    <div className="overflow-hidden">
                      <span className="font-semibold text-xs text-foreground block truncate">
                        {currentUser.name || 'System Admin'}
                      </span>
                      <span className="text-[11px] text-muted-foreground block truncate">
                        {currentUser.email || 'system.admin@assets.com'}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-1">
                    <Badge variant="outline" className="text-[9px] py-0 px-1.5 font-medium border-primary/30 text-primary bg-primary/5">
                      <Shield className="w-2.5 h-2.5 mr-1 inline" />
                      {currentUser.role || 'SUPER_ADMIN'}
                    </Badge>
                  </div>
                </div>

                {/* Navigation Items */}
                <div className="space-y-0.5">
                  <Link
                    href="/settings?tab=users"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl text-foreground hover:bg-accent transition-colors"
                  >
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span>My Profile &amp; Users</span>
                  </Link>

                  <Link
                    href="/settings"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl text-foreground hover:bg-accent transition-colors"
                  >
                    <Settings className="w-4 h-4 text-muted-foreground" />
                    <span>Account &amp; System Settings</span>
                  </Link>

                  <Link
                    href="/audits"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl text-foreground hover:bg-accent transition-colors"
                  >
                    <ClipboardCheck className="w-4 h-4 text-muted-foreground" />
                    <span>Audit Sessions &amp; History</span>
                  </Link>

                  <Link
                    href="/assets"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl text-foreground hover:bg-accent transition-colors"
                  >
                    <Boxes className="w-4 h-4 text-muted-foreground" />
                    <span>Assets Inventory</span>
                  </Link>
                </div>

                {/* Sign Out Action */}
                <div className="border-t mt-1 pt-1">
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl text-destructive hover:bg-destructive/10 transition-colors cursor-pointer text-left"
                  >
                    <LogOut className="w-4 h-4 shrink-0" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
