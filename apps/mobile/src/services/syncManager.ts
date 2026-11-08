import { AppState } from 'react-native';
import { apiRequest, getApiBaseUrl, setOnNetworkStatusChangeCallback } from './api';
import { storage } from './storage';
import { STORAGE_KEYS } from '../config/env';
import {
  getDatabase,
  setSyncMeta,
  getSyncMeta,
  getPendingOfflineAudits,
  markOfflineAuditSynced,
  getPendingOfflinePhotos,
  markOfflinePhotoSynced,
  getPendingOfflineAuditsCount,
  getPendingOfflinePhotosCount,
  getAssetCount,
  getLocationCount,
  markSessionItemSynced,
  saveCachedSessions,
  saveCachedSessionItems,
} from '../database/db';

export interface SyncProgress {
  phase:
    | 'idle'
    | 'fetching_assets'
    | 'inserting_assets'
    | 'fetching_locations'
    | 'inserting_locations'
    | 'fetching_sessions'
    | 'completed'
    | 'error';
  current: number;
  total: number;
  message: string;
}

export type ProgressCallback = (progress: SyncProgress) => void;

const BATCH_SIZE = 500;

export async function runFullSync(onProgress?: ProgressCallback): Promise<{
  assetCount: number;
  locationCount: number;
  sessionCount: number;
  syncedAt: string;
}> {
  const notify = (progress: SyncProgress) => {
    if (onProgress) onProgress(progress);
  };

  try {
    const db = await getDatabase();

    // ── 1. Fetch assets from lightweight offline-sync endpoint ──────────────────
    notify({
      phase: 'fetching_assets',
      current: 0,
      total: 0,
      message: 'Downloading asset catalog from server...',
    });

    const assetPayload = await apiRequest<any>('/assets/offline-sync', { timeoutMs: 30000 });

    const assets: any[] = Array.isArray(assetPayload)
      ? assetPayload
      : Array.isArray(assetPayload?.data)
      ? assetPayload.data
      : [];
    const totalAssets = assets.length;
    const nowIso = new Date().toISOString();

    if (totalAssets === 0) {
      throw new Error(
        'Server returned 0 assets. Please ensure the backend database is populated.',
      );
    }

    notify({
      phase: 'inserting_assets',
      current: 0,
      total: totalAssets,
      message: `Indexing ${totalAssets.toLocaleString()} assets into native SQLite...`,
    });

    // ── 2. Batch insert assets in chunks of 500 inside SQLite transactions ──────
    await db.runAsync('BEGIN TRANSACTION;');

    try {
      // Clear previous cache for clean rebuild
      await db.runAsync('DELETE FROM assets;');

      for (let i = 0; i < totalAssets; i += BATCH_SIZE) {
        const chunk = assets.slice(i, i + BATCH_SIZE);

        for (const item of chunk) {
          await db.runAsync(
            `INSERT INTO assets (
              id, assetCode, sapAssetCode, name, model, serialNumber,
              qrCode, barcode, status, condition, locationId, locationName,
              categoryId, categoryName, updatedAt, cachedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [
              item.id,
              item.assetCode,
              item.sapAssetCode || null,
              item.name,
              item.model || null,
              item.serialNumber || null,
              item.qrCode || null,
              item.barcode || null,
              item.status,
              item.condition || null,
              item.locationId || null,
              item.locationName || item.location?.name || null,
              item.categoryId || null,
              item.categoryName || item.category?.name || null,
              item.updatedAt || null,
              nowIso,
            ],
          );
        }

        const processed = Math.min(i + BATCH_SIZE, totalAssets);
        notify({
          phase: 'inserting_assets',
          current: processed,
          total: totalAssets,
          message: `Indexed ${processed.toLocaleString()} of ${totalAssets.toLocaleString()} assets...`,
        });
      }

      await db.runAsync('COMMIT;');
    } catch (err) {
      await db.runAsync('ROLLBACK;');
      throw err;
    }

    // ── 3. Fetch locations from server ──────────────────────────────────────────
    notify({
      phase: 'fetching_locations',
      current: 0,
      total: 0,
      message: 'Downloading facility locations tree...',
    });

    let locations: any[] = [];
    try {
      const locResponse = await apiRequest<{ data: any[] } | any[]>('/locations?limit=500');
      locations = Array.isArray(locResponse) ? locResponse : (locResponse?.data || []);
    } catch (e) {
      console.warn('[SyncManager] Failed to fetch locations, continuing:', e);
    }

    if (locations.length > 0) {
      notify({
        phase: 'inserting_locations',
        current: 0,
        total: locations.length,
        message: `Caching ${locations.length} factory locations...`,
      });

      await db.runAsync('BEGIN TRANSACTION;');
      try {
        await db.runAsync('DELETE FROM locations;');

        for (const loc of locations) {
          await db.runAsync(
            `INSERT INTO locations (id, code, name, type, parentId, fullPath)
             VALUES (?, ?, ?, ?, ?, ?);`,
            [
              loc.id,
              loc.code,
              loc.name,
              loc.type,
              loc.parentId || null,
              loc.fullPath || loc.name,
            ],
          );
        }
        await db.runAsync('COMMIT;');
      } catch (err) {
        await db.runAsync('ROLLBACK;');
        throw err;
      }
    }

    // ── 4. Preload and refresh audit sessions & checklists in local SQLite ────
    let sessionCount = 0;
    try {
      notify({
        phase: 'fetching_sessions',
        current: 0,
        total: 0,
        message: 'Syncing audit sessions & checklists...',
      });

      const sessRes = await apiRequest<{ data: any[] } | any[]>('/audits/sessions?limit=200', {
        timeoutMs: 15000,
      });
      const sessList = Array.isArray(sessRes) ? sessRes : sessRes?.data || [];
      if (sessList.length > 0) {
        sessionCount = sessList.length;
        await saveCachedSessions(sessList);

        // Fetch and refresh checklist items for active sessions
        const activeSessions = sessList.filter(
          (s: any) => s.status === 'IN_PROGRESS' || s.status === 'NOT_STARTED',
        );

        for (const s of activeSessions) {
          try {
            const itemsRes = await apiRequest<any[] | { data: any[] }>(
              `/audits/sessions/${s.id}/items`,
              { timeoutMs: 8000 },
            );
            const sItems = Array.isArray(itemsRes) ? itemsRes : itemsRes?.data || [];
            if (sItems.length > 0) {
              await saveCachedSessionItems(s.id, sItems);
            }
          } catch (itemErr) {
            console.warn(`[SyncManager] Could not preload items for session ${s.id}:`, itemErr);
          }
        }

        // Clean up any stale synced items whose sessions no longer exist
        await db.runAsync(
          `DELETE FROM session_audit_items 
           WHERE sessionId NOT IN (SELECT id FROM audit_sessions) AND synced = 1;`,
        );
      }
    } catch (sessErr) {
      console.warn('[SyncManager] Failed to cache sessions during sync, continuing:', sessErr);
    }

    // ── 5. Flush any pending offline audits to the server ───────────────────────
    await flushPendingAudits();

    // ── 6. Save metadata ────────────────────────────────────────────────────────
    await setSyncMeta('LAST_SYNC_TIME', nowIso);
    await setSyncMeta('LAST_SYNC_ASSET_COUNT', totalAssets.toString());
    await setSyncMeta('LAST_SYNC_LOCATION_COUNT', locations.length.toString());
    await setSyncMeta('LAST_SYNC_SESSION_COUNT', sessionCount.toString());

    notifyOutboxChanged();

    notify({
      phase: 'completed',
      current: totalAssets,
      total: totalAssets,
      message: `Sync complete! All tables refreshed (${totalAssets.toLocaleString()} assets, ${locations.length} locations, ${sessionCount} sessions).`,
    });

    return {
      assetCount: totalAssets,
      locationCount: locations.length,
      sessionCount,
      syncedAt: nowIso,
    };
  } catch (error: any) {
    notify({
      phase: 'error',
      current: 0,
      total: 0,
      message: error?.message || 'Synchronization failed',
    });
    throw error;
  }
}

/**
 * Uploads all locally stored offline audit scans to the backend API.
 */
export async function flushPendingAudits(): Promise<number> {
  const pending = await getPendingOfflineAudits();
  if (pending.length === 0) return 0;

  let uploaded = 0;

  for (const audit of pending) {
    try {
      await apiRequest('/audits/quick-scan', {
        method: 'POST',
        body: JSON.stringify({
          assetId: audit.assetId,
          scannedCode: audit.scannedCode,
          status: audit.status,
          verifiedLocationId: audit.verifiedLocationId,
          sessionId: audit.sessionId || undefined,
          planId: audit.planId || undefined,
          notes: audit.notes,
          auditedAt: audit.auditedAt,
        }),
      });

      await markOfflineAuditSynced(audit.id);
      if (audit.sessionId) {
        await markSessionItemSynced(audit.sessionId, audit.assetId);
      }
      uploaded++;
    } catch (e: any) {
      console.warn(`[SyncManager] Failed to flush audit ${audit.id}:`, e);
      // If it's a 4xx validation or not found error, skip to next rather than hanging outbox
      if (e?.status >= 400 && e?.status < 500) {
        await markOfflineAuditSynced(audit.id);
        continue;
      }
      // Fatal network error -> stop and retry later
      break;
    }
  }

  return uploaded;
}

/**
 * Uploads all locally captured offline equipment photos to the backend API.
 */
export async function flushPendingPhotos(): Promise<number> {
  const pending = await getPendingOfflinePhotos();
  if (pending.length === 0) return 0;

  let uploaded = 0;
  const baseUrl = getApiBaseUrl();
  const token = await storage.getItem(STORAGE_KEYS.ACCESS_TOKEN);

  for (const photo of pending) {
    try {
      const formData = new FormData();
      const filename = photo.uri.split('/').pop() || `equipment_${photo.assetCode}.jpg`;
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('photos', {
        uri: photo.uri,
        name: filename,
        type,
      } as any);

      const response = await fetch(`${baseUrl}/assets/${photo.assetId}/photos`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });

      if (response.ok || (response.status >= 400 && response.status < 500)) {
        // Mark synced on success or non-retryable 4xx
        await markOfflinePhotoSynced(photo.id);
        if (response.ok) uploaded++;
      } else {
        // Network / 5xx error -> stop queue
        break;
      }
    } catch (e) {
      console.warn(`[SyncManager] Failed to flush photo ${photo.id}:`, e);
      break;
    }
  }

  return uploaded;
}

/**
 * Flushes all pending outbox queues (audits and photos).
 */
export async function flushAllOutbox(): Promise<{
  auditsUploaded: number;
  photosUploaded: number;
  totalUploaded: number;
}> {
  const [auditsUploaded, photosUploaded] = await Promise.all([
    flushPendingAudits(),
    flushPendingPhotos(),
  ]);

  return {
    auditsUploaded,
    photosUploaded,
    totalUploaded: auditsUploaded + photosUploaded,
  };
}

export async function getSyncSummary(): Promise<{
  assetCount: number;
  locationCount: number;
  lastSyncTime: string | null;
  pendingAuditsCount: number;
  pendingPhotosCount: number;
  totalOutboxCount: number;
}> {
  const [assetCount, locationCount, lastSyncTime, pendingAudits, pendingPhotos] =
    await Promise.all([
      getAssetCount(),
      getLocationCount(),
      getSyncMeta('LAST_SYNC_TIME'),
      getPendingOfflineAuditsCount(),
      getPendingOfflinePhotosCount(),
    ]);

  return {
    assetCount,
    locationCount,
    lastSyncTime,
    pendingAuditsCount: pendingAudits,
    pendingPhotosCount: pendingPhotos,
    totalOutboxCount: pendingAudits + pendingPhotos,
  };
}

// ── Automated Live Sync Worker ──────────────────────────────────────────────────

let isFlushingOutbox = false;
let outboxListeners: Array<() => void> = [];

export function isOutboxSyncing(): boolean {
  return isFlushingOutbox;
}

export function subscribeOutboxChanges(listener: () => void): () => void {
  outboxListeners.push(listener);
  return () => {
    outboxListeners = outboxListeners.filter((l) => l !== listener);
  };
}

export function notifyOutboxChanged(): void {
  outboxListeners.forEach((fn) => {
    try {
      fn();
    } catch (e) {
      console.warn('[SyncManager] Listener error:', e);
    }
  });
}

// ── Real-time Network Connectivity Monitoring ─────────────────────────────────

let isNetworkOnline = true;
let networkStatusListeners: Array<(isOnline: boolean) => void> = [];

export function getIsNetworkOnline(): boolean {
  return isNetworkOnline;
}

export function setNetworkOnlineStatus(online: boolean): void {
  if (isNetworkOnline !== online) {
    isNetworkOnline = online;
    networkStatusListeners.forEach((fn) => {
      try {
        fn(online);
      } catch (e) {
        console.warn('[SyncManager] Network listener error:', e);
      }
    });
  }
}

export function subscribeNetworkStatus(listener: (isOnline: boolean) => void): () => void {
  networkStatusListeners.push(listener);
  try {
    listener(isNetworkOnline);
  } catch {}
  return () => {
    networkStatusListeners = networkStatusListeners.filter((l) => l !== listener);
  };
}

// Automatically update network status when API requests succeed or fail
setOnNetworkStatusChangeCallback((online) => {
  setNetworkOnlineStatus(online);
});

/**
 * Pings the backend health endpoint to check real-time online reachability.
 */
export async function checkServerOnline(): Promise<boolean> {
  try {
    const baseUrl = getApiBaseUrl();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const online = res.ok;
    setNetworkOnlineStatus(online);
    return online;
  } catch {
    setNetworkOnlineStatus(false);
    return false;
  }
}

/**
 * Triggers background live outbox synchronization when online.
 * Safe to call frequently; locks during active flush and skips if offline.
 */
export async function triggerLiveSync(options?: { force?: boolean }): Promise<{
  success: boolean;
  auditsUploaded: number;
  photosUploaded: number;
  totalUploaded: number;
}> {
  if (isFlushingOutbox) {
    return { success: false, auditsUploaded: 0, photosUploaded: 0, totalUploaded: 0 };
  }

  const audits = await getPendingOfflineAuditsCount();
  const photos = await getPendingOfflinePhotosCount();
  if (audits === 0 && photos === 0) {
    return { success: true, auditsUploaded: 0, photosUploaded: 0, totalUploaded: 0 };
  }

  if (!options?.force) {
    const isOnline = await checkServerOnline();
    if (!isOnline) {
      return { success: false, auditsUploaded: 0, photosUploaded: 0, totalUploaded: 0 };
    }
  }

  isFlushingOutbox = true;
  notifyOutboxChanged();

  try {
    const res = await flushAllOutbox();
    if (res.totalUploaded > 0) {
      console.log(`[SyncManager] Live synchronized ${res.totalUploaded} items with backend.`);
    }
    return {
      success: true,
      auditsUploaded: res.auditsUploaded,
      photosUploaded: res.photosUploaded,
      totalUploaded: res.totalUploaded,
    };
  } catch (error) {
    console.warn('[SyncManager] Live sync error:', error);
    return { success: false, auditsUploaded: 0, photosUploaded: 0, totalUploaded: 0 };
  } finally {
    isFlushingOutbox = false;
    notifyOutboxChanged();
  }
}

let liveSyncInterval: any = null;
let appStateSub: any = null;

/**
 * Starts continuous live sync background service.
 * Automatically checks and syncs outbox every 10 seconds and on app resume.
 */
export function startLiveSyncWorker(): () => void {
  if (liveSyncInterval) return () => {};

  const executeBackgroundSync = async () => {
    try {
      const isOnline = await checkServerOnline();
      if (!isOnline) return;
      const audits = await getPendingOfflineAuditsCount();
      const photos = await getPendingOfflinePhotosCount();
      if (audits > 0 || photos > 0) {
        await triggerLiveSync();
      }
    } catch {
      // Quiet fail in background
    }
  };

  // Check every 10 seconds
  liveSyncInterval = setInterval(executeBackgroundSync, 10000);

  // Check whenever app returns to foreground
  appStateSub = AppState.addEventListener('change', (nextState) => {
    if (nextState === 'active') {
      executeBackgroundSync();
    }
  });

  // Execute initial sync check on startup
  executeBackgroundSync();

  return () => {
    if (liveSyncInterval) {
      clearInterval(liveSyncInterval);
      liveSyncInterval = null;
    }
    if (appStateSub) {
      appStateSub.remove();
      appStateSub = null;
    }
  };
}

