import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Alert,
  FlatList,
  Modal,
  Platform,
} from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useAudioPlayer } from 'expo-audio';
import { apiRequest } from '../services/api';
import { storage } from '../services/storage';
import { useAuth } from '../context/AuthContext';
import { theme } from '../config/theme';
import {
  triggerLiveSync,
  subscribeOutboxChanges,
  getSyncSummary,
  isOutboxSyncing,
} from '../services/syncManager';
import {
  saveCachedSession,
  getCachedSession,
  saveCachedSessionItems,
  getSessionAuditItems,
  recordSessionItemScan,
  findCachedAsset,
} from '../database/db';

const beepSound = require('../../assets/beep.wav');

export interface SessionAuditItem {
  id: string;
  sessionId: string;
  assetId: string;
  status: string;
  condition?: string | null;
  notes?: string | null;
  scannedAt?: string | null;
  createdAt: string;
  synced?: number;
  asset: {
    id: string;
    name: string;
    assetCode: string;
    sapAssetCode?: string | null;
    serialNumber?: string | null;
    model?: string | null;
    qrCode?: string | null;
  };
  expectedLocation?: { id: string; name: string; code?: string } | null;
  foundLocation?: { id: string; name: string; code?: string } | null;
  discrepancy?: {
    id: string;
    discrepancyType: string;
    resolvedAt?: string | null;
  } | null;
}

interface SessionDetails {
  id: string;
  planId: string;
  status: string;
  locationId?: string | null;
  startedAt?: string | null;
  notes?: string | null;
  plan?: { id: string; name: string; type: string; status: string };
  auditor?: { id: string; name: string; email: string };
  location?: { id: string; name: string; code?: string; type?: string; fullPath?: string } | null;
  _count?: { items: number; discrepancies: number };
}

