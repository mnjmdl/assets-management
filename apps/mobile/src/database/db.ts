import { openDatabaseAsync, SQLiteDatabase } from 'expo-sqlite';

let dbInstance: SQLiteDatabase | null = null;

export interface CachedAsset {
  id: string;
  assetCode: string;
  sapAssetCode: string | null;
  name: string;
  model: string | null;
  serialNumber: string | null;
  qrCode: string | null;
  barcode: string | null;
  status: string;
  condition: string | null;
  locationId: string | null;
  locationName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  updatedAt: string | null;
  cachedAt: string;
}

export interface CachedLocation {
  id: string;
  code: string;
  name: string;
  type: string;
  parentId: string | null;
  fullPath: string | null;
}

export interface OfflineAuditRecord {
  id: string;
  assetId: string;
  assetCode: string;
  scannedCode: string;
  status: string; // FOUND, MISSING, DAMAGED, LOCATION_MISMATCH
  verifiedLocationId: string | null;
  sessionId?: string | null;
  planId?: string | null;
  notes: string | null;
  auditedAt: string;
  synced: number; // 0 = false, 1 = true
}

export async function getDatabase(): Promise<SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  const db = await openDatabaseAsync('crystal_martin_assets.db');

  // Initialize Schema
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;

    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY NOT NULL,
      assetCode TEXT NOT NULL,
      sapAssetCode TEXT,
      name TEXT NOT NULL,
      model TEXT,
      serialNumber TEXT,
      qrCode TEXT,
      barcode TEXT,
      status TEXT NOT NULL,
      condition TEXT,
      locationId TEXT,
      locationName TEXT,
      categoryId TEXT,
      categoryName TEXT,
      updatedAt TEXT,
      cachedAt TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_assets_asset_code ON assets(assetCode);
    CREATE INDEX IF NOT EXISTS idx_assets_sap_code ON assets(sapAssetCode);
    CREATE INDEX IF NOT EXISTS idx_assets_qr_code ON assets(qrCode);
    CREATE INDEX IF NOT EXISTS idx_assets_barcode ON assets(barcode);
    CREATE INDEX IF NOT EXISTS idx_assets_location ON assets(locationId);

    CREATE TABLE IF NOT EXISTS locations (
      id TEXT PRIMARY KEY NOT NULL,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      parentId TEXT,
      fullPath TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_locations_code ON locations(code);

    CREATE TABLE IF NOT EXISTS sync_meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS offline_audits (
      id TEXT PRIMARY KEY NOT NULL,
      assetId TEXT NOT NULL,
      assetCode TEXT NOT NULL,
      scannedCode TEXT NOT NULL,
      status TEXT NOT NULL,
      verifiedLocationId TEXT,
      sessionId TEXT,
      planId TEXT,
      notes TEXT,
      auditedAt TEXT NOT NULL,
      synced INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_offline_audits_synced ON offline_audits(synced);

    CREATE TABLE IF NOT EXISTS offline_photos (
      id TEXT PRIMARY KEY NOT NULL,
      assetId TEXT NOT NULL,
      assetCode TEXT NOT NULL,
      uri TEXT NOT NULL,
      capturedAt TEXT NOT NULL,
      synced INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_offline_photos_asset ON offline_photos(assetId);

    CREATE TABLE IF NOT EXISTS session_audit_items (
      id TEXT PRIMARY KEY NOT NULL,
      sessionId TEXT NOT NULL,
      assetId TEXT NOT NULL,
      assetCode TEXT NOT NULL,
      assetName TEXT NOT NULL,
      sapAssetCode TEXT,
      serialNumber TEXT,
      model TEXT,
      qrCode TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      condition TEXT,
      notes TEXT,
      expectedLocationId TEXT,
      expectedLocationName TEXT,
      expectedLocationCode TEXT,
      foundLocationId TEXT,
      foundLocationName TEXT,
      foundLocationCode TEXT,
      scannedAt TEXT,
      synced INTEGER NOT NULL DEFAULT 1,
      updatedAt TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_session_items_sess ON session_audit_items(sessionId);
    CREATE INDEX IF NOT EXISTS idx_session_items_asset ON session_audit_items(assetId);
    CREATE INDEX IF NOT EXISTS idx_session_items_status ON session_audit_items(status);

    CREATE TABLE IF NOT EXISTS audit_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      planId TEXT NOT NULL,
      planName TEXT,
      planStatus TEXT,
      planType TEXT,
      status TEXT NOT NULL,
      locationId TEXT,
      locationName TEXT,
      locationCode TEXT,
      locationType TEXT,
      auditorId TEXT,
      auditorName TEXT,
      auditorEmail TEXT,
      startedAt TEXT,
      notes TEXT,
      totalItems INTEGER DEFAULT 0,
      verifiedItems INTEGER DEFAULT 0,
      discrepanciesCount INTEGER DEFAULT 0,
      cachedAt TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_sessions_id ON audit_sessions(id);
  `);

  // Migrate offline_audits schema if columns are missing from earlier installs
  try {
    const tableInfo = await db.getAllAsync<{ name: string }>('PRAGMA table_info(offline_audits);');
    const existingCols = new Set(tableInfo.map((col) => col.name));

    if (!existingCols.has('sessionId')) {
      await db.execAsync('ALTER TABLE offline_audits ADD COLUMN sessionId TEXT;');
    }
    if (!existingCols.has('planId')) {
      await db.execAsync('ALTER TABLE offline_audits ADD COLUMN planId TEXT;');
    }
  } catch (migErr) {
    console.warn('[db] Migration error for offline_audits:', migErr);
  }

  // Create sessionId index after column is guaranteed to exist
  try {
    await db.execAsync('CREATE INDEX IF NOT EXISTS idx_offline_audits_session ON offline_audits(sessionId);');
  } catch (_) {}

  // Auto-purge any stale synced items whose sessions no longer exist in SQLite
  try {
    await db.execAsync(
      `DELETE FROM session_audit_items 
       WHERE sessionId NOT IN (SELECT id FROM audit_sessions) AND synced = 1;`,
    );
  } catch (_) {}

  // Deduplicate session_audit_items so only 1 row exists per (sessionId, assetId)
  try {
    await db.execAsync(`
      DELETE FROM session_audit_items 
      WHERE rowid NOT IN (
        SELECT MIN(rowid) 
        FROM session_audit_items 
        GROUP BY sessionId, assetId
      );
    `);
    await db.execAsync(
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_session_items_sess_asset ON session_audit_items(sessionId, assetId);',
    );
  } catch (dedupErr) {
    console.warn('[db] Note on deduplicating session items:', dedupErr);
  }

  dbInstance = db;
  return db;
}

/**
 * Instant index-backed asset lookup.
 * Evaluates SAP asset code, system asset code, QR code, and barcode.
 */
export async function findCachedAsset(code: string): Promise<CachedAsset | null> {
  if (!code || !code.trim()) return null;
  const db = await getDatabase();
  const trimmed = code.trim();

  const query = `
    SELECT * FROM assets 
    WHERE sapAssetCode = ? COLLATE NOCASE
       OR assetCode = ? COLLATE NOCASE
       OR qrCode = ? COLLATE NOCASE
       OR barcode = ? COLLATE NOCASE
    LIMIT 1;
  `;

  const result = await db.getFirstAsync<CachedAsset>(query, [
    trimmed,
    trimmed,
    trimmed,
    trimmed,
  ]);

  if (result) return result;

  // Secondary fallback: case-insensitive partial match on assetCode or sapAssetCode
  const secondaryQuery = `
    SELECT * FROM assets
    WHERE assetCode LIKE ?
       OR sapAssetCode LIKE ?
    LIMIT 1;
  `;
  const pattern = `%${trimmed}%`;
  const secondaryResult = await db.getFirstAsync<CachedAsset>(secondaryQuery, [
    pattern,
    pattern,
  ]);

  return secondaryResult || null;
}

export async function searchCachedAssets(
  queryText: string,
  limit: number = 20,
): Promise<CachedAsset[]> {
  const db = await getDatabase();
  const pattern = `%${queryText.trim()}%`;

  const query = `
    SELECT * FROM assets
    WHERE assetCode LIKE ?
       OR sapAssetCode LIKE ?
       OR name LIKE ?
       OR model LIKE ?
       OR serialNumber LIKE ?
    LIMIT ?;
  `;

  return await db.getAllAsync<CachedAsset>(query, [pattern, pattern, pattern, pattern, pattern, limit]);
}

export async function getAssetCount(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM assets;',
  );
  return row?.count || 0;
}

export interface PaginatedAssetsResult {
  items: CachedAsset[];
  totalCount: number;
}

export async function getCachedAssetsPaginated(options: {
  limit?: number;
  offset?: number;
  search?: string;
  status?: string;
}): Promise<PaginatedAssetsResult> {
  const db = await getDatabase();
  const limit = options.limit || 30;
  const offset = options.offset || 0;
  const conditions: string[] = [];
  const params: any[] = [];

  if (options.status && options.status !== 'ALL') {
    conditions.push('status = ?');
    params.push(options.status);
  }

  if (options.search && options.search.trim()) {
    const pattern = `%${options.search.trim()}%`;
    conditions.push(`(
      assetCode LIKE ? OR
      sapAssetCode LIKE ? OR
      name LIKE ? OR
      model LIKE ? OR
      serialNumber LIKE ? OR
      locationName LIKE ?
    )`);
    params.push(pattern, pattern, pattern, pattern, pattern, pattern);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRow = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM assets ${whereClause};`,
    params,
  );
  const totalCount = countRow?.count || 0;

  const items = await db.getAllAsync<CachedAsset>(
    `SELECT * FROM assets ${whereClause} ORDER BY assetCode ASC LIMIT ? OFFSET ?;`,
    [...params, limit, offset],
  );

  return { items, totalCount };
}

export async function getLocationCount(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM locations;',
  );
  return row?.count || 0;
}

export async function getAllCachedLocations(): Promise<CachedLocation[]> {
  const db = await getDatabase();
  return await db.getAllAsync<CachedLocation>(
    'SELECT * FROM locations ORDER BY name ASC;',
  );
}

export async function findCachedLocation(codeOrTag: string): Promise<CachedLocation | null> {
  if (!codeOrTag) return null;
  const db = await getDatabase();
  const raw = codeOrTag.trim();
  const clean = raw.replace(/^LOC:/i, '').trim();

  const query = `
    SELECT * FROM locations
    WHERE UPPER(code) = UPPER(?)
       OR UPPER(code) = UPPER(?)
       OR UPPER(name) = UPPER(?)
       OR UPPER(name) = UPPER(?)
       OR id = ?
       OR id = ?
    LIMIT 1;
  `;
  const result = await db.getFirstAsync<CachedLocation>(query, [
    clean,
    raw,
    clean,
    raw,
    raw,
    clean,
  ]);
  return result || null;
}

export async function getLocationDirectAssetCounts(): Promise<Record<string, number>> {
  const db = await getDatabase();
  const assetRows = await db.getAllAsync<{ locationId: string; count: number }>(
    'SELECT locationId, COUNT(*) as count FROM assets WHERE locationId IS NOT NULL GROUP BY locationId;',
  );
  const directMap: Record<string, number> = {};
  for (const row of assetRows) {
    if (row.locationId) {
      directMap[row.locationId] = Number(row.count) || 0;
    }
  }
  return directMap;
}

export async function getLocationAssetCounts(): Promise<Record<string, number>> {
  const db = await getDatabase();
  const [assetRows, locationRows] = await Promise.all([
    db.getAllAsync<{ locationId: string; count: number }>(
      'SELECT locationId, COUNT(*) as count FROM assets WHERE locationId IS NOT NULL GROUP BY locationId;',
    ),
    db.getAllAsync<{ id: string; parentId: string | null }>(
      'SELECT id, parentId FROM locations;',
    ),
  ]);

  const parentMap = new Map<string, string | null>();
  for (const loc of locationRows) {
    parentMap.set(loc.id, loc.parentId || null);
  }

  // Bubble up each location's asset count to all parent, grandparent, and root ancestor locations
  const rolledUpMap: Record<string, number> = {};
  for (const row of assetRows) {
    if (!row.locationId) continue;
    const count = Number(row.count) || 0;
    if (count === 0) continue;

    let curId: string | null | undefined = row.locationId;
    while (curId) {
      rolledUpMap[curId] = (rolledUpMap[curId] || 0) + count;
      curId = parentMap.get(curId);
    }
  }

  return rolledUpMap;
}

export async function getSyncMeta(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM sync_meta WHERE key = ?;',
    [key],
  );
  return row?.value || null;
}

