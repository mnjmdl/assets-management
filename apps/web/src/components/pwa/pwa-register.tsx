'use client';

import { useEffect, useState } from 'react';
import { Download, X, Smartphone, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

export function PwaRegister() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Check if already running as standalone PWA
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Check if previously dismissed in this session
    try {
      if (sessionStorage.getItem('pwa_prompt_dismissed') === 'true') {
        setIsDismissed(true);
      }
    } catch {}

    // Register Service Worker
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register(`${basePath}/sw.js`, { scope: `${basePath}/` || '/' })
          .then((registration) => {
            console.log('✅ PWA ServiceWorker active with scope:', registration.scope);
          })
          .catch((error) => {
            console.warn('⚠️ PWA ServiceWorker registration failed:', error);
          });
      });
    }

    // Capture the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
      (window as any).__pwaInstallPrompt = e;
    };

    // Capture appinstalled event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      (window as any).__pwaInstallPrompt = null;
      console.log('🎉 PWA successfully installed to device home screen!');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    const promptEvent = deferredPrompt || (window as any).__pwaInstallPrompt;
    if (!promptEvent) {
      // Fallback instructions for iOS Safari
      alert(
        'To install on iPhone/iPad: Tap the Share button in Safari, then select "Add to Home Screen".'
      );
      return;
    }

    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    } catch (err) {
      console.warn('Install prompt error:', err);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem('pwa_prompt_dismissed', 'true');
    } catch {}
  };

  // Do not render banner if already installed, dismissed, or no install prompt available
  if (isInstalled || isDismissed || !deferredPrompt) {
    return null;
  }

  return (
    <aside
      role="banner"
      aria-label="Install web application"
      className="fixed bottom-20 md:bottom-6 right-4 left-4 md:left-auto md:w-96 z-50 p-3.5 rounded-2xl bg-popover/95 backdrop-blur-md border border-primary/30 shadow-2xl animate-in slide-in-from-bottom-5 duration-300 print:hidden"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
          <Smartphone className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-foreground">Install Mobile App</h4>
            <button
              onClick={handleDismiss}
              className="text-muted-foreground hover:text-foreground p-0.5 rounded-md"
              title="Dismiss prompt"
              aria-label="Dismiss prompt"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Add Assets Management to your home screen for offline access and full screen camera scanning.
          </p>

          <div className="pt-1.5 flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleInstallClick}
              className="h-7 px-3 text-xs font-bold gap-1.5 shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install PWA</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              className="h-7 px-2 text-xs text-muted-foreground"
            >
              Later
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}

