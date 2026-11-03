/**
 * Enterprise IndexedDB Storage for Assets Management PWA
 * Zero-dependency, pure browser native IndexedDB wrapper.
 */

const DB_NAME = 'AssetsManagementOfflineDB';
const DB_VERSION = 2;

export interface OfflineAsset {
  id: string;
  assetCode: string;
  name: string;
  serialNumber?: string;
  sapAssetCode?: string;
  qrCode?: string;
  category?: string;
  status: string;
  condition?: string;
  locationId?: string;
  locationName?: string;
  syncedAt?: string;
  [key: string]: any;
}

export interface OfflineLocation {
  id: string;
  code: string;
  name: string;
  type?: string;
  companyId?: string;
  parentId?: string;
  [key: string]: any;
}

export interface OfflineAuditPlan {
  id: string;
  name: string;
  type: string;
  status: string;
  scopeType?: string;
  scopedLocations?: Array<{ id: string; code: string; name: string }>;
  [key: string]: any;
}

export interface OfflineAuditSession {
  id: string;
  planId: string;
  locationId: string;
  locationName?: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  scannedCount?: number;
  completedAt?: string;
  [key: string]: any;
}

export interface SyncQueueItem {
  id: string;
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  payload: any;
  title: string;
  createdAt: string;
  retries: number;
  status: 'PENDING' | 'SYNCING' | 'FAILED' | 'SYNCED';
  error?: string;
}

let dbInstance: IDBDatabase | null = null;

export function openOfflineDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported in this environment'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const tx = (event.target as any).transaction;

      // 1. Assets Store
      let assetStore: IDBObjectStore;
      if (!db.objectStoreNames.contains('assets')) {
        assetStore = db.createObjectStore('assets', { keyPath: 'id' });
        assetStore.createIndex('assetCode', 'assetCode', { unique: false });
        assetStore.createIndex('serialNumber', 'serialNumber', { unique: false });
        assetStore.createIndex('locationId', 'locationId', { unique: false });
      } else {
        assetStore = tx.objectStore('assets');
      }

      if (!assetStore.indexNames.contains('sapAssetCode')) {
        assetStore.createIndex('sapAssetCode', 'sapAssetCode', { unique: false });
      }
      if (!assetStore.indexNames.contains('qrCode')) {
        assetStore.createIndex('qrCode', 'qrCode', { unique: false });
      }

      // 2. Locations Store
      if (!db.objectStoreNames.contains('locations')) {
        const locStore = db.createObjectStore('locations', { keyPath: 'id' });
        locStore.createIndex('code', 'code', { unique: false });
        locStore.createIndex('parentId', 'parentId', { unique: false });
      }

      // 3. Audit Plans Store
      if (!db.objectStoreNames.contains('audit_plans')) {
        const planStore = db.createObjectStore('audit_plans', { keyPath: 'id' });
        planStore.createIndex('status', 'status', { unique: false });
      }

      // 4. Audit Sessions Store
      if (!db.objectStoreNames.contains('audit_sessions')) {
        const sessionStore = db.createObjectStore('audit_sessions', { keyPath: 'id' });
        sessionStore.createIndex('planId', 'planId', { unique: false });
        sessionStore.createIndex('locationId', 'locationId', { unique: false });
      }

      // 5. Outbound Sync Queue
      if (!db.objectStoreNames.contains('sync_queue')) {
        const queueStore = db.createObjectStore('sync_queue', { keyPath: 'id' });
        queueStore.createIndex('status', 'status', { unique: false });
        queueStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

// ── Generic Object Store Operations ──────────────────────────────────────────

export async function putItems<T>(storeName: string, items: T[]): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);

    for (const item of items) {
      store.put(item);
    }

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getItem<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.get(key);

    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllItems<T>(storeName: string): Promise<T[]> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.getAll();

    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteItem(storeName: string, key: IDBValidKey): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.delete(key);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function clearStore(storeName: string): Promise<void> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const req = store.clear();

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getStoreCount(storeName: string): Promise<number> {
  const db = await openOfflineDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const req = store.count();

    req.onsuccess = () => resolve(req.result || 0);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Fast sub-millisecond offline asset lookup using IDB index hierarchy and cursor fallback
 */
export async function findOfflineAsset(code: string): Promise<OfflineAsset | null> {
  if (!code) return null;
  const db = await openOfflineDB();
  const trimmed = code.trim();
  const lower = trimmed.toLowerCase();

  return new Promise((resolve) => {
    const tx = db.transaction('assets', 'readonly');
    const store = tx.objectStore('assets');

    // 1. Direct ID lookup
    const idReq = store.get(trimmed);
    idReq.onsuccess = () => {
      if (idReq.result) {
        return resolve(idReq.result);
      }

      // 2. Direct Index lookups
      const indexNames = ['assetCode', 'sapAssetCode', 'qrCode', 'serialNumber'].filter((idx) =>
        store.indexNames.contains(idx),
      );

      if (indexNames.length === 0) {
        return scanCursor();
      }

      const promises = indexNames.map((idx) => {
        return new Promise<OfflineAsset | null>((res) => {
          const req = store.index(idx).get(trimmed);
          req.onsuccess = () => res(req.result || null);
          req.onerror = () => res(null);
        });
      });

      Promise.all(promises).then((results) => {
        const found = results.find(Boolean);
        if (found) {
          return resolve(found);
        }
        scanCursor();
      });
    };
    idReq.onerror = () => scanCursor();

    function scanCursor() {
      const cursorReq = store.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor) {
          return resolve(null);
        }
        const item: OfflineAsset = cursor.value;
        if (
          item.assetCode?.toLowerCase() === lower ||
          item.sapAssetCode?.toLowerCase() === lower ||
          item.qrCode?.toLowerCase() === lower ||
          item.serialNumber?.toLowerCase() === lower ||
          item.id?.toLowerCase() === lower ||
          item.barcode?.toLowerCase() === lower
        ) {
          return resolve(item);
        }
        cursor.continue();
      };
      cursorReq.onerror = () => resolve(null);
    }
  });
}