export async function setSyncMeta(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO sync_meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
    [key, value],
  );
}

export async function recordOfflineAudit(
  record: Omit<OfflineAuditRecord, 'synced'>,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO offline_audits (id, assetId, assetCode, scannedCode, status, verifiedLocationId, sessionId, planId, notes, auditedAt, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0);`,
    [
      record.id,
      record.assetId,
      record.assetCode,
      record.scannedCode,
      record.status,
      record.verifiedLocationId || null,
      record.sessionId || null,
      record.planId || null,
      record.notes || null,
      record.auditedAt,
    ],
  );
}

export async function getPendingOfflineAudits(): Promise<OfflineAuditRecord[]> {
  const db = await getDatabase();
  return await db.getAllAsync<OfflineAuditRecord>(
    'SELECT * FROM offline_audits WHERE synced = 0 ORDER BY auditedAt ASC;',
  );
}

export async function getPendingOfflineAuditsForSession(
  sessionId: string,
): Promise<OfflineAuditRecord[]> {
  if (!sessionId) return [];
  try {
    const db = await getDatabase();
    return await db.getAllAsync<OfflineAuditRecord>(
      'SELECT * FROM offline_audits WHERE sessionId = ? AND synced = 0 ORDER BY auditedAt DESC;',
      [sessionId],
    );
  } catch (err) {
    console.warn('[db] Error in getPendingOfflineAuditsForSession:', err);
    return [];
  }
}

export async function markOfflineAuditSynced(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE offline_audits SET synced = 1 WHERE id = ?;', [id]);
}

export interface OfflinePhotoRecord {
  id: string;
  assetId: string;
  assetCode: string;
  uri: string;
  capturedAt: string;
  synced: number;
}

export async function saveOfflinePhoto(
  photo: Omit<OfflinePhotoRecord, 'synced'>,
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO offline_photos (id, assetId, assetCode, uri, capturedAt, synced)
     VALUES (?, ?, ?, ?, ?, 0);`,
    [photo.id, photo.assetId, photo.assetCode, photo.uri, photo.capturedAt],
  );
}

