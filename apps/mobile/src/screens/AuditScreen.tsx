import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ScannerView } from '../components/ScannerView';
import {
  findCachedAsset,
  getAllCachedLocations,
  CachedAsset,
  CachedLocation,
  recordOfflineAudit,
  recordSessionItemScan,
  getAssetCount,
  getAllCachedSessions,
  saveCachedSessions,
} from '../database/db';
import { apiRequest } from '../services/api';
import { storage } from '../services/storage';
import { useAuth } from '../context/AuthContext';
import {
  triggerLiveSync,
  getSyncSummary,
  isOutboxSyncing,
  subscribeOutboxChanges,
} from '../services/syncManager';
import { theme } from '../config/theme';

export interface AuditSessionRecord {
  id: string;
  planId: string;
  auditorId: string;
  locationId?: string | null;
  status: string;
  startedAt?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  plan?: { id: string; name: string; type: string; status: string };
  auditor?: { id: string; name: string; email: string };
  location?: { id: string; name: string; code?: string; type?: string; fullPath?: string } | null;
  _count?: { items: number; discrepancies: number };
}

interface AuditPlan {
  id: string;
  name: string;
  status: string;
  type: string;
}

interface ScannedAuditItem extends CachedAsset {
  scannedAt: string;
  isLocationMismatch: boolean;
  selectedCondition: string;
}