export const SessionInventoryScreen = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { isOfflineMode, isOnline } = useAuth();

  const sessionId = route.params?.sessionId || '';
  const initialSession = route.params?.session as SessionDetails | undefined;

  const [session, setSession] = useState<SessionDetails | null>(initialSession || null);
  const [items, setItems] = useState<SessionAuditItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isStatusUpdating, setIsStatusUpdating] = useState(false);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Outbox live sync state
  const [outboxCount, setOutboxCount] = useState<number>(0);
  const [isSyncingOutbox, setIsSyncingOutbox] = useState<boolean>(false);

  // Camera Scanning State
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanningOpen, setIsScanningOpen] = useState(false);
  const [enableTorch, setEnableTorch] = useState(false);
  const [scanToast, setScanToast] = useState<string | null>(null);
  const lastScannedTimeRef = useRef<number>(0);
  const audioPlayer = useAudioPlayer(beepSound);

  const refreshOutboxStatus = useCallback(async () => {
    try {
      const summary = await getSyncSummary();
      setOutboxCount(summary.totalOutboxCount);
      setIsSyncingOutbox(isOutboxSyncing());
    } catch {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSessionAndItems();
      refreshOutboxStatus();
    }, [sessionId, refreshOutboxStatus])
  );

  useEffect(() => {
    refreshOutboxStatus();
    const unsub = subscribeOutboxChanges(() => {
      loadSessionAndItems();
      refreshOutboxStatus();
    });
    return () => unsub();
  }, [sessionId, refreshOutboxStatus]);

  const handleManualSyncPress = async () => {
    if (isOfflineMode) {
      Alert.alert(
        'Offline Mode Active',
        'Device is currently operating offline. Scans are safely saved in local SQLite storage and will synchronize automatically once reconnected.',
      );
      return;
    }

    if (outboxCount === 0) {
      Alert.alert('Cloud Synced', 'All session records are already up to date on the server.');
      return;
    }

    setIsSyncingOutbox(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    try {
      const res = await triggerLiveSync({ force: true });
      await refreshOutboxStatus();
      if (res.success && res.totalUploaded > 0) {
        Alert.alert('Sync Successful', `Synchronized ${res.totalUploaded} audit records with the server.`);
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

  const loadSessionAndItems = async (isRefresh = false) => {
    if (!sessionId) return;

    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      // 1. Initial quick load from local SQLite DB (instant, 0ms, works offline)
      const cachedLocally = await getSessionAuditItems(sessionId);
      if (cachedLocally && cachedLocally.length > 0) {
        setItems(cachedLocally);
        setIsLoading(false);
      }
      const localSess = await getCachedSession(sessionId);
      if (localSess) {
        setSession(localSess);
        setIsLoading(false);
      } else if (initialSession) {
        setSession(initialSession);
        setIsLoading(false);
        saveCachedSession(initialSession).catch(() => {});
      }

      // 2. If online, fetch latest from server in background and sync into local SQLite DB
      if (!isOfflineMode) {
        const fetchRemote = async () => {
          const [sessionRes, itemsRes] = await Promise.all([
            apiRequest<SessionDetails>(`/audits/sessions/${sessionId}`, { timeoutMs: 5000 }).catch(
              () => null,
            ),
            apiRequest<SessionAuditItem[] | { data: SessionAuditItem[] }>(
              `/audits/sessions/${sessionId}/items`,
              { timeoutMs: 6000 },
            ).catch(() => null),
          ]);

          if (sessionRes) {
            setSession(sessionRes);
            await saveCachedSession(sessionRes);
          }

          const serverItems = Array.isArray(itemsRes)
            ? itemsRes
            : itemsRes?.data || [];

          if (serverItems.length > 0) {
            await saveCachedSessionItems(sessionId, serverItems);
          }

          // Re-read from local SQLite to merge local unsynced offline scans
          const mergedDbItems = await getSessionAuditItems(sessionId);
          if (mergedDbItems.length > 0) {
            setItems(mergedDbItems);
          }
        };

        if (cachedLocally && cachedLocally.length > 0) {
          // Fire and forget in background so UI opens in 0ms!
          fetchRemote()
            .catch(() => {})
            .finally(() => {
              setIsLoading(false);
              setIsRefreshing(false);
            });
          return;
        } else {
          // Only await if local cache is completely empty
          await fetchRemote();
        }
      }
    } catch (error) {
      console.warn('[SessionInventoryScreen] Error loading items, using local SQLite:', error);
      const fallbackItems = await getSessionAuditItems(sessionId);
      if (fallbackItems.length > 0) {
        setItems(fallbackItems);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleOpenScanner = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('Permission Denied', 'Camera permission is required to scan QR and barcodes.');
        return;
      }
    }
    setEnableTorch(false);
    setIsScanningOpen(true);
  };

  const handleCloseScanner = () => {
    setIsScanningOpen(false);
    setEnableTorch(false);
  };

  const handleBarcodeScanned = async (scanningResult: { data: string }) => {
    const now = Date.now();
    // Debounce duplicate reads within 1.5s
    if (now - lastScannedTimeRef.current < 1500) return;
    lastScannedTimeRef.current = now;

    const cleanCode = scanningResult.data?.trim();
    if (!cleanCode) return;

    // Audio confirmation
    try {
      audioPlayer.seekTo(0);
      audioPlayer.play();
    } catch {}

    const result = await recordSessionItemScan(sessionId, cleanCode, {
      locationId: session?.locationId || undefined,
      locationName: session?.location?.name,
      locationCode: session?.location?.code,
      planId: session?.planId,
    });

    if (result.success) {
      // Differentiated Haptic Feedback based on condition & relocation status
      if (Platform.OS !== 'web') {
        if (result.item?.condition === 'DAMAGED' || result.item?.status === 'DAMAGED') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        } else if (result.item?.isMismatch || result.item?.status === 'LOCATION_MISMATCH') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
      }

      // Instantly reload from local SQLite DB
      const updatedList = await getSessionAuditItems(sessionId);
      setItems(updatedList);
      refreshOutboxStatus();
      setScanToast(result.message);
      setTimeout(() => setScanToast(null), 3500);

      // Trigger live sync in background if online
      if (!isOfflineMode) {
        triggerLiveSync()
          .then(() => refreshOutboxStatus())
          .catch(() => {});
      }
    } else {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
      Alert.alert('Scan Issue', result.message);
    }
  };

  const handleToggleCompleteSession = async () => {
    if (!session || isOfflineMode) return;
    const isCompleted = session.status === 'COMPLETED';
    const action = isCompleted ? 'reopen' : 'complete';

    setIsStatusUpdating(true);
    try {
      await apiRequest(`/audits/sessions/${session.id}/${action}`, {
        method: 'PUT',
        timeoutMs: 8000,
      });

      setSession((prev) => (prev ? { ...prev, status: isCompleted ? 'IN_PROGRESS' : 'COMPLETED' } : null));
      Alert.alert(
        'Session Updated',
        isCompleted
          ? 'Session reopened for further scanning.'
          : 'Session marked as COMPLETED successfully.',
      );
    } catch (err: any) {
      Alert.alert('Action Failed', err?.message || 'Could not update session status.');
    } finally {
      setIsStatusUpdating(false);
    }
  };

  const handleNavigateToStationScanner = () => {
    // Navigate to live station scanner with this station session loaded
    navigation.navigate('MainTabs', {
      screen: 'Audits',
      params: {
        initialSession: session,
        initialLocation: session?.location
          ? {
              id: session.location.id,
              name: session.location.name,
              code: session.location.code || 'ZONE',
              type: session.location.type || 'STATION',
              parentId: null,
              fullPath: session.location.name,
            }
          : undefined,
        planId: session?.planId,
      },
    });
  };

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter !== 'ALL') {
        const itemStatus = item.status?.toUpperCase();
        if (statusFilter === 'VERIFIED') {
          if (itemStatus !== 'VERIFIED' && itemStatus !== 'FOUND') return false;
        } else if (itemStatus !== statusFilter) {
          return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const codeMatch = item.asset?.assetCode?.toLowerCase().includes(q);
        const sapMatch = item.asset?.sapAssetCode?.toLowerCase().includes(q);
        const nameMatch = item.asset?.name?.toLowerCase().includes(q);
        const expectedLocMatch = item.expectedLocation?.name?.toLowerCase().includes(q);
        const foundLocMatch = item.foundLocation?.name?.toLowerCase().includes(q);
        return Boolean(codeMatch || sapMatch || nameMatch || expectedLocMatch || foundLocMatch);
      }

      return true;
    });
  }, [items, searchQuery, statusFilter]);

  // Metric counts
  const totalCount = items.length;
  const verifiedCount = items.filter((i) => i.status === 'VERIFIED' || i.status === 'FOUND').length;
  const pendingCount = items.filter((i) => i.status === 'PENDING').length;
  const mismatchCount = items.filter(
    (i) => i.status === 'MISMATCH' || (i.expectedLocation && i.foundLocation && i.foundLocation.id !== i.expectedLocation.id),
  ).length;
  const damagedCount = items.filter((i) => i.status === 'DAMAGED' || i.condition === 'DAMAGED').length;
  const completionPercent = totalCount > 0 ? Math.round((verifiedCount / totalCount) * 100) : 0;

  const isCompleted = session?.status === 'COMPLETED';

  const renderItemStatusBadge = (status: string) => {
    let bg = '#f1f5f9';
    let text = '#64748b';
    let border = '#e2e8f0';

    switch (status) {
      case 'VERIFIED':
      case 'FOUND':
        bg = theme.colors.successLight;
        text = theme.colors.success;
        border = theme.colors.successBorder;
        break;
      case 'PENDING':
        bg = '#f8fafc';
        text = '#94a3b8';
        border = '#e2e8f0';
        break;
      case 'MISMATCH':
        bg = theme.colors.warningLight;
        text = theme.colors.warning;
        border = theme.colors.warningBorder;
        break;
      case 'DAMAGED':
        bg = theme.colors.dangerLight;
        text = theme.colors.danger;
        border = theme.colors.dangerBorder;
        break;
    }

    return (
      <View style={[styles.itemStatusBadge, { backgroundColor: bg, borderColor: border }]}>
        <Text style={[styles.itemStatusText, { color: text }]}>{status}</Text>
      </View>
    );
  };

  const renderInventoryItem = ({ item }: { item: SessionAuditItem }) => {
    const isRelocated =
      item.foundLocation &&
      item.expectedLocation &&
      item.foundLocation.id !== item.expectedLocation.id;

    return (
      <TouchableOpacity
        style={styles.itemCard}
        onPress={() =>
          navigation.navigate('AssetDetail', {
            assetCode: item.asset.assetCode,
            assetId: item.assetId,
          })
        }
        activeOpacity={0.85}
      >
        <View style={styles.itemCardHeader}>
          <View style={styles.itemCodeRow}>
            <Text style={styles.assetCodeText}>{item.asset.assetCode}</Text>
            {item.asset.sapAssetCode ? (
              <View style={styles.sapBadge}>
                <Text style={styles.sapBadgeText}>SAP: {item.asset.sapAssetCode}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.itemStatusRow}>
            {item.synced === 0 && (
              <View style={styles.offlineSyncBadge}>
                <Ionicons name="cloud-offline-outline" size={10} color="#b45309" style={{ marginRight: 3 }} />
                <Text style={styles.offlineSyncBadgeText}>Offline</Text>
              </View>
            )}
            {renderItemStatusBadge(item.status)}
          </View>
        </View>

        <Text style={styles.assetNameText} numberOfLines={2}>
          {item.asset.name}
        </Text>

        {item.asset.model ? (
          <Text style={styles.assetModelText}>Model: {item.asset.model}</Text>
        ) : null}

        {/* Location comparison row */}
        <View style={styles.locationComparisonRow}>
          <View style={styles.locBlock}>
            <Text style={styles.locLabel}>Expected Location:</Text>
            <View style={styles.locValueRow}>
              <Ionicons name="business-outline" size={13} color={theme.colors.textMuted} />
              <Text style={styles.locValue} numberOfLines={1}>
                {item.expectedLocation?.name || 'Unassigned'}
              </Text>
            </View>
          </View>

          <View style={styles.locBlock}>
            <Text style={styles.locLabel}>Physical Found:</Text>
            <View style={styles.locValueRow}>
              <Ionicons
                name="location"
                size={13}
                color={item.foundLocation ? theme.colors.success : theme.colors.textMuted}
              />
              <Text
                style={[
                  styles.locValue,
                  item.foundLocation ? styles.locValueScanned : styles.locValueUnscanned,
                ]}
                numberOfLines={1}
              >
                {item.foundLocation?.name || 'Not scanned yet'}
              </Text>
            </View>
          </View>
        </View>

        {isRelocated && (
          <View style={styles.relocatedBanner}>
            <Ionicons name="warning-outline" size={13} color={theme.colors.warning} />
            <Text style={styles.relocatedBannerText}>
              Relocated: Scanned at {item.foundLocation?.name}
            </Text>
          </View>
        )}

        {/* Card Footer: Condition & Timestamp */}
        <View style={styles.itemFooterRow}>
          <View style={styles.footerLeft}>
            {item.condition && (
              <View
                style={[
                  styles.conditionBadge,
                  item.condition === 'DAMAGED' && styles.conditionDamaged,
                ]}
              >
                <Text style={styles.conditionText}>Condition: {item.condition}</Text>
              </View>
            )}
          </View>

          <Text style={styles.scannedTimeText}>
            {item.scannedAt
              ? `Scanned: ${new Date(item.scannedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : 'Pending scan'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Navbar Header */}
      <View style={styles.topNavbar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={20} color={theme.colors.primary} />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.headerTitleCol}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {session?.location?.name || 'Session Inventory'}
          </Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {session?.plan?.name || 'Inventory Checklist'}
          </Text>
        </View>

        <View style={styles.topNavbarRight}>
          {/* Live Outbox Sync Indicator Pill */}
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
            style={styles.topCameraBtn}
            onPress={handleOpenScanner}
            activeOpacity={0.8}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="camera" size={18} color={theme.colors.primary} />
          </TouchableOpacity>

          {session && (
            <View
              style={[
                styles.sessionBadge,
                session.status === 'IN_PROGRESS' && styles.sessionBadgeInProgress,
                session.status === 'COMPLETED' && styles.sessionBadgeCompleted,
              ]}
            >
              <Text
                style={[
                  styles.sessionBadgeText,
                  session.status === 'IN_PROGRESS' && styles.sessionBadgeTextInProgress,
                  session.status === 'COMPLETED' && styles.sessionBadgeTextCompleted,
                ]}
              >
                {session.status}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Floating Scan Toast Banner */}
      {scanToast && (
        <View style={styles.floatingToast}>
          <Ionicons name="checkmark-circle" size={16} color="#166534" />
          <Text style={styles.floatingToastText} numberOfLines={2}>
            {scanToast}
          </Text>
        </View>
      )}

      {/* Main Content Area */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading session inventory checklist...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          renderItem={renderInventoryItem}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadSessionAndItems(true)}
              colors={[theme.colors.primary]}
            />
          }
          ListHeaderComponent={
            <View style={styles.listHeaderWrapper}>
              {/* Session Overview Card */}
              <View style={styles.overviewCard}>
                <View style={styles.stationTitleRow}>
                  <Ionicons name="location" size={18} color={theme.colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stationNameText}>
                      {session?.location?.name || 'Factory Line Station'}
                    </Text>
                    {session?.location?.code && (
                      <Text style={styles.stationCodeText}>Station Code: {session.location.code}</Text>
                    )}
                  </View>
                </View>

                {/* Audit Progress Bar */}
                <View style={styles.progressBarWrapper}>
                  <View style={styles.progressBarHeader}>
                    <View style={styles.progressLabelRow}>
                      <Text style={styles.progressLabel}>Session Progress</Text>
                      {completionPercent === 100 && totalCount > 0 && (
                        <View style={styles.completeChip}>
                          <Ionicons name="checkmark-done" size={11} color="#15803d" />
                          <Text style={styles.completeChipText}>100% Done</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.progressPercentText}>
                      {completionPercent}% ({verifiedCount}/{totalCount})
                    </Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${completionPercent}%` },
                        completionPercent === 100 && styles.progressFillDone,
                      ]}
                    />
                  </View>
                </View>

                {/* Metric Summary Strip */}
                <View style={styles.metricsStrip}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricVal}>{items.length}</Text>
                    <Text style={styles.metricLabel}>Total Scope</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={[styles.metricVal, { color: theme.colors.success }]}>
                      {verifiedCount}
                    </Text>
                    <Text style={styles.metricLabel}>Verified</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={[styles.metricVal, { color: '#94a3b8' }]}>{pendingCount}</Text>
                    <Text style={styles.metricLabel}>Pending</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text
                      style={[
                        styles.metricVal,
                        { color: mismatchCount > 0 ? theme.colors.warning : theme.colors.textMuted },
                      ]}
                    >
                      {mismatchCount}
                    </Text>
                    <Text style={styles.metricLabel}>Mismatch</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text
                      style={[
                        styles.metricVal,
                        { color: damagedCount > 0 ? theme.colors.danger : theme.colors.textMuted },
                      ]}
                    >
                      {damagedCount}
                    </Text>
                    <Text style={styles.metricLabel}>Damaged</Text>
                  </View>
                </View>

                {/* Quick Find Remaining Action */}
                {pendingCount > 0 && (
                  <TouchableOpacity
                    style={[
                      styles.quickFindBar,
                      statusFilter === 'PENDING' && styles.quickFindBarActive,
                    ]}
                    onPress={() => setStatusFilter(statusFilter === 'PENDING' ? 'ALL' : 'PENDING')}
                    activeOpacity={0.8}
                  >
                    <View style={styles.quickFindLeft}>
                      <Ionicons
                        name={statusFilter === 'PENDING' ? 'funnel' : 'flash'}
                        size={14}
                        color={statusFilter === 'PENDING' ? theme.colors.primary : '#b45309'}
                      />
                      <Text
                        style={[
                          styles.quickFindText,
                          statusFilter === 'PENDING' && styles.quickFindTextActive,
                        ]}
                      >
                        {statusFilter === 'PENDING'
                          ? `Filtering ${pendingCount} pending item${pendingCount > 1 ? 's' : ''}`
                          : `Find Remaining (${pendingCount} unscanned item${pendingCount > 1 ? 's' : ''})`}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.quickFindAction,
                        statusFilter === 'PENDING' && styles.quickFindActionActive,
                      ]}
                    >
                      {statusFilter === 'PENDING' ? 'Show All' : 'Filter Pending'}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Session Actions (Scan in session / Mark complete) */}
                <View style={styles.sessionActionsRow}>
                  <TouchableOpacity
                    style={styles.scanInSessionBtn}
                    onPress={handleOpenScanner}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="camera" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={styles.scanInSessionBtnText}>Scan with Camera</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.stationScannerBtn}
                    onPress={handleNavigateToStationScanner}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="scan-outline" size={15} color={theme.colors.primary} style={{ marginRight: 4 }} />
                    <Text style={styles.stationScannerBtnText}>Station Floor</Text>
                  </TouchableOpacity>

                  {!isOfflineMode && session && (
                    <TouchableOpacity
                      style={[styles.statusToggleBtn, isCompleted && styles.statusToggleBtnReopen]}
                      onPress={handleToggleCompleteSession}
                      disabled={isStatusUpdating}
                      activeOpacity={0.8}
                    >
                      {isStatusUpdating ? (
                        <ActivityIndicator size="small" color={theme.colors.primary} />
                      ) : (
                        <>
                          <Ionicons
                            name={isCompleted ? 'refresh-outline' : 'checkmark-circle-outline'}
                            size={16}
                            color={isCompleted ? theme.colors.primary : theme.colors.success}
                            style={{ marginRight: 4 }}
                          />
                          <Text
                            style={[
                              styles.statusToggleText,
                              isCompleted && styles.statusToggleTextReopen,
                            ]}
                          >
                            {isCompleted ? 'Reopen' : 'Complete'}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Search Bar */}
              <View style={styles.searchBar}>
                <Ionicons name="search-outline" size={16} color={theme.colors.textMuted} style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Filter by code, name, location..."
                  placeholderTextColor={theme.colors.textLight}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Ionicons name="close-circle" size={16} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.searchCameraBtn}
                  onPress={handleOpenScanner}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="camera" size={18} color={theme.colors.primary} />
                </TouchableOpacity>
              </View>

              {/* Status Filter Pills */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
                {[
                  { key: 'ALL', label: `All (${items.length})` },
                  { key: 'VERIFIED', label: `Verified (${verifiedCount})` },
                  { key: 'PENDING', label: `Pending (${pendingCount})` },
                  { key: 'MISMATCH', label: `Mismatch (${mismatchCount})` },
                  { key: 'DAMAGED', label: `Damaged (${damagedCount})` },
                ].map((f) => {
                  const isActive = statusFilter === f.key;
                  return (
                    <TouchableOpacity
                      key={f.key}
                      style={[styles.filterChip, isActive && styles.filterChipActive]}
                      onPress={() => setStatusFilter(f.key)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="file-tray-outline" size={48} color={theme.colors.textMuted} />
              <Text style={styles.emptyTitle}>No Assets Match Filter</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery || statusFilter !== 'ALL'
                  ? 'Try clearing the search or switching status filters.'
                  : 'No equipment items loaded in this session yet.'}
              </Text>
            </View>
          }
        />
      )}
      {/* Live Camera Scanner Modal */}
      <Modal
        visible={isScanningOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleCloseScanner}
      >
        <SafeAreaView style={styles.cameraModalContainer}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={enableTorch}
            barcodeScannerSettings={{
              barcodeTypes: [
                'qr',
                'ean13',
                'ean8',
                'code128',
                'code39',
                'upc_a',
                'upc_e',
                'codabar',
                'itf14',
                'datamatrix',
              ],
            }}
            onBarcodeScanned={handleBarcodeScanned}
          >
            <View style={styles.cameraOverlay}>
              <View style={styles.cameraTopHeader}>
                <TouchableOpacity
                  style={styles.cameraCircleBtn}
                  onPress={handleCloseScanner}
                  activeOpacity={0.8}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons name="close" size={24} color="#ffffff" />
                </TouchableOpacity>

                <View style={styles.cameraHeaderTitleCol}>
                  <Text style={styles.cameraHeaderTitle}>Scan Session Asset</Text>
                  <Text style={styles.cameraHeaderSub}>
                    {session?.location?.name || 'Local SQLite Session'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.cameraCircleBtn, enableTorch && styles.cameraCircleBtnActive]}
                  onPress={() => setEnableTorch((prev) => !prev)}
                  activeOpacity={0.8}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Ionicons
                    name={enableTorch ? 'flash' : 'flash-outline'}
                    size={22}
                    color={enableTorch ? '#facc15' : '#ffffff'}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.viewfinderWrapper}>
                {scanToast && (
                  <View style={styles.scannerFeedbackPill}>
                    <Ionicons name="checkmark-circle" size={16} color="#4ade80" />
                    <Text style={styles.scannerFeedbackText}>{scanToast}</Text>
                  </View>
                )}
                <View style={styles.viewfinderBox}>
                  <View style={[styles.corner, styles.cornerTL]} />
                  <View style={[styles.corner, styles.cornerTR]} />
                  <View style={[styles.corner, styles.cornerBL]} />
                  <View style={[styles.corner, styles.cornerBR]} />
                </View>
                <View style={styles.tipPill}>
                  <Ionicons name="hardware-chip-outline" size={14} color="#38bdf8" style={{ marginRight: 6 }} />
                  <Text style={styles.tipPillText}>0ms instant SQLite write (Offline-ready)</Text>
                </View>
              </View>

              <View style={styles.cameraBottomBar}>
                <TouchableOpacity
                  style={styles.cameraCancelButton}
                  onPress={handleCloseScanner}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cameraCancelButtonText}>Done Scanning</Text>
                </TouchableOpacity>
              </View>
            </View>
          </CameraView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  topNavbar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.cardBorder,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingRight: 10,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  headerTitleCol: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  headerSub: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  sessionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  sessionBadgeInProgress: {
    backgroundColor: theme.colors.successLight,
    borderColor: theme.colors.successBorder,
  },
  sessionBadgeCompleted: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primaryBorder,
  },
  sessionBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  sessionBadgeTextInProgress: {
    color: theme.colors.success,
  },
  sessionBadgeTextCompleted: {
    color: theme.colors.primary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: theme.colors.textMuted,
  },
  listContent: {
    padding: 14,
    paddingBottom: 30,
  },
  listHeaderWrapper: {
    marginBottom: 10,
  },
  overviewCard: {
    backgroundColor: '#ffffff',
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    marginBottom: 12,
    ...theme.shadows.sm,
  },
  stationTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
  },
  stationNameText: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  stationCodeText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  progressBarWrapper: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 10,
    marginBottom: 12,
  },
  progressBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  completeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    gap: 3,
  },
  completeChipText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#15803d',
  },
  progressPercentText: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 4,
  },
  progressFillDone: {
    backgroundColor: theme.colors.success,
  },
  quickFindBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  quickFindBarActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primaryBorder,
  },
  quickFindLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  quickFindText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b45309',
  },
  quickFindTextActive: {
    color: theme.colors.primary,
  },
  quickFindAction: {
    fontSize: 11,
    fontWeight: '800',
    color: '#b45309',
    textDecorationLine: 'underline',
  },
  quickFindActionActive: {
    color: theme.colors.primary,
  },
  metricsStrip: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    paddingVertical: 10,
    marginBottom: 12,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricVal: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  metricLabel: {
    fontSize: 9,
    color: theme.colors.textMuted,
    marginTop: 2,
    fontWeight: '600',
  },
  sessionActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  scanInSessionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: 9,
    borderRadius: 8,
    ...theme.shadows.sm,
  },
  scanInSessionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  statusToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.successLight,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.successBorder,
  },
  statusToggleBtnReopen: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primaryBorder,
  },
  statusToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.success,
  },
  statusToggleTextReopen: {
    color: theme.colors.primary,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    marginBottom: 8,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.textPrimary,
    paddingVertical: 0,
  },
  filtersScroll: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  filterChip: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    marginRight: 6,
  },
  filterChipActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  filterChipTextActive: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  itemCard: {
    backgroundColor: '#ffffff',
    borderRadius: theme.borderRadius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    marginBottom: 10,
    ...theme.shadows.sm,
  },
  itemCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  itemCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  assetCodeText: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  sapBadge: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  sapBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  itemStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  itemStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  assetNameText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    lineHeight: 18,
    marginBottom: 4,
  },
  assetModelText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginBottom: 6,
  },
  locationComparisonRow: {
    flexDirection: 'row',
    backgroundColor: theme.colors.background,
    borderRadius: 6,
    padding: 8,
    marginBottom: 6,
    gap: 10,
  },
  locBlock: {
    flex: 1,
  },
  locLabel: {
    fontSize: 9,
    color: theme.colors.textMuted,
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  locValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locValue: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  locValueScanned: {
    color: theme.colors.success,
  },
  locValueUnscanned: {
    color: theme.colors.textMuted,
    fontStyle: 'italic',
  },
  relocatedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.colors.warningLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: theme.colors.warningBorder,
  },
  relocatedBannerText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.warning,
  },
  itemFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
    paddingTop: 6,
    marginTop: 2,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  conditionBadge: {
    backgroundColor: theme.colors.successLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  conditionDamaged: {
    backgroundColor: theme.colors.dangerLight,
  },
  conditionText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  scannedTimeText: {
    fontSize: 10,
    color: theme.colors.textLight,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginTop: 6,
  },
  emptySubtitle: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  topNavbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  topCameraBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingToast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginTop: 6,
    borderRadius: 8,
  },
  floatingToastText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
    flex: 1,
  },
  itemStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  offlineSyncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  offlineSyncBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#b45309',
  },
  stationScannerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primaryLight,
    borderWidth: 1,
    borderColor: theme.colors.primaryBorder,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  stationScannerBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  searchCameraBtn: {
    paddingLeft: 8,
    paddingRight: 2,
  },
  cameraModalContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'space-between',
  },
  cameraTopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 24 : 12,
    paddingBottom: 16,
  },
  cameraCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraCircleBtnActive: {
    backgroundColor: 'rgba(234, 179, 8, 0.25)',
    borderWidth: 1,
    borderColor: '#facc15',
  },
  cameraHeaderTitleCol: {
    alignItems: 'center',
  },
  cameraHeaderTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  cameraHeaderSub: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  viewfinderWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scannerFeedbackPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(22, 101, 52, 0.95)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#4ade80',
  },
  scannerFeedbackText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  viewfinderBox: {
    width: 250,
    height: 250,
    borderRadius: 16,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#38bdf8',
  },
  cornerTL: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 10,
  },
  cornerTR: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 10,
  },
  cornerBL: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 10,
  },
  cornerBR: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 10,
  },
  tipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  tipPillText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '500',
  },
  cameraBottomBar: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 20 : 30,
    alignItems: 'center',
  },
  cameraCancelButton: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  cameraCancelButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});