export async function getOfflinePhotosForAsset(
  assetId: string,
): Promise<OfflinePhotoRecord[]> {
  const db = await getDatabase();
  return await db.getAllAsync<OfflinePhotoRecord>(
    'SELECT * FROM offline_photos WHERE assetId = ? ORDER BY capturedAt DESC;',
    [assetId],
  );
}

export async function getPendingOfflinePhotos(): Promise<OfflinePhotoRecord[]> {
  const db = await getDatabase();
  return await db.getAllAsync<OfflinePhotoRecord>(
    'SELECT * FROM offline_photos WHERE synced = 0 ORDER BY capturedAt ASC;',
  );
}

export async function getPendingOfflinePhotosCount(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM offline_photos WHERE synced = 0;',
  );
  return row?.count || 0;
}

export async function getPendingOfflineAuditsCount(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM offline_audits WHERE synced = 0;',
  );
  return row?.count || 0;
}

export async function markOfflinePhotoSynced(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE offline_photos SET synced = 1 WHERE id = ?;', [id]);
}

// ─── Local Session & Session Items Offline Storage ───────────────────────────

export async function saveCachedSession(session: any): Promise<void> {
  if (!session || !session.id) return;
  try {
    const db = await getDatabase();
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO audit_sessions (
         id, planId, planName, planStatus, planType, status,
         locationId, locationName, locationCode, locationType,
         auditorId, auditorName, auditorEmail, startedAt, notes,
         totalItems, verifiedItems, discrepanciesCount, cachedAt
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         planName = excluded.planName,
         planStatus = excluded.planStatus,
         planType = excluded.planType,
         status = excluded.status,
         locationId = excluded.locationId,
         locationName = excluded.locationName,
         locationCode = excluded.locationCode,
         locationType = excluded.locationType,
         auditorId = excluded.auditorId,
         auditorName = excluded.auditorName,
         auditorEmail = excluded.auditorEmail,
         startedAt = excluded.startedAt,
         notes = excluded.notes,
         totalItems = excluded.totalItems,
         verifiedItems = excluded.verifiedItems,
         discrepanciesCount = excluded.discrepanciesCount,
         cachedAt = excluded.cachedAt;`,
      [
        session.id,
        session.planId || session.plan?.id || '',
        session.plan?.name || null,
        session.plan?.status || null,
        session.plan?.type || null,
        session.status || 'IN_PROGRESS',
        session.locationId || session.location?.id || null,
        session.location?.name || null,
        session.location?.code || null,
        session.location?.type || null,
        session.auditorId || session.auditor?.id || null,
        session.auditor?.name || null,
        session.auditor?.email || null,
        session.startedAt || null,
        session.notes || null,
        session._count?.items ?? 0,
        0,
        session._count?.discrepancies ?? 0,
        now,
      ],
    );
  } catch (err) {
    console.warn('[db] Error in saveCachedSession:', err);
  }
}

export async function saveCachedSessions(sessions: any[]): Promise<void> {
  if (!sessions || sessions.length === 0) return;
  try {
    const db = await getDatabase();
    const now = new Date().toISOString();

    for (const session of sessions) {
      if (!session || !session.id) continue;
      await db.runAsync(
        `INSERT INTO audit_sessions (
           id, planId, planName, planStatus, planType, status,
           locationId, locationName, locationCode, locationType,
           auditorId, auditorName, auditorEmail, startedAt, notes,
           totalItems, verifiedItems, discrepanciesCount, cachedAt
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           planName = excluded.planName,
           planStatus = excluded.planStatus,
           planType = excluded.planType,
           status = excluded.status,
           locationId = excluded.locationId,
           locationName = excluded.locationName,
           locationCode = excluded.locationCode,
           locationType = excluded.locationType,
           auditorId = excluded.auditorId,
           auditorName = excluded.auditorName,
           auditorEmail = excluded.auditorEmail,
           startedAt = excluded.startedAt,
           notes = excluded.notes,
           totalItems = excluded.totalItems,
           verifiedItems = excluded.verifiedItems,
           discrepanciesCount = excluded.discrepanciesCount,
           cachedAt = excluded.cachedAt;`,
        [
          session.id,
          session.planId || session.plan?.id || '',
          session.plan?.name || null,
          session.plan?.status || null,
          session.plan?.type || null,
          session.status || 'IN_PROGRESS',
          session.locationId || session.location?.id || null,
          session.location?.name || null,
          session.location?.code || null,
          session.location?.type || null,
          session.auditorId || session.auditor?.id || null,
          session.auditor?.name || null,
          session.auditor?.email || null,
          session.startedAt || null,
          session.notes || null,
          session._count?.items ?? 0,
          0,
          session._count?.discrepancies ?? 0,
          now,
        ],
      );
    }
  } catch (err) {
    console.warn('[db] Error in saveCachedSessions:', err);
  }
}

/**
 * Prune sessions and checklist items that no longer exist on the server for a plan.
 * Preserves local items that have pending offline changes (synced = 0).
 */
export async function pruneOrphanedSessions(
  planId: string,
  validSessionIds: string[],
): Promise<void> {
  if (!planId) return;
  try {
    const db = await getDatabase();
    if (validSessionIds && validSessionIds.length > 0) {
      const placeholders = validSessionIds.map(() => '?').join(',');
      // Delete any cached session in this plan that is NOT in the server's active sessions list
      await db.runAsync(
        `DELETE FROM audit_sessions WHERE planId = ? AND id NOT IN (${placeholders});`,
        [planId, ...validSessionIds],
      );
      // Delete any items belonging to sessions that no longer exist, unless they have unsynced local offline work
      await db.runAsync(
        `DELETE FROM session_audit_items 
         WHERE sessionId NOT IN (SELECT id FROM audit_sessions) AND synced = 1;`,
      );
    } else {
      // If plan has 0 sessions on server, remove all synced sessions for this plan
      await db.runAsync(
        `DELETE FROM session_audit_items 
         WHERE sessionId IN (SELECT id FROM audit_sessions WHERE planId = ?) AND synced = 1;`,
        [planId],
      );
      await db.runAsync(
        `DELETE FROM audit_sessions WHERE planId = ?;`,
        [planId],
      );
    }
  } catch (err) {
    console.warn('[db] Error in pruneOrphanedSessions:', err);
  }
}

export async function getAllCachedSessions(): Promise<any[]> {
  try {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM audit_sessions 
       ORDER BY CASE WHEN status = 'IN_PROGRESS' THEN 0 WHEN status = 'NOT_STARTED' THEN 1 ELSE 2 END ASC,
                cachedAt DESC;`,
    );
    return rows.map((row) => ({
      id: row.id,
      planId: row.planId,
      status: row.status,
      locationId: row.locationId,
      startedAt: row.startedAt,
      notes: row.notes,
      createdAt: row.cachedAt,
      updatedAt: row.cachedAt,
      plan: row.planName
        ? {
            id: row.planId,
            name: row.planName,
            status: row.planStatus,
            type: row.planType,
          }
        : undefined,
      auditor: row.auditorName
        ? {
            id: row.auditorId,
            name: row.auditorName,
            email: row.auditorEmail,
          }
        : undefined,
      location: row.locationName
        ? {
            id: row.locationId,
            name: row.locationName,
            code: row.locationCode,
            type: row.locationType,
          }
        : null,
      _count: {
        items: row.totalItems,
        discrepancies: row.discrepanciesCount,
      },
    }));
  } catch (err) {
    console.warn('[db] Error in getAllCachedSessions:', err);
    return [];
  }
}

export async function getCachedSession(sessionId: string): Promise<any | null> {
  if (!sessionId) return null;
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<any>(
      'SELECT * FROM audit_sessions WHERE id = ? LIMIT 1;',
      [sessionId],
    );
    if (!row) return null;
    return {
      id: row.id,
      planId: row.planId,
      status: row.status,
      locationId: row.locationId,
      startedAt: row.startedAt,
      notes: row.notes,
      plan: row.planName
        ? {
            id: row.planId,
            name: row.planName,
            status: row.planStatus,
            type: row.planType,
          }
        : undefined,
      auditor: row.auditorName
        ? {
            id: row.auditorId,
            name: row.auditorName,
            email: row.auditorEmail,
          }
        : undefined,
      location: row.locationName
        ? {
            id: row.locationId,
            name: row.locationName,
            code: row.locationCode,
            type: row.locationType,
          }
        : null,
      _count: {
        items: row.totalItems,
        discrepancies: row.discrepanciesCount,
      },
    };
  } catch (err) {
    console.warn('[db] Error in getCachedSession:', err);
    return null;
  }
}

