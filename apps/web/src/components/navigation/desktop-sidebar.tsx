'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Boxes,
  QrCode,
  Network,
  ClipboardCheck,
  Wrench,
  ArrowLeftRight,
  Truck,
  BarChart3,
  Settings,
  BookOpen,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function DesktopSidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    try {
      const saved = localStorage.getItem('sidebar_collapsed');
      if (saved !== null) {
        setIsCollapsed(saved === 'true');
      }
    } catch (e) {
      // LocalStorage access handling
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent shortcut if typing in an input or textarea
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sidebar_collapsed', String(next));
      } catch (e) {
        // LocalStorage access handling
      }
      return next;
    });
  };

  const links = [
    { label: 'Dashboard', href: '/', icon: LayoutDashboard },
    { label: 'Assets Inventory', href: '/assets', icon: Boxes },
    { label: 'Quick Scan / Audit', href: '/scan', icon: QrCode },
    { label: 'Locations Hierarchy', href: '/locations', icon: Network },
    { label: 'Audits & Verification', href: '/audits', icon: ClipboardCheck },
    { label: 'Transfers', href: '/transfers', icon: ArrowLeftRight },
    { label: 'Maintenance', href: '/maintenance', icon: Wrench },
    { label: 'Vendors', href: '/vendors', icon: Truck },
    { label: 'Reports', href: '/reports', icon: BarChart3 },
    { label: 'Workflow Guide', href: '/workflow', icon: BookOpen },
    { label: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col border-r bg-card min-h-[calc(100vh-4rem)] transition-all duration-300 ease-in-out shrink-0 select-none relative',
        isCollapsed ? 'w-18 p-2.5' : 'w-64 p-4',
      )}
    >
      {/* Sidebar Header & Toggle */}
      <div className={cn('flex items-center pb-3 border-b mb-3', isCollapsed ? 'justify-center' : 'justify-between px-2')}>
        {!isCollapsed && (
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            Navigation
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0 rounded-lg"
          title={isCollapsed ? 'Expand Sidebar (Ctrl + B)' : 'Collapse Sidebar'}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="w-4 h-4 text-primary" />
          ) : (
            <PanelLeftClose className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Navigation Links List */}
      <nav className="space-y-1 flex-1">
        {links.map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              title={link.label}
              className={cn(
                'flex items-center rounded-xl text-sm font-medium transition-all group relative',
                isCollapsed
                  ? 'justify-center h-10 w-10 mx-auto'
                  : 'space-x-3 px-3 py-2.5',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm font-semibold'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <Icon
                className={cn(
                  'w-4 h-4 shrink-0 transition-transform group-hover:scale-110',
                  isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground',
                )}
              />
              {!isCollapsed && (
                <span className="truncate">{link.label}</span>
              )}
              {/* Floating Tooltip indicator on hover when collapsed */}
              {isCollapsed && (
                <div className="absolute left-full ml-2.5 px-2.5 py-1 bg-popover text-popover-foreground text-xs font-medium rounded-md shadow-md border opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                  {link.label}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Collapse Toggle Footer */}
      <div className="mt-auto pt-3 border-t">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className={cn(
            'w-full text-xs text-muted-foreground hover:text-foreground h-9 gap-2 rounded-lg',
            isCollapsed ? 'px-0 justify-center' : 'justify-start px-2',
          )}
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse Sidebar</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}