export const AuditScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isOfflineMode, isOnline, user } = useAuth();

  // View state: 'sessions' (default list of all audit sessions) vs 'station_audit' (live workstation scanner)
  const [currentView, setCurrentView] = useState<'sessions' | 'station_audit'>('sessions');

  // Sessions list state
  const [sessions, setSessions] = useState<AuditSessionRecord[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [isRefreshingSessions, setIsRefreshingSessions] = useState(false);
  const [sessionStatusFilter, setSessionStatusFilter] = useState<'ALL' | 'IN_PROGRESS' | 'COMPLETED'>('ALL');
  const [selectedSession, setSelectedSession] = useState<AuditSessionRecord | null>(null);

  // Audit plan state
  const [plans, setPlans] = useState<AuditPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<AuditPlan | null>(null);

  // Active station state
  const [locations, setLocations] = useState<CachedLocation[]>([]);
  const [activeStation, setActiveStation] = useState<CachedLocation | null>(null);

  // Scanned items in current station session
  const [scannedItems, setScannedItems] = useState<ScannedAuditItem[]>([]);
  const [isCommitting, setIsCommitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Outbox live sync state
  const [outboxCount, setOutboxCount] = useState<number>(0);
  const [isSyncingOutbox, setIsSyncingOutbox] = useState<boolean>(false);

  const refreshOutboxStatus = useCallback(async () => {
    try {
      const summary = await getSyncSummary();
      setOutboxCount(summary.totalOutboxCount);
      setIsSyncingOutbox(isOutboxSyncing());
    } catch { }
  }, []);

  // Refresh sessions on screen focus
  useFocusEffect(
    useCallback(() => {
      loadSessions();
      loadInitialData();
      refreshOutboxStatus();
    }, [isOfflineMode, refreshOutboxStatus]),
  );

  useEffect(() => {
    refreshOutboxStatus();
    const unsub = subscribeOutboxChanges(() => {
      refreshOutboxStatus();
    });
    return () => unsub();
  }, [refreshOutboxStatus]);

  const handleManualSyncPress = async () => {
    if (isOfflineMode) {
      Alert.alert(
        'Offline Mode Active',
        'Device is currently operating offline. Scans are saved in local SQLite storage and will synchronize automatically once reconnected.',
      );
      return;
    }

    if (outboxCount === 0) {
      Alert.alert('Cloud Synced', 'All audit scans are already synchronized with the server.');
      return;
    }

    setIsSyncingOutbox(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    }

    try {
      const res = await triggerLiveSync({ force: true });
      await refreshOutboxStatus();
      if (res.success && res.totalUploaded > 0) {
        Alert.alert('Sync Successful', `Synchronized ${res.totalUploaded} records with the cloud server.`);
      } else if (res.success) {
        Alert.alert('Sync Status', 'All records are up to date.');
      } else {
        Alert.alert('Sync Queued', 'Could not reach server. Data remains securely saved in local SQLite.');
      }
    } catch {
      Alert.alert('Sync Error', 'An error occurred during synchronization.');
    } finally {
      setIsSyncingOutbox(false);
    }
  };

  useEffect(() => {
    if (route.params?.initialLocation || route.params?.initialSession) {
      const sess = route.params?.initialSession;
      const loc = route.params?.initialLocation;

      if (sess) {
        setSelectedSession(sess);
        if (sess.plan) {
          setSelectedPlan({
            id: sess.plan.id,
            name: sess.plan.name,
            status: sess.plan.status,
            type: sess.plan.type,
          });
        }
      }

      if (loc) {
        setActiveStation(loc);
        setStatusMessage(
          `Checked in to Station: ${loc.name} (${loc.code})`,
        );
      }

      setScannedItems([]);
      setCurrentView('station_audit');
    }
  }, [route.params?.initialLocation, route.params?.initialSession]);

  useEffect(() => {
    return () => {
      navigation.setOptions({ tabBarStyle: undefined });
      navigation.getParent()?.setOptions({ tabBarStyle: undefined });
    };
  }, [navigation]);

  const handleCameraActiveChange = (isActive: boolean) => {
    const tabStyle = isActive ? { display: 'none' } : undefined;
    navigation.setOptions({ tabBarStyle: tabStyle });
    navigation.getParent()?.setOptions({ tabBarStyle: tabStyle });
  };

  const loadSessions = async (isRefresh = false) => {
    if (isRefresh) {
      setIsRefreshingSessions(true);
    }

    try {
      // 1. INSTANT LOAD: Load cached sessions from SQLite immediately (0ms, no network delay)
      const cached = await getAllCachedSessions();
      if (cached && cached.length > 0) {
        setSessions(cached);
        setIsLoadingSessions(false);

        // 2. BACKGROUND REVALIDATE: Fire-and-forget in background without blocking screen render
        if (!isOfflineMode) {
          apiRequest<{ data: AuditSessionRecord[] } | AuditSessionRecord[]>(
            '/audits/sessions?limit=30',
            { timeoutMs: 5000 },
          )
            .then(async (response) => {
              const list = Array.isArray(response) ? response : response?.data || [];
              if (list.length > 0) {
                setSessions(list);
                await saveCachedSessions(list);
              }
            })
            .catch((err) => {
              console.warn('[AuditScreen] Background fetch error:', err);
            })
            .finally(() => {
              if (isRefresh) setIsRefreshingSessions(false);
            });
        }
        return;
      }

      // 3. Fallback: If local database has 0 cached sessions, fetch from API with shorter timeout
      if (!isRefresh && sessions.length === 0) {
        setIsLoadingSessions(true);
      }

      if (!isOfflineMode) {
        const response = await apiRequest<{ data: AuditSessionRecord[] } | AuditSessionRecord[]>(
          '/audits/sessions?limit=30',
          { timeoutMs: 5000 },
        ).catch((err) => {
          console.warn('[AuditScreen] Initial sessions fetch error:', err);
          return null;
        });

        if (response) {
          const list = Array.isArray(response) ? response : response?.data || [];
          if (list.length > 0) {
            setSessions(list);
            await saveCachedSessions(list);
          }
        }
      }
    } catch (e) {
      console.warn('[AuditScreen] Error in loadSessions:', e);
    } finally {
      setIsLoadingSessions(false);
      setIsRefreshingSessions(false);
    }
  };

  const loadInitialData = async () => {
    // 1. Load cached locations from SQLite (instant)
    try {
      const cachedLocs = await getAllCachedLocations();
      setLocations(cachedLocs);
    } catch (e) {
      console.warn('[AuditScreen] Error loading locations:', e);
    }

    // 2. Load cached plans from storage (instant 0ms)
    try {
      const cachedPlans = await storage.getObject<AuditPlan[]>('CACHED_AUDIT_PLANS');
      if (cachedPlans && cachedPlans.length > 0) {
        setPlans(cachedPlans);
        const active = cachedPlans.find((p) => p.status === 'IN_PROGRESS' || p.status === 'PUBLISHED');
        if (active) {
          setSelectedPlan(active);
        } else {
          setSelectedPlan(cachedPlans[0]);
        }
      }
    } catch { }

    // 3. Revalidate plans from API if online
    if (!isOfflineMode) {
      try {
        const response = await apiRequest<{ data: AuditPlan[] } | AuditPlan[]>('/audits/plans');
        const planList = Array.isArray(response) ? response : response?.data || [];
        if (planList.length > 0) {
          setPlans(planList);
          storage.setObject('CACHED_AUDIT_PLANS', planList).catch(() => { });

          const active = planList.find((p) => p.status === 'IN_PROGRESS' || p.status === 'PUBLISHED');
          if (active) {
            setSelectedPlan(active);
          } else if (planList.length > 0) {
            setSelectedPlan(planList[0]);
          }
        }
      } catch (e) {
        console.warn('[AuditScreen] Error fetching plans:', e);
      }
    }
  };

  const handleSelectSession = (session: AuditSessionRecord) => {
    // Navigate to Session Inventory Page (similar to web app checklist)
    navigation.navigate('SessionInventory' as any, {
      sessionId: session.id,
      session,
    });
  };

  const handleStartNewSession = () => {
    setSelectedSession(null);
    setActiveStation(null);
    setScannedItems([]);
    setStatusMessage('Scan station placard QR (e.g. BLOCK-C) to begin line check.');
    setCurrentView('station_audit');
  };

  const handleScan = async (code: string) => {
    setStatusMessage(null);
    const cleanCode = code.trim();

    // ── Check if scanned code is a Station Placard ──────────────────────────────
    const matchedLoc = locations.find(
      (loc) =>
        loc.code.toUpperCase() === cleanCode.toUpperCase() ||
        loc.id === cleanCode ||
        loc.name.toUpperCase() === cleanCode.toUpperCase(),
    );

    if (matchedLoc) {
      if (activeStation && activeStation.id === matchedLoc.id && scannedItems.length > 0) {
        Alert.alert(
          'Re-scanned Station Placard',
          `Commit ${scannedItems.length} audited items for ${activeStation.name}?`,
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Commit Batch', onPress: handleCommitStation },
          ],
        );
        return;
      }

      if (activeStation && activeStation.id !== matchedLoc.id && scannedItems.length > 0) {
        Alert.alert(
          'Switch Station',
          `You have ${scannedItems.length} uncommitted tags at ${activeStation.name}. Commit them before switching?`,
          [
            {
              text: 'Discard & Switch',
              style: 'destructive',
              onPress: () => {
                setActiveStation(matchedLoc);
                setScannedItems([]);
              },
            },
            {
              text: 'Save & Switch',
              onPress: async () => {
                await handleCommitStation();
                setActiveStation(matchedLoc);
              },
            },
          ],
        );
        return;
      }

      setActiveStation(matchedLoc);
      setStatusMessage(`Checked in to Station: ${matchedLoc.name} (${matchedLoc.code})`);
      return;
    }

    // ── Equipment Tag Scanned ───────────────────────────────────────────────────
    let currentStation = activeStation;
    if (!currentStation && selectedSession?.location) {
      currentStation = {
        id: selectedSession.location.id,
        name: selectedSession.location.name,
        code: selectedSession.location.code || 'ZONE',
        type: selectedSession.location.type || 'STATION',
        parentId: null,
        fullPath: selectedSession.location.name,
      };
      setActiveStation(currentStation);
    }

    if (!currentStation) {
      Alert.alert(
        'Scan Station First',
        'Please scan a station placard QR (e.g. BLOCK-C, Line 1) before scanning equipment.',
      );
      return;
    }

    if (scannedItems.some((item) => item.assetCode === cleanCode || item.sapAssetCode === cleanCode)) {
      setStatusMessage(`⚠️ Tag ${cleanCode} already in current station batch.`);
      return;
    }

    const asset = await findCachedAsset(cleanCode);

    if (!asset) {
      const dbCount = await getAssetCount();
      if (dbCount === 0) {
        Alert.alert(
          'Database Empty',
          'Local database has 0 cached assets. Please run offline catalog sync from the Dashboard first.',
        );
      } else {
        Alert.alert('Tag Not Found', `No asset found in local database matching "${cleanCode}".`);
      }
      return;
    }

    const isLocationMismatch = asset.locationId !== currentStation.id;

    // Differentiated Tactile Pulse based on condition & relocation status
    if (Platform.OS !== 'web') {
      if (asset.condition === 'DAMAGED') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => { });
      } else if (isLocationMismatch) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => { });
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
      }
    }

    const newItem: ScannedAuditItem = {
      ...asset,
      scannedAt: new Date().toISOString(),
      isLocationMismatch,
      selectedCondition: asset.condition || 'GOOD',
    };

    setScannedItems((prev) => [newItem, ...prev]);

    // ── Immediate Real-Time Auto-Commit to Session Inventory ────────────────────
    const currentSessionId = selectedSession?.id;
    const currentPlanId = selectedPlan?.id || selectedSession?.planId;
    const auditStatus = isLocationMismatch ? 'LOCATION_MISMATCH' : 'FOUND';

    // 1. Always record in Local SQLite Database immediately (offline-first)
    if (currentSessionId) {
      await recordSessionItemScan(currentSessionId, cleanCode, {
        status: isLocationMismatch ? 'LOCATION_MISMATCH' : 'VERIFIED',
        condition: newItem.selectedCondition,
        locationId: currentStation.id,
        locationName: currentStation.name,
        locationCode: currentStation.code,
        planId: currentPlanId,
        notes: isLocationMismatch
          ? `Station audit mismatch at ${currentStation.name} (Assigned: ${asset.locationName || 'Unassigned'})`
          : `Station audit verified at ${currentStation.name}`,
      });
    } else {
      await recordOfflineAudit({
        id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        assetId: asset.id,
        assetCode: asset.assetCode,
        scannedCode: cleanCode,
        status: auditStatus,
        verifiedLocationId: currentStation.id,
        sessionId: currentSessionId,
        planId: currentPlanId,
        notes: isLocationMismatch
          ? `Station audit mismatch at ${currentStation.name}`
          : `Station audit verified at ${currentStation.name}`,
        auditedAt: newItem.scannedAt,
      });
    }

    refreshOutboxStatus();

    // 2. If online, sync immediately to backend
    if (!isOfflineMode) {
      try {
        if (currentSessionId) {
          await apiRequest(`/audits/sessions/${currentSessionId}/items`, {
            method: 'POST',
            body: JSON.stringify({
              assetId: asset.id,
              status: 'VERIFIED',
              condition: newItem.selectedCondition,
              foundLocationId: currentStation.id,
              notes: isLocationMismatch
                ? `Station audit mismatch at ${currentStation.name} (Assigned: ${asset.locationName || 'Unassigned'})`
                : `Station audit verified at ${currentStation.name}`,
            }),
            timeoutMs: 6000,
          });
        } else {
          await apiRequest('/audits/quick-scan', {
            method: 'POST',
            body: JSON.stringify({
              assetId: asset.id,
              scannedCode: cleanCode,
              status: auditStatus,
              verifiedLocationId: currentStation.id,
              sessionId: currentSessionId,
              planId: currentPlanId,
              notes: isLocationMismatch
                ? `Station audit mismatch at ${currentStation.name}`
                : `Station audit verified at ${currentStation.name}`,
              auditedAt: newItem.scannedAt,
            }),
            timeoutMs: 6000,
          });
        }

        setStatusMessage(
          isLocationMismatch
            ? `⚠️ ${asset.assetCode} verified & recorded (Relocated to ${currentStation.name})`
            : `✅ ${asset.assetCode} verified & recorded in session inventory`,
        );
      } catch (liveErr) {
        console.warn('[AuditScreen] Live scan submit failed, saved locally in SQLite outbox:', liveErr);
        triggerLiveSync().catch(() => { });
        setStatusMessage(`💾 ${asset.assetCode} recorded locally in SQLite (sync queued)`);
      }
    } else {
      triggerLiveSync().catch(() => { });
      setStatusMessage(`💾 ${asset.assetCode} saved locally in SQLite (will sync when online)`);
    }
  };

  const handleUpdateCondition = (index: number, condition: string) => {
    setScannedItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], selectedCondition: condition };
      return copy;
    });
  };

  const handleRemoveItem = (index: number) => {
    setScannedItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCommitStation = async () => {
    if (!activeStation || scannedItems.length === 0) return;

    setIsCommitting(true);
    const count = scannedItems.length;
    const stationName = activeStation.name;

    try {
      const payload = {
        locationId: activeStation.id,
        auditorId: user?.id || 'admin',
        items: scannedItems.map((item) => ({
          assetId: item.id,
          condition: item.selectedCondition,
          notes: item.isLocationMismatch
            ? `Location Mismatch: Assigned to ${item.locationName || 'Unassigned'}`
            : undefined,
        })),
      };

      let directCommitSucceeded = false;

      if (!isOfflineMode && selectedPlan) {
        try {
          await apiRequest(`/audits/plans/${selectedPlan.id}/commit-location`, {
            method: 'POST',
            body: JSON.stringify(payload),
            timeoutMs: 8000,
          });
          directCommitSucceeded = true;
        } catch (netErr) {
          console.warn('[AuditScreen] Direct commit failed, falling back to SQLite:', netErr);
        }
      }

      if (!directCommitSucceeded) {
        const now = new Date().toISOString();
        for (const item of scannedItems) {
          await recordOfflineAudit({
            id: `audit_batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            assetId: item.id,
            assetCode: item.assetCode,
            scannedCode: item.assetCode,
            status: item.isLocationMismatch ? 'LOCATION_MISMATCH' : 'FOUND',
            verifiedLocationId: activeStation.id,
            sessionId: selectedSession?.id,
            planId: selectedPlan?.id || selectedSession?.planId,
            notes: `Station Batch (${item.selectedCondition})`,
            auditedAt: now,
          });
        }
        triggerLiveSync().catch(() => { });
      }

      Alert.alert(
        'Station Audit Saved',
        `Successfully committed ${count} equipment tag${count > 1 ? 's' : ''} at ${stationName}!`,
      );

      setScannedItems([]);
      setActiveStation(null);
      setStatusMessage(`Completed audit for ${stationName} (${count} items).`);
      loadSessions();
    } catch (err: any) {
      Alert.alert('Commit Error', err?.message || 'Failed to save audit.');
    } finally {
      setIsCommitting(false);
    }
  };

  const filteredSessions = sessions.filter((s) => {
    if (sessionStatusFilter === 'ALL') return true;
    if (sessionStatusFilter === 'IN_PROGRESS') return s.status === 'IN_PROGRESS' || s.status === 'NOT_STARTED';
    if (sessionStatusFilter === 'COMPLETED') return s.status === 'COMPLETED';
    return true;
  });

  const inProgressCount = sessions.filter((s) => s.status === 'IN_PROGRESS' || s.status === 'NOT_STARTED').length;
  const completedCount = sessions.filter((s) => s.status === 'COMPLETED').length;
  const totalAuditedItems = sessions.reduce((acc, s) => acc + (s._count?.items ?? 0), 0);

  const renderSessionCard = (session: AuditSessionRecord) => {
    const isCompleted = session.status === 'COMPLETED';
    const isInProgress = session.status === 'IN_PROGRESS';
    const locationName = session.location?.name || 'Unassigned Factory Station';
    const locationCode = session.location?.code;
    const planName = session.plan?.name || 'General Factory Inventory';
    const auditorName = session.auditor?.name || 'Factory Auditor';
    const itemCount = session._count?.items ?? 0;
    const discrepancyCount = session._count?.discrepancies ?? 0;
    const timeFormatted = session.startedAt
      ? new Date(session.startedAt).toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
      : new Date(session.createdAt).toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
      });

    return (
      <TouchableOpacity
        key={session.id}
        style={styles.sessionCard}
        onPress={() => handleSelectSession(session)}
        activeOpacity={0.85}
      >
        <View style={styles.sessionCardHeader}>
          <View style={styles.sessionLocationCol}>
            <View style={styles.locationTitleRow}>
              <Ionicons name="location" size={16} color={theme.colors.primary} />
              <Text style={styles.sessionLocationName}>{locationName}</Text>
            </View>
            {locationCode && <Text style={styles.sessionLocationCode}>Line: {locationCode}</Text>}
          </View>

          <View
            style={[
              styles.sessionStatusBadge,
              isInProgress && styles.sessionStatusInProgress,
              isCompleted && styles.sessionStatusCompleted,
            ]}
          >
            <Text
              style={[
                styles.sessionStatusBadgeText,
                isInProgress && styles.sessionStatusTextInProgress,
                isCompleted && styles.sessionStatusTextCompleted,
              ]}
            >
              {session.status}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.sessionPlanRow}
          onPress={(e) => {
            e.stopPropagation();
            navigation.navigate('AuditDetail' as any, {
              planId: session.planId,
              planName: session.plan?.name,
            });
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="clipboard-outline" size={13} color={theme.colors.primary} />
          <Text style={[styles.sessionPlanText, { color: theme.colors.primary, fontWeight: '600' }]} numberOfLines={1}>
            Plan: {planName} ➔
          </Text>
        </TouchableOpacity>

        <View style={styles.sessionAuditorRow}>
          <Ionicons name="person-outline" size={13} color={theme.colors.textMuted} />
          <Text style={styles.sessionAuditorText}>Auditor: {auditorName}</Text>
          <Text style={styles.sessionDateText}>• {timeFormatted}</Text>
        </View>

        <View style={styles.sessionFooterRow}>
          <View style={styles.sessionCounters}>
            <View style={styles.counterBadge}>
              <Text style={styles.counterText}>📦 {itemCount} Items</Text>
            </View>
            {discrepancyCount > 0 && (
              <View style={styles.discrepancyBadge}>
                <Text style={styles.discrepancyText}>⚠️ {discrepancyCount} Issues</Text>
              </View>
            )}
          </View>

          <View style={styles.resumeAction}>
            <Text style={styles.resumeActionText}>View Session ➔</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {currentView === 'sessions' ? (
        /* ── All Current Audit Sessions Screen ────────────────────────────────── */
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={isRefreshingSessions}
              onRefresh={() => loadSessions(true)}
              colors={[theme.colors.primary]}
            />
          }
        >
          {/* Top Navbar Header */}
          <View style={styles.sessionsHeader}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.title}>Audit Sessions</Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {filteredSessions.length} active sessions across factory floor
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <TouchableOpacity
                style={[
                  styles.syncPill,
                  !isOnline
                    ? styles.syncPillOffline
                    : outboxCount > 0
                      ? styles.syncPillPending
                      : styles.syncPillSynced,
                ]}
                onPress={handleManualSyncPress}
                activeOpacity={0.7}
              >
                {isSyncingOutbox ? (
                  <ActivityIndicator
                    size={10}
                    color={!isOnline ? '#dc2626' : outboxCount > 0 ? '#b45309' : '#15803d'}
                    style={{ marginRight: 4 }}
                  />
                ) : (
                  <Ionicons
                    name={!isOnline ? 'cloud-offline' : outboxCount > 0 ? 'cloud-upload' : 'cloud-done'}
                    size={12}
                    color={!isOnline ? '#dc2626' : outboxCount > 0 ? '#b45309' : '#15803d'}
                    style={{ marginRight: 4 }}
                  />
                )}
                <Text
                  style={[
                    styles.syncPillText,
                    !isOnline
                      ? styles.syncPillTextOffline
                      : outboxCount > 0
                        ? styles.syncPillTextPending
                        : styles.syncPillTextSynced,
                  ]}
                >
                  {!isOnline
                    ? outboxCount > 0
                      ? `${outboxCount} Offline`
                      : 'Offline'
                    : outboxCount > 0
                      ? `${outboxCount} Pending`
                      : 'Synced'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.newSessionBtn}
                onPress={handleStartNewSession}
                activeOpacity={0.8}
              >
                <Ionicons name="scan-outline" size={15} color="#ffffff" style={{ marginRight: 4 }} />
                <Text style={styles.newSessionBtnText}>Check-in</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* KPI Summary Row */}
          <View style={styles.sessionsKpiRow}>
            <View style={styles.sessionKpiCard}>
              <Text style={styles.sessionKpiVal}>{sessions.length}</Text>
              <Text style={styles.sessionKpiLabel}>Total Sessions</Text>
            </View>
            <View style={styles.sessionKpiCard}>
              <Text style={[styles.sessionKpiVal, { color: theme.colors.success }]}>
                {inProgressCount}
              </Text>
              <Text style={styles.sessionKpiLabel}>In Progress</Text>
            </View>
            <View style={styles.sessionKpiCard}>
              <Text style={[styles.sessionKpiVal, { color: theme.colors.primary }]}>
                {totalAuditedItems}
              </Text>
              <Text style={styles.sessionKpiLabel}>Audited Items</Text>
            </View>
          </View>

          {/* Filter Pills */}
          <View style={styles.filterRow}>
            {(['ALL', 'IN_PROGRESS', 'COMPLETED'] as const).map((tab) => {
              const active = sessionStatusFilter === tab;
              const label =
                tab === 'ALL'
                  ? `All (${sessions.length})`
                  : tab === 'IN_PROGRESS'
                    ? `In Progress (${inProgressCount})`
                    : `Completed (${completedCount})`;
              return (
                <TouchableOpacity
                  key={tab}
                  style={[styles.sessionFilterPill, active && styles.sessionFilterPillActive]}
                  onPress={() => setSessionStatusFilter(tab)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.sessionFilterPillText,
                      active && styles.sessionFilterPillTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Session Cards List */}
          {isLoadingSessions ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={styles.loadingText}>Loading audit sessions...</Text>
            </View>
          ) : filteredSessions.length === 0 ? (
            <View style={styles.emptySessionBox}>
              <Ionicons name="clipboard-outline" size={48} color={theme.colors.textMuted} />
              <Text style={styles.emptySessionTitle}>No Audit Sessions Found</Text>
              <Text style={styles.emptySessionSub}>
                {sessionStatusFilter === 'ALL'
                  ? 'There are currently no active audit sessions. Check in to a factory station to start one.'
                  : `No sessions found with status "${sessionStatusFilter}".`}
              </Text>
              <TouchableOpacity
                style={styles.emptyActionBtn}
                onPress={handleStartNewSession}
                activeOpacity={0.85}
              >
                <Text style={styles.emptyActionBtnText}>+ Start Station Check-in</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredSessions.map((session) => renderSessionCard(session))
          )}
        </ScrollView>
      ) : (
        /* ── Station Floor Audit Workstation View ─────────────────────────────── */
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Top Navigation Row: Back to Sessions */}
          <View style={styles.stationAuditNavBar}>
            <TouchableOpacity
              style={styles.backToSessionsBtn}
              onPress={() => {
                setCurrentView('sessions');
                loadSessions();
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back" size={18} color={theme.colors.primary} />
              <Text style={styles.backToSessionsText}>All Sessions</Text>
            </TouchableOpacity>

            <Text style={styles.activeStationTitle} numberOfLines={1}>
              {activeStation?.name || 'Station Workstation'}
            </Text>

            <TouchableOpacity
              style={[
                styles.syncPill,
                !isOnline
                  ? styles.syncPillOffline
                  : outboxCount > 0
                    ? styles.syncPillPending
                    : styles.syncPillSynced,
              ]}
              onPress={handleManualSyncPress}
              activeOpacity={0.7}
            >
              {isSyncingOutbox ? (
                <ActivityIndicator
                  size={10}
                  color={!isOnline ? '#dc2626' : outboxCount > 0 ? '#b45309' : '#15803d'}
                  style={{ marginRight: 4 }}
                />
              ) : (
                <Ionicons
                  name={!isOnline ? 'cloud-offline' : outboxCount > 0 ? 'cloud-upload' : 'cloud-done'}
                  size={12}
                  color={!isOnline ? '#dc2626' : outboxCount > 0 ? '#b45309' : '#15803d'}
                  style={{ marginRight: 4 }}
                />
              )}
              <Text
                style={[
                  styles.syncPillText,
                  !isOnline
                    ? styles.syncPillTextOffline
                    : outboxCount > 0
                      ? styles.syncPillTextPending
                      : styles.syncPillTextSynced,
                ]}
              >
                {!isOnline
                  ? outboxCount > 0
                    ? `${outboxCount} Offline`
                    : 'Offline'
                  : outboxCount > 0
                    ? `${outboxCount} Pending`
                    : 'Synced'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Screen Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Station Floor Audit</Text>
            <Text style={styles.subtitle}>
              Scan line placard, audit station equipment & report mismatches
            </Text>
          </View>

          {/* Status Message Banner */}
          {statusMessage && (
            <View style={styles.statusBanner}>
              <Text style={styles.statusBannerText}>{statusMessage}</Text>
            </View>
          )}

          {/* Scanner Viewport */}
          <ScannerView
            onScan={handleScan}
            onCameraActiveChange={handleCameraActiveChange}
            defaultCompact={true}
          />

          {/* Scanned Items Table & Mismatch Inspector */}
          {scannedItems.length > 0 && (
            <View style={styles.batchCard}>
              <View style={styles.batchHeader}>
                <View>
                  <Text style={styles.batchTitle}>
                    Audited Equipment ({scannedItems.length})
                  </Text>
                  <Text style={styles.batchSub}>Review conditions or flag discrepancies</Text>
                </View>
                <TouchableOpacity
                  style={styles.commitButton}
                  onPress={handleCommitStation}
                  disabled={isCommitting}
                  activeOpacity={0.85}
                >
                  {isCommitting ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.commitButtonText}>
                      Save Station ({scannedItems.length})
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              {scannedItems.map((item, idx) => (
                <View key={item.id} style={styles.itemRow}>
                  <View style={styles.itemInfo}>
                    <View style={styles.itemTitleRow}>
                      <Text style={styles.itemCode}>{item.assetCode}</Text>
                      {item.isLocationMismatch && (
                        <View style={styles.mismatchBadge}>
                          <Text style={styles.mismatchText}>MISMATCH</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {item.isLocationMismatch && (
                      <Text style={styles.mismatchSub}>
                        Assigned to: {item.locationName || 'Unassigned'}
                      </Text>
                    )}

                    {/* Condition Selector */}
                    <View style={styles.conditionRow}>
                      {['GOOD', 'FAIR', 'DAMAGED'].map((cond) => {
                        const isSelected = item.selectedCondition === cond;
                        return (
                          <TouchableOpacity
                            key={cond}
                            style={[
                              styles.condChip,
                              isSelected &&
                              (cond === 'GOOD'
                                ? styles.condChipGood
                                : cond === 'FAIR'
                                  ? styles.condChipFair
                                  : styles.condChipDamaged),
                            ]}
                            onPress={() => handleUpdateCondition(idx, cond)}
                          >
                            <Text
                              style={[
                                styles.condChipText,
                                isSelected && styles.condChipTextActive,
                              ]}
                            >
                              {cond}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* Remove item */}
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => handleRemoveItem(idx)}
                  >
                    <Text style={styles.removeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  // ── Sessions Screen Styles ──────────────────────────────────────────────
  sessionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  syncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  syncPillSynced: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  syncPillPending: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  syncPillOffline: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  syncPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  syncPillTextSynced: {
    color: '#15803d',
  },
  syncPillTextPending: {
    color: '#b45309',
  },
  syncPillTextOffline: {
    color: '#dc2626',
  },
  newSessionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.sm,
  },
  newSessionBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  sessionsKpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  sessionKpiCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: theme.borderRadius.md,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    ...theme.shadows.sm,
  },
  sessionKpiVal: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  sessionKpiLabel: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 2,
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  sessionFilterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  sessionFilterPillActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  sessionFilterPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  sessionFilterPillTextActive: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  sessionCard: {
    backgroundColor: '#ffffff',
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    marginBottom: 12,
    ...theme.shadows.sm,
  },
  sessionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  sessionLocationCol: {
    flex: 1,
    marginRight: 8,
  },
  locationTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sessionLocationName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  sessionLocationCode: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
    marginLeft: 21,
  },
  sessionStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sessionStatusInProgress: {
    backgroundColor: theme.colors.successLight,
    borderColor: theme.colors.successBorder,
  },
  sessionStatusCompleted: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primaryBorder,
  },
  sessionStatusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  sessionStatusTextInProgress: {
    color: theme.colors.success,
  },
  sessionStatusTextCompleted: {
    color: theme.colors.primary,
  },
  sessionPlanRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  sessionPlanText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500',
    flex: 1,
  },
  sessionAuditorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  sessionAuditorText: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  sessionDateText: {
    fontSize: 11,
    color: theme.colors.textLight,
  },
  sessionFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
    paddingTop: 10,
  },
  sessionCounters: {
    flexDirection: 'row',
    gap: 6,
  },
  counterBadge: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  counterText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  discrepancyBadge: {
    backgroundColor: theme.colors.dangerLight,
    borderWidth: 1,
    borderColor: theme.colors.dangerBorder,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  discrepancyText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.danger,
  },
  resumeAction: {
    paddingVertical: 2,
  },
  resumeActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  emptySessionBox: {
    backgroundColor: '#ffffff',
    borderRadius: theme.borderRadius.lg,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    marginTop: 20,
    ...theme.shadows.sm,
  },
  emptySessionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginTop: 10,
  },
  emptySessionSub: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  emptyActionBtn: {
    marginTop: 16,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  emptyActionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },

  // ── Station Audit Scanner Styles ────────────────────────────────────────
  stationAuditNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  backToSessionsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  backToSessionsText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  activeStationTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    flex: 1,
  },
  header: {
    marginBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  planSelectorCard: {
    backgroundColor: '#ffffff',
    borderRadius: theme.borderRadius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    marginBottom: 12,
    ...theme.shadows.sm,
  },
  planSelectorLabel: {
    fontSize: 10,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    fontWeight: '700',
    marginBottom: 6,
  },
  planScroll: {
    flexDirection: 'row',
  },
  planPill: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    marginRight: 8,
  },
  planPillActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  planPillText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  planPillTextActive: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  stationCard: {
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    borderWidth: 1,
    marginBottom: 12,
    ...theme.shadows.sm,
  },
  stationCardWaiting: {
    backgroundColor: theme.colors.warningLight,
    borderColor: theme.colors.warningBorder,
  },
  stationCardActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primaryBorder,
  },
  stationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  stationBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  stationBadgeWaiting: {
    backgroundColor: theme.colors.warning,
  },
  stationBadgeActive: {
    backgroundColor: theme.colors.primary,
  },
  stationBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#ffffff',
  },
  stationBadgeTextWaiting: {
    color: '#ffffff',
  },
  stationBadgeTextActive: {
    color: '#ffffff',
  },
  stationExitText: {
    color: theme.colors.danger,
    fontSize: 11,
    fontWeight: '600',
  },
  stationDetails: {
    marginTop: 2,
  },
  stationName: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  stationCode: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  stationCounterRow: {
    marginTop: 6,
  },
  stationCounterText: {
    fontSize: 11,
    color: theme.colors.success,
    fontWeight: '700',
  },
  stationPrompt: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  stationPromptTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.warning,
  },
  stationPromptSub: {
    fontSize: 11,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
  statusBanner: {
    backgroundColor: theme.colors.primaryLight,
    borderWidth: 1,
    borderColor: theme.colors.primaryBorder,
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
  },
  statusBannerText: {
    fontSize: 11,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  batchCard: {
    backgroundColor: '#ffffff',
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    marginTop: 14,
    ...theme.shadows.card,
  },
  batchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
    paddingBottom: 10,
    marginBottom: 10,
  },
  batchTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  batchSub: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  commitButton: {
    backgroundColor: theme.colors.success,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  commitButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  itemInfo: {
    flex: 1,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemCode: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  mismatchBadge: {
    backgroundColor: theme.colors.dangerLight,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.dangerBorder,
  },
  mismatchText: {
    color: theme.colors.danger,
    fontSize: 9,
    fontWeight: '700',
  },
  itemName: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.textPrimary,
    marginTop: 1,
  },
  mismatchSub: {
    fontSize: 10,
    color: theme.colors.warning,
    fontWeight: '600',
    marginTop: 2,
  },
  conditionRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  condChip: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  condChipGood: {
    backgroundColor: theme.colors.successLight,
    borderColor: theme.colors.successBorder,
  },
  condChipFair: {
    backgroundColor: theme.colors.warningLight,
    borderColor: theme.colors.warningBorder,
  },
  condChipDamaged: {
    backgroundColor: theme.colors.dangerLight,
    borderColor: theme.colors.dangerBorder,
  },
  condChipText: {
    fontSize: 10,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  condChipTextActive: {
    color: theme.colors.textPrimary,
    fontWeight: '700',
  },
  removeBtn: {
    padding: 6,
    marginLeft: 6,
  },
  removeBtnText: {
    color: theme.colors.danger,
    fontSize: 14,
    fontWeight: '700',
  },
});