export async function saveCachedSessionItems(sessionId: string, items: any[]): Promise<void> {
  if (!sessionId || !items || items.length === 0) return;
  try {
    const db = await getDatabase();
    const now = new Date().toISOString();

    for (const item of items) {
      const asset = item.asset || {};
      const assetId = item.assetId || asset.id;
      if (!assetId) continue;

      // Check if this item already has a local unsynced offline scan
      const localRow = await db.getFirstAsync<{ synced: number }>(
        'SELECT synced FROM session_audit_items WHERE sessionId = ? AND assetId = ? LIMIT 1;',
        [sessionId, assetId],
      );

      // Do not overwrite offline scans that are pending sync
      if (localRow && localRow.synced === 0) {
        continue;
      }

      await db.runAsync(
        `INSERT INTO session_audit_items (
           id, sessionId, assetId, assetCode, assetName, sapAssetCode,
           serialNumber, model, qrCode, status, condition, notes,
           expectedLocationId, expectedLocationName, expectedLocationCode,
           foundLocationId, foundLocationName, foundLocationCode,
           scannedAt, synced, updatedAt
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
         ON CONFLICT(sessionId, assetId) DO UPDATE SET
           id = excluded.id,
           status = excluded.status,
           condition = excluded.condition,
           notes = excluded.notes,
           expectedLocationId = excluded.expectedLocationId,
           expectedLocationName = excluded.expectedLocationName,
           expectedLocationCode = excluded.expectedLocationCode,
           foundLocationId = excluded.foundLocationId,
           foundLocationName = excluded.foundLocationName,
           foundLocationCode = excluded.foundLocationCode,
           scannedAt = excluded.scannedAt,
           synced = 1,
           updatedAt = excluded.updatedAt;`,
        [
          item.id || `item_${sessionId}_${assetId}`,
          sessionId,
          assetId,
          asset.assetCode || 'UNKNOWN',
          asset.name || 'Unnamed Asset',
          asset.sapAssetCode || null,
          asset.serialNumber || null,
          asset.model || null,
          asset.qrCode || null,
          item.status || 'PENDING',
          item.condition || null,
          item.notes || null,
          item.expectedLocation?.id || null,
          item.expectedLocation?.name || null,
          item.expectedLocation?.code || null,
          item.foundLocation?.id || null,
          item.foundLocation?.name || null,
          item.foundLocation?.code || null,
          item.scannedAt || null,
          now,
        ],
      );
    }
  } catch (err) {
    console.warn('[db] Error in saveCachedSessionItems:', err);
  }
}

