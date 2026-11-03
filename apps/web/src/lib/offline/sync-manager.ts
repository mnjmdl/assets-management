/**
 * Enterprise PWA Offline Synchronization Manager
 * Coordinates IndexedDB caching, offline tag lookups, and outbox queue flushing.
 */

import {
  openOfflineDB,
  putItems,
  getItem,
  getAllItems,
  deleteItem,
  getStoreCount,
  findOfflineAsset,
  OfflineAsset,
  OfflineLocation,
  OfflineAuditPlan,
  OfflineAuditSession,
  SyncQueueItem,
} from './db';

type SyncListener = (state: SyncState) => void;

export interface SyncState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt: string | null;
  assetsCount: number;
  locationsCount: number;
  plansCount: number;
}

class SyncManager {
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private isSyncing: boolean = false;
  private lastSyncedAt: string | null = null;
  private listeners: Set<SyncListener> = new Set();
  private syncTimer: any = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        this.notifyListeners();
        this.flushQueue();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        this.notifyListeners();
      });

      // Periodic queue check every 30 seconds when online
      this.syncTimer = setInterval(() => {
        if (this.isOnline && !this.isSyncing) {
          this.flushQueue();
        }
      }, 30000);

      // Auto-precache on initial boot
      setTimeout(() => {
        this.refreshStats();
      }, 2000);
    }
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    this.getState().then((state) => listener(state));
    return () => {
      this.listeners.delete(listener);
    };
  }

  private async notifyListeners() {
    const state = await this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(state);
      } catch (err) {
        console.warn('Sync listener error:', err);
      }
    });
  }

  public async getState(): Promise<SyncState> {
    let pendingCount = 0;
    let assetsCount = 0;
    let locationsCount = 0;
    let plansCount = 0;

    try {
      pendingCount = await getStoreCount('sync_queue');
      assetsCount = await getStoreCount('assets');
      locationsCount = await getStoreCount('locations');
      plansCount = await getStoreCount('audit_plans');
    } catch {}

    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      pendingCount,
      lastSyncedAt: this.lastSyncedAt,
      assetsCount,
      locationsCount,
      plansCount,
    };
  }

  public async refreshStats() {
    await this.notifyListeners();
  }

  // ── 1. Inbound Cache Sync: Pre-cache Facility Data ────────────────────────
  public async downloadFacilityData(onProgress?: (msg: string) => void): Promise<{
    assetsCount: number;
    locationsCount: number;
    plansCount: number;
  }> {
    if (!this.isOnline) {
      throw new Error('Cannot download offline cache while offline. Reconnect to internet.');
    }

    try {
      // 1. Locations Hierarchy
      onProgress?.('Fetching locations hierarchy (18 stations)...');
      const locRes = await fetch('/api/locations?limit=500');
      let locations: OfflineLocation[] = [];
      if (locRes.ok) {
        const json = await locRes.json();
        locations = Array.isArray(json) ? json : json.data || [];
        if (locations.length > 0) {
          await putItems('locations', locations);
        }
      }

      // 2. Audit Plans & Sessions
      onProgress?.('Fetching active audit plans & sessions...');
      const planRes = await fetch('/api/audits/plans');
      let plans: OfflineAuditPlan[] = [];
      if (planRes.ok) {
        const json = await planRes.json();
        plans = Array.isArray(json) ? json : json.data || [];
        if (plans.length > 0) {
          await putItems('audit_plans', plans);
        }
      }

      // 3. Asset Catalog (All 13k+ assets)
      onProgress?.('Connecting to full asset inventory (13k+ items)...');
      let assets: OfflineAsset[] = [];

      try {
        const syncRes = await fetch('/api/assets/offline-sync');
        if (syncRes.ok) {
          const syncJson = await syncRes.json();
          const items = Array.isArray(syncJson) ? syncJson : syncJson?.data || [];
          if (Array.isArray(items) && items.length > 0) {
            assets = items;
          }
        }
      } catch (syncErr) {
        console.warn('Dedicated /api/assets/offline-sync error, using fallback:', syncErr);
      }

      // Fallback: If dedicated offline-sync endpoint was not reachable or empty, paginate
      if (assets.length === 0) {
        let page = 1;
        let hasMore = true;
        const PAGE_LIMIT = 2000;
        while (hasMore) {
          onProgress?.(`Fetching assets batch (page ${page})...`);
          const assetRes = await fetch(`/api/assets?page=${page}&limit=${PAGE_LIMIT}`);
          if (!assetRes.ok) break;
          const json = await assetRes.json();
          const batch = Array.isArray(json) ? json : json.data || [];
          if (batch.length === 0) break;
          assets.push(...batch);
          const totalExpected = json.meta?.total || 0;
          if (batch.length < PAGE_LIMIT || (totalExpected > 0 && assets.length >= totalExpected)) {
            hasMore = false;
          } else {
            page++;
          }
        }
      }

      // Store in IndexedDB in batches of 2,500 to keep UI ultra responsive
      if (assets.length > 0) {
        const BATCH_SIZE = 2500;
        for (let i = 0; i < assets.length; i += BATCH_SIZE) {
          const chunk = assets.slice(i, i + BATCH_SIZE);
          await putItems('assets', chunk);
          const count = Math.min(assets.length, i + chunk.length);
          const pct = Math.round((count / assets.length) * 100);
          onProgress?.(
            `Storing offline assets: ${count.toLocaleString()} / ${assets.length.toLocaleString()} (${pct}%)...`,
          );
        }
      }

      this.lastSyncedAt = new Date().toISOString();
      await this.notifyListeners();

      onProgress?.(
        `Cache updated: ${assets.length.toLocaleString()} assets & ${locations.length} locations ready offline.`,
      );
      return {
        assetsCount: assets.length,
        locationsCount: locations.length,
        plansCount: plans.length,
      };
    } catch (err: any) {
      console.error('Download offline cache error:', err);
      throw err;
    }
  }

  // ── 2. Offline Optical Scan Lookup ─────────────────────────────────────────
  public async offlineScanLookup(raw: string): Promise<{
    type: 'LOCATION' | 'ASSET';
    data: any;
    fromOfflineCache: boolean;
  } | null> {
    if (!raw) return null;

    let code = raw.trim();
    // Normalize URL codes
    if (code.includes('/assets/')) {
      const parts = code.split('/assets/')[1]?.split(/[?#]/)[0];
      if (parts) code = decodeURIComponent(parts);
    } else if (code.includes('code=')) {
      const match = code.match(/[?&]code=([^&#]+)/);
      if (match && match[1]) code = decodeURIComponent(match[1]);
    }

    try {
      const lowerCode = code.toLowerCase();

      // 1. Check Locations Store First (placing placard opens station)
      const allLocs = await getAllItems<OfflineLocation>('locations');
      const matchedLoc = allLocs.find(
        (loc) =>
          loc.code?.toLowerCase() === lowerCode ||
          loc.id?.toLowerCase() === lowerCode ||
          loc.name?.toLowerCase() === lowerCode,
      );

      if (matchedLoc) {
        return { type: 'LOCATION', data: matchedLoc, fromOfflineCache: true };
      }

      // 2. Check Assets Store (fast sub-millisecond indexed lookup)
      const matchedAsset = await findOfflineAsset(code);
      if (matchedAsset) {
        return { type: 'ASSET', data: matchedAsset, fromOfflineCache: true };
      }

      return null;
    } catch (err) {
      console.error('Offline lookup error:', err);
      return null;
    }
  }

  // ── 3. Queue Outbound Mutation (Commit batch, status change, etc.) ─────────
  public async queueMutation(
    endpoint: string,
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    payload: any,
    title: string,
  ): Promise<SyncQueueItem> {
    const item: SyncQueueItem = {
      id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      endpoint,
      method,
      payload,
      title,
      createdAt: new Date().toISOString(),
      retries: 0,
      status: 'PENDING',
    };

    await putItems('sync_queue', [item]);
    await this.notifyListeners();

    // If online, attempt background flush right away
    if (this.isOnline && !this.isSyncing) {
      this.flushQueue().catch(() => {});
    }

    return item;
  }

  // ── 4. Flush Sync Queue to Backend Database ────────────────────────────────
  public async flushQueue(): Promise<{ synced: number; failed: number }> {
    if (this.isSyncing || !this.isOnline) {
      return { synced: 0, failed: 0 };
    }

    this.isSyncing = true;
    await this.notifyListeners();

    let synced = 0;
    let failed = 0;

    try {
      const items = await getAllItems<SyncQueueItem>('sync_queue');
      // Sort FIFO by createdAt
      items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      for (const item of items) {
        if (!this.isOnline) break;

        try {
          const res = await fetch(item.endpoint, {
            method: item.method,
            headers: {
              'Content-Type': 'application/json',
            },
            body: item.payload ? JSON.stringify(item.payload) : undefined,
          });

          if (res.ok || res.status === 200 || res.status === 201) {
            // Successfully synchronized with backend database!
            await deleteItem('sync_queue', item.id);
            synced++;
          } else {
            // Server error or validation rejection
            const errText = await res.text().catch(() => 'Server error');
            item.retries++;
            item.status = 'FAILED';
            item.error = `${res.status}: ${errText.slice(0, 100)}`;
            await putItems('sync_queue', [item]);
            failed++;
          }
        } catch (netErr: any) {
          // Network dropped mid-sync
          this.isOnline = false;
          item.retries++;
          item.error = netErr.message || 'Network unreachable';
          await putItems('sync_queue', [item]);
          failed++;
          break;
        }
      }

      if (synced > 0) {
        this.lastSyncedAt = new Date().toISOString();
      }
    } catch (err) {
      console.error('Flush queue error:', err);
    } finally {
      this.isSyncing = false;
      await this.notifyListeners();
    }

    return { synced, failed };
  }

  public async getPendingItems(): Promise<SyncQueueItem[]> {
    try {
      return await getAllItems<SyncQueueItem>('sync_queue');
    } catch {
      return [];
    }
  }

  public async clearQueueItem(id: string): Promise<void> {
    await deleteItem('sync_queue', id);
    await this.notifyListeners();
  }
}

// Global Singleton Export
export const syncManager = new SyncManager();

