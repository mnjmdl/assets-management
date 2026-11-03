'use client';

import { usePathname } from 'next/navigation';
import { TopNavbar } from '@/components/navigation/top-navbar';
import { MobileBottomNav } from '@/components/navigation/mobile-bottom-nav';
import { DesktopSidebar } from '@/components/navigation/desktop-sidebar';
import { PwaRegister } from '@/components/pwa/pwa-register';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';
  const isScanPage = pathname === '/scan';

  if (isLoginPage) {
    return (
      <main className="min-h-screen w-full flex flex-col justify-center items-center p-4">
        {children}
        <PwaRegister />
      </main>
    );
  }

  return (
    <>
      {/* PWA Service Worker & Install Prompt Banner */}
      <PwaRegister />

      {/* Top Navbar (hidden on mobile when scanning so camera sticks to top safe area) */}
      <div className={`print:hidden ${isScanPage ? 'hidden md:block' : ''}`}>
        <TopNavbar />
      </div>

      {/* Main Body Container */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto print:max-w-none print:m-0 print:p-0 print:w-full print:block">
        {/* Desktop Sidebar (hidden on mobile and print) */}
        <div className="print:hidden">
          <DesktopSidebar />
        </div>

        {/* Main View Area */}
        <main
          className={`flex-1 flex flex-col ${
            isScanPage ? 'p-0 md:p-6 lg:p-8' : 'p-3 sm:p-6 lg:p-8'
          } pb-20 md:pb-8 w-full min-h-[calc(100dvh-3.5rem)] overflow-x-clip print:p-0 print:m-0 print:w-full print:overflow-visible print:block`}
        >
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (hidden on desktop and print) */}
      <div className="print:hidden">
        <MobileBottomNav />
      </div>
    </>
  );
}