export async function getSessionAuditItems(sessionId: string): Promise<any[]> {
  if (!sessionId) return [];
  try {
    const db = await getDatabase();
    const rows = await db.getAllAsync<any>(
      `SELECT * FROM session_audit_items 
       WHERE sessionId = ? 
       ORDER BY CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END ASC, scannedAt DESC, assetCode ASC;`,
      [sessionId],
    );

    const seen = new Set<string>();
    const uniqueRows = rows.filter((r) => {
      if (seen.has(r.assetId)) return false;
      seen.add(r.assetId);
      return true;
    });

    return uniqueRows.map((row) => ({
      id: row.id,
      sessionId: row.sessionId,
      assetId: row.assetId,
      status: row.status,
      condition: row.condition,
      notes: row.notes,
      scannedAt: row.scannedAt,
      createdAt: row.updatedAt,
      synced: row.synced,
      asset: {
        id: row.assetId,
        name: row.assetName,
        assetCode: row.assetCode,
        sapAssetCode: row.sapAssetCode,
        serialNumber: row.serialNumber,
        model: row.model,
        qrCode: row.qrCode,
      },
      expectedLocation: row.expectedLocationName
        ? {
            id: row.expectedLocationId || '',
            name: row.expectedLocationName,
            code: row.expectedLocationCode || undefined,
          }
        : null,
      foundLocation: row.foundLocationName
        ? {
            id: row.foundLocationId || '',
            name: row.foundLocationName,
            code: row.foundLocationCode || undefined,
          }
        : null,
      discrepancy:
        row.status === 'LOCATION_MISMATCH' ||
        row.status === 'DAMAGED' ||
        (row.expectedLocationId &&
          row.foundLocationId &&
          row.expectedLocationId !== row.foundLocationId)
          ? {
              id: `disc_${row.id}`,
              discrepancyType: row.status === 'DAMAGED' ? 'DAMAGED' : 'LOCATION_MISMATCH',
            }
          : null,
    }));
  } catch (err) {
    console.warn('[db] Error in getSessionAuditItems:', err);
    return [];
  }
}

