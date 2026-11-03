'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Boxes,
  QrCode,
  Network,
  ClipboardCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function MobileBottomNav() {
  const pathname = usePathname();

  const navItems = [
    {
      label: 'Home',
      href: '/',
      icon: LayoutDashboard,
    },
    {
      label: 'Assets',
      href: '/assets',
      icon: Boxes,
    },
    {
      label: 'Scan',
      href: '/scan',
      icon: QrCode,
      isPrimaryAction: true,
    },
    {
      label: 'Locations',
      href: '/locations',
      icon: Network,
    },
    {
      label: 'Audits',
      href: '/audits',
      icon: ClipboardCheck,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background/95 backdrop-blur-md border-t border-border shadow-lg safe-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          if (item.isPrimaryAction) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative -top-5 flex flex-col items-center group"
                aria-label={item.label}
              >
                <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-background transition-transform active:scale-95 group-hover:scale-105">
                  <Icon className="w-7 h-7" />
                </div>
                <span className="text-[10px] font-semibold tracking-tight text-primary mt-1">
                  {item.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center w-16 h-full py-1 text-xs transition-colors active:scale-95',
                isActive
                  ? 'text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className={cn('w-5 h-5 mb-1', isActive && 'stroke-[2.5]')} />
              <span className="text-[11px] leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

