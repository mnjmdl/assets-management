'use client';

import { useState, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  RotateCw,
  DownloadCloud,
  CheckCircle2,
  Clock,
  AlertTriangle,
  HardDrive,
  RefreshCw,
  X,
} from 'lucide-react';
import { syncManager, SyncState } from '@/lib/offline/sync-manager';
import { SyncQueueItem } from '@/lib/offline/db';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

export function OfflineSyncBadge({ className }: { className?: string }) {
  const [state, setState] = useState<SyncState>({
    isOnline: true,
    isSyncing: false,
    pendingCount: 0,
    lastSyncedAt: null,
    assetsCount: 0,
    locationsCount: 0,
    plansCount: 0,
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [queueItems, setQueueItems] = useState<SyncQueueItem[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = syncManager.subscribe((newState) => {
      setState(newState);
    });

    return () => unsubscribe();
  }, []);

  const openSyncDialog = async () => {
    setIsModalOpen(true);
    try {
      const items = await syncManager.getPendingItems();
      setQueueItems(items);
      await syncManager.refreshStats();
    } catch {}
  };

  const handleManualSync = async () => {
    try {
      await syncManager.flushQueue();
      const items = await syncManager.getPendingItems();
      setQueueItems(items);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDownloadFacility = async () => {
    setIsDownloading(true);
    setDownloadProgress('Starting offline cache download...');
    try {
      await syncManager.downloadFacilityData((msg) => {
        setDownloadProgress(msg);
      });
      setTimeout(() => {
        setIsDownloading(false);
        setDownloadProgress(null);
      }, 1500);
    } catch (e: any) {
      setDownloadProgress(`Error: ${e.message}`);
      setTimeout(() => setIsDownloading(false), 3000);
    }
  };

  return (
    <>
      <button
        onClick={openSyncDialog}
        className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 select-none ${
          state.isSyncing
            ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30'
            : !state.isOnline
            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/40 animate-pulse'
            : state.pendingCount > 0
            ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40'
            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
        } ${className || ''}`}
        title="Offline Database & Sync Status (Click to manage)"
      >
        {state.isSyncing ? (
          <>
            <RotateCw className="w-3.5 h-3.5 animate-spin" />
            <span>Syncing ({state.pendingCount})</span>
          </>
        ) : !state.isOnline ? (
          <>
            <WifiOff className="w-3.5 h-3.5" />
            <span>Offline {state.pendingCount > 0 ? `(${state.pendingCount})` : ''}</span>
          </>
        ) : state.pendingCount > 0 ? (
          <>
            <RefreshCw className="w-3.5 h-3.5 animate-pulse text-blue-600" />
            <span>Sync Queue ({state.pendingCount})</span>
          </>
        ) : (
          <>
            <Wifi className="w-3.5 h-3.5" />
            <span>Online</span>
          </>
        )}
      </button>

      {/* Offline Database & Sync Management Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md w-full p-5 space-y-4 rounded-2xl">
          <DialogHeader className="space-y-1">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-primary" />
                <span>Offline Database &amp; Sync</span>
              </DialogTitle>
              <Badge
                variant="outline"
                className={`text-[10px] font-bold px-2 py-0.5 ${
                  state.isOnline
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
                    : 'border-amber-500/40 bg-amber-500/10 text-amber-600'
                }`}
              >
                {state.isOnline ? 'Online Connected' : 'Offline Mode'}
              </Badge>
            </div>
            <DialogDescription className="text-xs text-muted-foreground">
              Physical field audits, scans, and condition changes are stored in client IndexedDB and automatically synchronized when reconnected.
            </DialogDescription>
          </DialogHeader>

          {/* Local Storage Stats */}
          <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-muted/30 border text-center">
            <div>
              <span className="block text-xs font-bold text-foreground">
                {(state.assetsCount || 0).toLocaleString()}
              </span>
              <span className="text-[10px] text-muted-foreground">Assets Cached</span>
            </div>
            <div>
              <span className="block text-xs font-bold text-foreground">
                {(state.locationsCount || 0).toLocaleString()}
              </span>
              <span className="text-[10px] text-muted-foreground">Locations</span>
            </div>
            <div>
              <span className="block text-xs font-bold text-foreground">
                {(state.pendingCount || 0).toLocaleString()}
              </span>
              <span className="text-[10px] text-muted-foreground">Pending Sync</span>
            </div>
          </div>

          {/* Pre-cache Facility Data button */}
          <div className="p-3 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-0.5">
                <h5 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <DownloadCloud className="w-4 h-4 text-primary" />
                  <span>Pre-cache Warehouse Data</span>
                </h5>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Download all 13,000+ asset tags and 18 facility locations for offline dead-zone scanning.
                </p>
              </div>

              <Button
                size="sm"
                disabled={!state.isOnline || isDownloading}
                onClick={handleDownloadFacility}
                className="h-8 px-2.5 text-xs font-semibold shrink-0 gap-1.5"
              >
                {isDownloading ? (
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <DownloadCloud className="w-3.5 h-3.5" />
                )}
                <span>{isDownloading ? 'Syncing...' : 'Sync All'}</span>
              </Button>
            </div>

            {downloadProgress && (
              <div className="p-2 rounded-lg bg-background/80 border border-primary/20 text-[11px] font-mono text-primary animate-in fade-in flex items-center gap-2">
                <RotateCw className="w-3 h-3 animate-spin shrink-0 text-primary" />
                <span className="truncate">{downloadProgress}</span>
              </div>
            )}
          </div>

          {/* Pending Sync Queue Items List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-primary" />
                <span>Outbox Queue ({queueItems.length})</span>
              </span>

              {queueItems.length > 0 && state.isOnline && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={state.isSyncing}
                  onClick={handleManualSync}
                  className="h-7 px-2 text-xs font-semibold gap-1"
                >
                  <RotateCw className={`w-3 h-3 ${state.isSyncing ? 'animate-spin' : ''}`} />
                  <span>Sync Now</span>
                </Button>
              )}
            </div>

            {queueItems.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed text-center bg-muted/10 space-y-1">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
                <p className="text-xs font-medium text-foreground">All Data Synchronized</p>
                <p className="text-[10px] text-muted-foreground">
                  No pending offline commits. Database is fully up to date.
                </p>
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 no-scrollbar">
                {queueItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-xl border bg-card flex items-start justify-between gap-2 text-xs"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <span className="font-semibold text-foreground block truncate">
                        {item.title}
                      </span>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        <span>{new Date(item.createdAt).toLocaleTimeString()}</span>
                        <span>•</span>
                        <span className="font-mono">{item.endpoint}</span>
                      </div>
                      {item.error && (
                        <p className="text-[10px] text-destructive flex items-center gap-1 pt-0.5">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <span className="truncate">{item.error}</span>
                        </p>
                      )}
                    </div>

                    <Badge
                      variant="outline"
                      className={`text-[9px] px-1.5 py-0 uppercase shrink-0 font-bold ${
                        item.status === 'FAILED'
                          ? 'border-destructive/40 text-destructive bg-destructive/10'
                          : 'border-sky-500/40 text-sky-600 bg-sky-500/10'
                      }`}
                    >
                      {item.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2 border-t flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(false)}
              className="h-8 text-xs font-medium"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