export async function recordSessionItemScan(
  sessionId: string,
  assetCodeOrId: string,
  scanData: {
    status?: string;
    condition?: string;
    notes?: string;
    locationId?: string;
    locationName?: string;
    locationCode?: string;
    planId?: string;
  },
): Promise<{ success: boolean; isDuplicate?: boolean; item?: any; message: string }> {
  if (!sessionId || !assetCodeOrId) {
    return { success: false, message: 'Invalid session or asset code' };
  }

  try {
    const db = await getDatabase();
    const asset = await findCachedAsset(assetCodeOrId);
    if (!asset) {
      return { success: false, message: `Asset "${assetCodeOrId}" not found in local catalog` };
    }

    // 1. Check if this item has ALREADY been scanned in the current session
    const existing = await db.getFirstAsync<{ id: string; status: string; scannedAt: string | null }>(
      'SELECT id, status, scannedAt FROM session_audit_items WHERE sessionId = ? AND assetId = ? LIMIT 1;',
      [sessionId, asset.id],
    );

    if (existing && existing.status !== 'PENDING' && existing.scannedAt) {
      return {
        success: false,
        isDuplicate: true,
        item: {
          ...asset,
          status: existing.status,
          scannedAt: existing.scannedAt,
        },
        message: `DUPLICATE SCAN: Asset "${asset.assetCode}" (${asset.name}) has ALREADY been audited in this session at ${new Date(existing.scannedAt).toLocaleTimeString()}.\n\nDuplicate scans are rejected and NOT saved.`,
      };
    }

    // 2. Check if this item has already been audited in any other session within the same audit plan
    let planId = scanData.planId;
    if (!planId) {
      const sessRow = await db.getFirstAsync<{ planId: string }>(
        'SELECT planId FROM audit_sessions WHERE id = ? LIMIT 1;',
        [sessionId],
      );
      if (sessRow?.planId) {
        planId = sessRow.planId;
      }
    }

    if (planId) {
      const existingInPlan = await db.getFirstAsync<{
        id: string;
        sessionId: string;
        foundLocationName: string | null;
        sessionLocationName: string | null;
        scannedAt: string | null;
      }>(
        `SELECT sai.id, sai.sessionId, sai.foundLocationName, s.locationName as sessionLocationName, sai.scannedAt 
         FROM session_audit_items sai
         LEFT JOIN audit_sessions s ON s.id = sai.sessionId
         WHERE (s.planId = ? OR sai.sessionId IN (SELECT id FROM audit_sessions WHERE planId = ?))
           AND (s.status IS NULL OR s.status != 'CANCELLED')
           AND sai.assetId = ? 
           AND sai.sessionId != ? 
           AND sai.scannedAt IS NOT NULL 
           AND sai.status != 'PENDING'
         LIMIT 1;`,
        [planId, planId, asset.id, sessionId],
      );

      if (existingInPlan) {
        const stationName =
          existingInPlan.foundLocationName ||
          existingInPlan.sessionLocationName ||
          'another station';
        return {
          success: false,
          isDuplicate: true,
          item: {
            ...asset,
            scannedAt: existingInPlan.scannedAt,
            locationName: stationName,
          },
          message: `DUPLICATE SCAN: Asset "${asset.assetCode}" (${asset.name}) was ALREADY scanned in this audit plan at station "${stationName}".\n\nDuplicate scans are rejected and NOT saved.`,
        };
      }
    }

    const now = new Date().toISOString();
    const condition = scanData.condition || asset.condition || 'GOOD';
    const targetLocationId = scanData.locationId || asset.locationId;
    const isMismatch = Boolean(
      asset.locationId && targetLocationId && asset.locationId !== targetLocationId,
    );

    let finalStatus = 'VERIFIED';
    if (condition === 'DAMAGED') {
      finalStatus = 'DAMAGED';
    } else if (isMismatch) {
      finalStatus = 'LOCATION_MISMATCH';
    }

    const itemId =
      existing?.id || `local_item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    if (existing) {
      await db.runAsync(
        `UPDATE session_audit_items SET
           status = ?,
           condition = ?,
           notes = ?,
           foundLocationId = ?,
           foundLocationName = ?,
           foundLocationCode = ?,
           scannedAt = ?,
           synced = 0,
           updatedAt = ?
         WHERE sessionId = ? AND assetId = ?;`,
        [
          finalStatus,
          condition,
          scanData.notes ||
            (isMismatch
              ? `Station mismatch: Found at ${scanData.locationName || targetLocationId} (Assigned: ${asset.locationName || 'Unassigned'})`
              : null),
          targetLocationId || null,
          scanData.locationName || null,
          scanData.locationCode || null,
          now,
          now,
          sessionId,
          asset.id,
        ],
      );
    } else {
      await db.runAsync(
        `INSERT INTO session_audit_items (
           id, sessionId, assetId, assetCode, assetName, sapAssetCode,
           serialNumber, model, qrCode, status, condition, notes,
           expectedLocationId, expectedLocationName, expectedLocationCode,
           foundLocationId, foundLocationName, foundLocationCode,
           scannedAt, synced, updatedAt
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
         ON CONFLICT(sessionId, assetId) DO UPDATE SET
           status = excluded.status,
           condition = excluded.condition,
           notes = excluded.notes,
           foundLocationId = excluded.foundLocationId,
           foundLocationName = excluded.foundLocationName,
           foundLocationCode = excluded.foundLocationCode,
           scannedAt = excluded.scannedAt,
           synced = 0,
           updatedAt = excluded.updatedAt;`,
        [
          itemId,
          sessionId,
          asset.id,
          asset.assetCode,
          asset.name,
          asset.sapAssetCode || null,
          asset.serialNumber || null,
          asset.model || null,
          asset.qrCode || null,
          finalStatus,
          condition,
          scanData.notes ||
            (isMismatch
              ? `Station mismatch: Found at ${scanData.locationName || targetLocationId} (Assigned: ${asset.locationName || 'Unassigned'})`
              : null),
          asset.locationId || null,
          asset.locationName || null,
          null,
          targetLocationId || null,
          scanData.locationName || null,
          scanData.locationCode || null,
          now,
          now,
        ],
      );
    }

    // Also persist to offline_audits outbox table so live sync or background flush uploads to server
    const outboxStatus =
      condition === 'DAMAGED' ? 'DAMAGED' : isMismatch ? 'LOCATION_MISMATCH' : 'FOUND';

    await recordOfflineAudit({
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      assetId: asset.id,
      assetCode: asset.assetCode,
      scannedCode: assetCodeOrId,
      status: outboxStatus,
      verifiedLocationId: targetLocationId || null,
      sessionId,
      planId: scanData.planId || null,
      notes:
        scanData.notes ||
        (isMismatch
          ? `Relocated to ${scanData.locationName || targetLocationId}`
          : `Station audit verified at ${scanData.locationName || 'session'}`),
      auditedAt: now,
    });

    return {
      success: true,
      message: isMismatch
        ? `⚠️ ${asset.assetCode} verified & relocated to ${scanData.locationName || 'station'}`
        : `✅ ${asset.assetCode} verified in session`,
      item: {
        id: itemId,
        assetId: asset.id,
        assetCode: asset.assetCode,
        status: finalStatus,
        condition,
        isMismatch,
      },
    };
  } catch (err: any) {
    console.warn('[db] Error in recordSessionItemScan:', err);
    return { success: false, message: err?.message || 'Failed to record scan' };
  }
}

export async function markSessionItemSynced(
  sessionId: string,
  assetId: string,
): Promise<void> {
  if (!sessionId || !assetId) return;
  try {
    const db = await getDatabase();
    await db.runAsync(
      'UPDATE session_audit_items SET synced = 1 WHERE sessionId = ? AND assetId = ?;',
      [sessionId, assetId],
    );
  } catch (err) {
    console.warn('[db] Error in markSessionItemSynced:', err);
  }
}

export async function updateLocalItemAfterTransferFinalized(
  sessionId: string,
  assetId: string,
  newLocationId?: string,
  newLocationName?: string,
): Promise<void> {
  if (!sessionId || !assetId) return;
  try {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE session_audit_items 
       SET status = CASE WHEN condition = 'DAMAGED' THEN 'DAMAGED' ELSE 'VERIFIED' END,
           expectedLocationId = COALESCE(?, foundLocationId, expectedLocationId),
           expectedLocationName = COALESCE(?, foundLocationName, expectedLocationName),
           updatedAt = ?
       WHERE sessionId = ? AND assetId = ?;`,
      [newLocationId || null, newLocationName || null, new Date().toISOString(), sessionId, assetId],
    );
  } catch (err) {
    console.warn('[db] Error in updateLocalItemAfterTransferFinalized:', err);
  }
}

export async function updateLocalItemStatus(
  sessionId: string,
  itemIdOrAssetId: string,
  newStatus: string,
): Promise<void> {
  if (!sessionId || !itemIdOrAssetId) return;
  try {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE session_audit_items
       SET status = ?, updatedAt = ?
       WHERE sessionId = ? AND (id = ? OR assetId = ?);`,
      [newStatus, new Date().toISOString(), sessionId, itemIdOrAssetId, itemIdOrAssetId],
    );
  } catch (err) {
    console.warn('[db] Error in updateLocalItemStatus:', err);
  }
}

export async function markLocalSessionUnscannedAsMissing(
  sessionId: string,
): Promise<void> {
  if (!sessionId) return;
  try {
    const db = await getDatabase();
    await db.runAsync(
      `UPDATE session_audit_items
       SET status = 'MISSING', updatedAt = ?
       WHERE sessionId = ? AND status = 'PENDING';`,
      [new Date().toISOString(), sessionId],
    );
  } catch (err) {
    console.warn('[db] Error in markLocalSessionUnscannedAsMissing:', err);
  }
}




