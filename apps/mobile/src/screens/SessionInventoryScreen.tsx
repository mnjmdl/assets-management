import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Alert,
  FlatList,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  findCachedLocation,
  updateLocalItemAfterTransferFinalized,
  updateLocalItemStatus,
  markLocalSessionUnscannedAsMissing,
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

  // Transfer request state
  const [transferModalItem, setTransferModalItem] = useState<SessionAuditItem | null>(null);
  const [transferReason, setTransferReason] = useState<string>('');
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState<boolean>(false);
  const [pendingTransferAssetIds, setPendingTransferAssetIds] = useState<Set<string>>(new Set());
  const [completedTransferAssetIds, setCompletedTransferAssetIds] = useState<Set<string>>(new Set());

  // Camera Scanning State
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanningOpen, setIsScanningOpen] = useState(false);
  const [enableTorch, setEnableTorch] = useState(false);
  const [scanToast, setScanToast] = useState<{
    message: string;
    type: 'success' | 'warning' | 'error';
  } | null>(null);
  const lastScannedTimeRef = useRef<number>(0);
  const audioPlayer = useAudioPlayer(beepSound);

  const fetchPendingTransfers = useCallback(async () => {
    if (isOfflineMode) return;
    try {
      const res = await apiRequest<any>('/transfers?limit=200', {
        timeoutMs: 6000,
      });
      const list = Array.isArray(res) ? res : res?.data || [];
      const pendingIds = new Set<string>();
      const finalizedIds = new Set<string>();

      list.forEach((t: any) => {
        const aId = t.assetId || t.asset?.id;
        if (!aId) return;
        if (t.status === 'PENDING' || t.status === 'APPROVED') {
          pendingIds.add(aId);
        } else if (t.status === 'COMPLETED') {
          finalizedIds.add(aId);
        }
      });

      if (pendingIds.size > 0) {
        setPendingTransferAssetIds((prev) => {
          const merged = new Set(prev);
          pendingIds.forEach((id) => merged.add(id));
          return merged;
        });
      }

      if (finalizedIds.size > 0) {
        setCompletedTransferAssetIds((prev) => {
          const merged = new Set(prev);
          finalizedIds.forEach((id) => merged.add(id));
          return merged;
        });

        // When transfer is finalized, automatically update status in Session Inventory Checklist
        let hasChanges = false;
        setItems((currentItems) => {
          return currentItems.map((item) => {
            if (
              finalizedIds.has(item.assetId) &&
              (item.status === 'LOCATION_MISMATCH' || item.status === 'MISMATCH')
            ) {
              hasChanges = true;
              return {
                ...item,
                status: item.condition === 'DAMAGED' ? 'DAMAGED' : 'VERIFIED',
                expectedLocation: item.foundLocation || item.expectedLocation,
                notes: item.notes
                  ? `${item.notes} | Transfer finalized`
                  : 'Transfer finalized',
                discrepancy: null,
              };
            }
            return item;
          });
        });

        if (hasChanges) {
          for (const aId of finalizedIds) {
            updateLocalItemAfterTransferFinalized(sessionId, aId).catch(() => {});
          }
        }
      }
    } catch {
      // Non-blocking
    }
  }, [isOfflineMode, sessionId]);

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
      fetchPendingTransfers();
    }, [sessionId, refreshOutboxStatus, fetchPendingTransfers])
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

  // Auto-launch camera scanner if autoScan param was passed (from Step 2 Session Selection)
  useEffect(() => {
    if (route.params?.autoScan) {
      const timer = setTimeout(() => {
        handleOpenScanner();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [route.params?.autoScan]);

  const handleBarcodeScanned = async (scanningResult: { data: string }) => {
    const now = Date.now();
    // Debounce duplicate reads within 1.5s
    if (now - lastScannedTimeRef.current < 1500) return;
    lastScannedTimeRef.current = now;

    const cleanCode = scanningResult.data?.trim();
    if (!cleanCode) return;

    // Check if scanned code is a Location QR Placard rather than an Asset Tag
    const loc = await findCachedLocation(cleanCode);
    if (loc) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      }
      Alert.alert(
        'Station Placard Scanned',
        `"${loc.name}" (${loc.code}) is a Location QR Placard, not an equipment asset tag.\n\nPlease scan the barcode or QR tag affixed to the equipment item.`,
      );
      return;
    }

    // Check in-memory list first for instant duplicate feedback
    const inMemoryScanned = items.find(
      (i) =>
        (i.asset.assetCode?.toUpperCase() === cleanCode.toUpperCase() ||
          i.asset.sapAssetCode?.toUpperCase() === cleanCode.toUpperCase() ||
          i.asset.qrCode?.toUpperCase() === cleanCode.toUpperCase() ||
          i.asset.id === cleanCode) &&
        i.status !== 'PENDING' &&
        Boolean(i.scannedAt),
    );

    if (inMemoryScanned) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
      setScanToast({
        type: 'error',
        message: `DUPLICATE: ${inMemoryScanned.asset.assetCode} ALREADY SCANNED`,
      });
      setTimeout(() => setScanToast(null), 4000);
      Alert.alert(
        'Duplicate Asset Scanned',
        `⚠️ Equipment "${inMemoryScanned.asset.assetCode}" (${inMemoryScanned.asset.name}) has ALREADY been audited in this session.\n\nDuplicate scans are NOT allowed and this record was NOT saved.`,
        [{ text: 'Dismiss', style: 'cancel' }],
      );
      return;
    }

    const result = await recordSessionItemScan(sessionId, cleanCode, {
      locationId: session?.locationId || undefined,
      locationName: session?.location?.name,
      locationCode: session?.location?.code,
      planId: session?.planId,
    });

    if (result.isDuplicate) {
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
      setScanToast({
        type: 'error',
        message: `DUPLICATE: ${result.item?.assetCode || cleanCode} ALREADY SCANNED`,
      });
      setTimeout(() => setScanToast(null), 4000);
      Alert.alert(
        'Duplicate Asset Scanned',
        result.message || `⚠️ Equipment "${cleanCode}" has already been audited. Duplicate scans are rejected and NOT saved.`,
        [{ text: 'Dismiss', style: 'cancel' }],
      );
      return;
    }

    if (result.success) {
      // Audio confirmation on successful scan
      try {
        audioPlayer.seekTo(0);
        audioPlayer.play();
      } catch {}

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
      setScanToast({
        type: result.item?.isMismatch ? 'warning' : 'success',
        message: result.message,
      });
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

    if (isCompleted) {
      // Reopen session
      setIsStatusUpdating(true);
      try {
        await apiRequest(`/audits/sessions/${session.id}/reopen`, {
          method: 'PUT',
          timeoutMs: 8000,
        });

        setSession((prev) => (prev ? { ...prev, status: 'IN_PROGRESS' } : null));
        Alert.alert('Session Reopened', 'Session reopened for further scanning.');
      } catch (err: any) {
        Alert.alert('Action Failed', err?.message || 'Could not reopen session.');
      } finally {
        setIsStatusUpdating(false);
      }
      return;
    }

    // Completing session
    const pendingCount = items.filter((i) => i.status === 'PENDING').length;

    if (pendingCount > 0) {
      Alert.alert(
        'Session Completion Notice',
        `There are ${pendingCount} expected assets that were NOT scanned in this station session.\n\nHow would you like to proceed?`,
        [
          { text: 'Cancel & Keep Scanning', style: 'cancel' },
          {
            text: `Mark ${pendingCount} as MISSING`,
            style: 'destructive',
            onPress: () => submitSessionCompletion(true),
          },
          {
            text: 'Leave as PENDING',
            onPress: () => submitSessionCompletion(false),
          },
        ],
      );
    } else {
      Alert.alert(
        'Complete Session',
        'All expected equipment items have been audited. Mark this session as COMPLETED now?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Complete Now',
            onPress: () => submitSessionCompletion(false),
          },
        ],
      );
    }
  };

  const submitSessionCompletion = async (markUnscannedAsMissing: boolean) => {
    if (!session) return;
    setIsStatusUpdating(true);
    try {
      await apiRequest(`/audits/sessions/${session.id}/complete`, {
        method: 'PUT',
        body: JSON.stringify({ markUnscannedAsMissing }),
        headers: { 'Content-Type': 'application/json' },
        timeoutMs: 10000,
      });

      if (markUnscannedAsMissing) {
        setItems((prev) =>
          prev.map((i) => (i.status === 'PENDING' ? { ...i, status: 'MISSING' } : i)),
        );
        await markLocalSessionUnscannedAsMissing(session.id);
      }

      setSession((prev) => (prev ? { ...prev, status: 'COMPLETED' } : null));
      Alert.alert(
        'Session Completed',
        markUnscannedAsMissing
          ? `Session marked as COMPLETED and unscanned items were marked as MISSING.`
          : `Session marked as COMPLETED. Unscanned items remain PENDING for admin review.`,
      );
    } catch (err: any) {
      Alert.alert('Action Failed', err?.message || 'Could not complete session.');
    } finally {
      setIsStatusUpdating(false);
    }
  };

  const handleMarkSingleItemMissing = (item: SessionAuditItem) => {
    if (!session) return;
    Alert.alert(
      'Mark Asset as Missing',
      `Are you sure you want to mark equipment "${item.asset.assetCode}" (${item.asset.name}) as MISSING for this station audit?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Missing',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!isOfflineMode) {
                await apiRequest(`/audits/sessions/${session.id}/items/${item.id}/mark-missing`, {
                  method: 'PUT',
                  body: JSON.stringify({ notes: 'Manually flagged as MISSING by auditor' }),
                  headers: { 'Content-Type': 'application/json' },
                });
              }

              setItems((prev) =>
                prev.map((i) => (i.id === item.id ? { ...i, status: 'MISSING' } : i)),
              );
              await updateLocalItemStatus(session.id, item.id, 'MISSING');
              Alert.alert('Status Updated', `Asset "${item.asset.assetCode}" has been marked as MISSING.`);
            } catch (err: any) {
              Alert.alert('Action Failed', err?.message || 'Could not mark item as missing.');
            }
          },
        },
      ],
    );
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

  const handleOpenTransferModal = (item: SessionAuditItem) => {
    if (pendingTransferAssetIds.has(item.assetId)) {
      Alert.alert(
        'Transfer Already Requested',
        `A transfer request for asset "${item.asset.assetCode}" has already been submitted and is currently pending manager approval. Multiple requests are not permitted.`,
      );
      return;
    }

    if (completedTransferAssetIds.has(item.assetId) || item.discrepancy?.resolvedAt) {
      Alert.alert(
        'Transfer Already Finalized',
        `The location transfer for asset "${item.asset.assetCode}" has already been approved and finalized.`,
      );
      return;
    }

    const fromName = item.expectedLocation?.name || 'Unassigned';
    const toName = item.foundLocation?.name || session?.location?.name || 'Current Station';
    setTransferModalItem(item);
    setTransferReason(
      `Audited location discrepancy: Item found at ${toName} (Assigned to ${fromName}). Requesting station relocation transfer.`,
    );
  };

  const handleSubmitTransfer = async () => {
    if (!transferModalItem) return;

    if (pendingTransferAssetIds.has(transferModalItem.assetId)) {
      Alert.alert(
        'Transfer Already Submitted',
        `A transfer request for "${transferModalItem.asset.assetCode}" has already been submitted and is currently pending approval.`,
      );
      setTransferModalItem(null);
      return;
    }

    if (isOfflineMode) {
      Alert.alert(
        'Offline Mode Active',
        'Submitting a transfer request requires an online connection to notify inventory managers. Please reconnect to the network and try again.',
      );
      return;
    }

    const targetLocationId =
      transferModalItem.foundLocation?.id || session?.locationId;

    if (!targetLocationId) {
      Alert.alert(
        'Missing Destination',
        'Could not determine destination location ID for transfer. Please ensure the target station has a valid location code.',
      );
      return;
    }

    setIsSubmittingTransfer(true);
    try {
      await apiRequest('/transfers', {
        method: 'POST',
        body: JSON.stringify({
          assetId: transferModalItem.assetId,
          toLocationId: targetLocationId,
          reason: transferReason.trim() || undefined,
        }),
      });

      // Submit once: lock it in local state immediately so it can never be submitted again
      setPendingTransferAssetIds((prev) => new Set(prev).add(transferModalItem.assetId));

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }

      const assetCode = transferModalItem.asset.assetCode;
      const toName =
        transferModalItem.foundLocation?.name || session?.location?.name || 'Current Station';

      setTransferModalItem(null);
      Alert.alert(
        'Transfer Requested',
        `Transfer request for ${assetCode} to "${toName}" has been submitted successfully and is now pending approval.`,
      );
    } catch (err: any) {
      if (err?.message && (err.message.toLowerCase().includes('already') || err.message.toLowerCase().includes('pending'))) {
        setPendingTransferAssetIds((prev) => new Set(prev).add(transferModalItem.assetId));
      }
      Alert.alert('Transfer Request Notice', err?.message || 'Could not submit transfer request.');
    } finally {
      setIsSubmittingTransfer(false);
    }
  };

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter !== 'ALL') {
        const itemStatus = item.status?.toUpperCase();
        if (statusFilter === 'VERIFIED') {
          if (itemStatus !== 'VERIFIED' && itemStatus !== 'FOUND') return false;
        } else if (statusFilter === 'MISMATCH') {
          const isLocMismatch =
            itemStatus === 'MISMATCH' ||
            itemStatus === 'LOCATION_MISMATCH' ||
            Boolean(
              item.foundLocation &&
                item.expectedLocation &&
                item.foundLocation.id !== item.expectedLocation.id,
            );
          if (!isLocMismatch) return false;
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
    (i) =>
      i.status === 'MISMATCH' ||
      i.status === 'LOCATION_MISMATCH' ||
      Boolean(
        i.expectedLocation &&
          i.foundLocation &&
          i.foundLocation.id !== i.expectedLocation.id,
      ),
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
      case 'LOCATION_MISMATCH':
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

    const displayLabel = status === 'LOCATION_MISMATCH' ? 'MISMATCH' : status;

    return (
      <View style={[styles.itemStatusBadge, { backgroundColor: bg, borderColor: border }]}>
        <Text style={[styles.itemStatusText, { color: text }]}>{displayLabel}</Text>
      </View>
    );
  };

  const renderInventoryItem = ({ item }: { item: SessionAuditItem }) => {
    const isRelocated =
      Boolean(
        item.foundLocation &&
          item.expectedLocation &&
          item.foundLocation.id !== item.expectedLocation.id,
      ) ||
      item.status === 'MISMATCH' ||
      item.status === 'LOCATION_MISMATCH';

    const isTransferFinalized =
      completedTransferAssetIds.has(item.assetId) ||
      Boolean(item.discrepancy?.resolvedAt);

    const isTransferPending = pendingTransferAssetIds.has(item.assetId);

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
          <View style={[styles.relocatedBanner, isTransferFinalized && styles.relocatedBannerFinalized]}>
            <View style={styles.relocatedBannerLeft}>
              <Ionicons
                name={isTransferFinalized ? 'checkmark-circle' : 'warning-outline'}
                size={14}
                color={isTransferFinalized ? '#16a34a' : '#d97706'}
              />
              <Text
                style={[
                  styles.relocatedBannerText,
                  isTransferFinalized && styles.relocatedBannerTextFinalized,
                ]}
                numberOfLines={2}
              >
                {isTransferFinalized
                  ? `Transferred: Moved to ${item.foundLocation?.name || session?.location?.name || 'this station'}`
                  : `Relocated: Scanned at ${item.foundLocation?.name || session?.location?.name || 'different station'}`}
              </Text>
            </View>
            {isTransferFinalized ? (
              <View style={styles.transferCompletedBadge}>
                <Ionicons name="checkmark-circle" size={11} color="#15803d" style={{ marginRight: 3 }} />
                <Text style={styles.transferCompletedBadgeText}>Finalized</Text>
              </View>
            ) : isTransferPending ? (
              <View style={styles.transferPendingBadge}>
                <Ionicons name="time-outline" size={11} color="#b45309" style={{ marginRight: 3 }} />
                <Text style={styles.transferPendingBadgeText}>Transfer Pending</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.transferBtn}
                onPress={() => handleOpenTransferModal(item)}
                activeOpacity={0.8}
              >
                <Ionicons name="swap-horizontal" size={12} color="#ffffff" style={{ marginRight: 4 }} />
                <Text style={styles.transferBtnText}>Transfer</Text>
              </TouchableOpacity>
            )}
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

            {item.status === 'PENDING' && (
              <TouchableOpacity
                style={styles.markMissingRowBtn}
                onPress={() => handleMarkSingleItemMissing(item)}
                activeOpacity={0.8}
              >
                <Ionicons name="alert-circle-outline" size={12} color="#dc2626" style={{ marginRight: 3 }} />
                <Text style={styles.markMissingRowBtnText}>Mark Missing</Text>
              </TouchableOpacity>
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
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
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
        <View
          style={[
            styles.floatingToast,
            scanToast.type === 'error' && styles.floatingToastError,
            scanToast.type === 'warning' && styles.floatingToastWarning,
          ]}
        >
          <Ionicons
            name={
              scanToast.type === 'error'
                ? 'close-circle'
                : scanToast.type === 'warning'
                ? 'alert-circle'
                : 'checkmark-circle'
            }
            size={16}
            color={
              scanToast.type === 'error'
                ? '#dc2626'
                : scanToast.type === 'warning'
                ? '#d97706'
                : '#166534'
            }
          />
          <Text
            style={[
              styles.floatingToastText,
              scanToast.type === 'error' && styles.floatingToastTextError,
              scanToast.type === 'warning' && styles.floatingToastTextWarning,
            ]}
            numberOfLines={2}
          >
            {scanToast.message}
          </Text>
        </View>
      )}

      {/* Main Content Area */}
      {isLoading ? (
        <View style={[styles.loadingContainer, { backgroundColor: theme.colors.background }]}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading session inventory checklist...</Text>
        </View>
      ) : (
        <FlatList
          style={{ flex: 1, backgroundColor: theme.colors.background }}
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
                  <View
                    style={[
                      styles.scannerFeedbackPill,
                      scanToast.type === 'error' && styles.scannerFeedbackPillError,
                      scanToast.type === 'warning' && styles.scannerFeedbackPillWarning,
                    ]}
                  >
                    <Ionicons
                      name={
                        scanToast.type === 'error'
                          ? 'close-circle'
                          : scanToast.type === 'warning'
                          ? 'alert-circle'
                          : 'checkmark-circle'
                      }
                      size={16}
                      color={
                        scanToast.type === 'error'
                          ? '#f87171'
                          : scanToast.type === 'warning'
                          ? '#facc15'
                          : '#4ade80'
                      }
                    />
                    <Text
                      style={[
                        styles.scannerFeedbackText,
                        scanToast.type === 'error' && styles.scannerFeedbackTextError,
                        scanToast.type === 'warning' && styles.scannerFeedbackTextWarning,
                      ]}
                    >
                      {scanToast.message}
                    </Text>
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

      {/* Transfer Request Modal */}
      <Modal
        visible={Boolean(transferModalItem)}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isSubmittingTransfer) setTransferModalItem(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentCard}>
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.modalHeaderIconBadge}>
                  <Ionicons name="swap-horizontal" size={20} color={theme.colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Request Asset Transfer</Text>
                  <Text style={styles.modalSubtitle}>Relocate to current scanned station</Text>
                </View>
              </View>
              <TouchableOpacity
                disabled={isSubmittingTransfer}
                onPress={() => setTransferModalItem(null)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color="#64748b" />
              </TouchableOpacity>
            </View>

            {transferModalItem && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {/* Asset preview */}
                <View style={styles.transferAssetSummary}>
                  <Text style={styles.transferAssetCode}>{transferModalItem.asset.assetCode}</Text>
                  <Text style={styles.transferAssetName} numberOfLines={2}>
                    {transferModalItem.asset.name}
                  </Text>
                </View>

                {/* Location movement route */}
                <View style={styles.transferRouteContainer}>
                  <View style={styles.transferRouteItem}>
                    <Text style={styles.transferRouteLabel}>FROM (ASSIGNED)</Text>
                    <View style={styles.transferRouteValueRow}>
                      <Ionicons name="business-outline" size={15} color="#64748b" style={{ marginRight: 6 }} />
                      <Text style={styles.transferRouteValue} numberOfLines={1}>
                        {transferModalItem.expectedLocation?.name || 'Unassigned'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.transferRouteArrowCol}>
                    <Ionicons name="arrow-down" size={18} color={theme.colors.primary} />
                  </View>

                  <View style={[styles.transferRouteItem, styles.transferRouteItemDestination]}>
                    <Text style={[styles.transferRouteLabel, { color: theme.colors.primary }]}>TO (SCANNED AT)</Text>
                    <View style={styles.transferRouteValueRow}>
                      <Ionicons name="location" size={15} color={theme.colors.primary} style={{ marginRight: 6 }} />
                      <Text style={[styles.transferRouteValue, { color: '#0f172a', fontWeight: '600' }]} numberOfLines={1}>
                        {transferModalItem.foundLocation?.name || session?.location?.name || 'Current Station'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Transfer Reason Input */}
                <Text style={styles.inputLabel}>Reason / Notes</Text>
                <TextInput
                  style={styles.transferReasonInput}
                  value={transferReason}
                  onChangeText={setTransferReason}
                  placeholder="Enter reason for location transfer..."
                  placeholderTextColor="#94a3b8"
                  multiline
                  numberOfLines={3}
                  editable={!isSubmittingTransfer}
                />

                <View style={styles.transferNoticeBox}>
                  <Ionicons name="information-circle-outline" size={16} color="#0369a1" style={{ marginRight: 6 }} />
                  <Text style={styles.transferNoticeText}>
                    Submitting creates a pending transfer in the system. An asset manager can approve this transfer to officially update the station record.
                  </Text>
                </View>
              </ScrollView>
            )}

            <View style={styles.modalFooterActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setTransferModalItem(null)}
                disabled={isSubmittingTransfer}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, isSubmittingTransfer && { opacity: 0.6 }]}
                onPress={handleSubmitTransfer}
                disabled={isSubmittingTransfer}
              >
                {isSubmittingTransfer ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Ionicons name="paper-plane-outline" size={15} color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={styles.modalSubmitBtnText}>Submit Transfer</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
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
    justifyContent: 'space-between',
    backgroundColor: '#fffbeb',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 7,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  relocatedBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
    marginRight: 8,
  },
  relocatedBannerText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400e',
    flex: 1,
  },
  transferBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 5,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  transferBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  transferPendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 5,
  },
  transferPendingBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#b45309',
  },
  relocatedBannerFinalized: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  relocatedBannerTextFinalized: {
    color: '#15803d',
  },
  transferCompletedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 5,
  },
  transferCompletedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803d',
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
  markMissingRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  markMissingRowBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#dc2626',
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
  floatingToastError: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
  },
  floatingToastWarning: {
    backgroundColor: '#fef3c7',
    borderColor: '#fcd34d',
  },
  floatingToastText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
    flex: 1,
  },
  floatingToastTextError: {
    color: '#991b1b',
  },
  floatingToastTextWarning: {
    color: '#92400e',
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
  scannerFeedbackPillError: {
    backgroundColor: 'rgba(153, 27, 27, 0.95)',
    borderColor: '#f87171',
  },
  scannerFeedbackPillWarning: {
    backgroundColor: 'rgba(180, 83, 9, 0.95)',
    borderColor: '#facc15',
  },
  scannerFeedbackText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  scannerFeedbackTextError: {
    color: '#fecaca',
  },
  scannerFeedbackTextWarning: {
    color: '#fef08a',
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
  // Modal styles for Transfer Confirmation
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 440,
    maxHeight: '85%',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 14,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  modalHeaderIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 1,
  },
  modalBody: {
    marginBottom: 12,
  },
  transferAssetSummary: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  transferAssetCode: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.primary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 0.5,
  },
  transferAssetName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginTop: 3,
  },
  transferRouteContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },
  transferRouteItem: {
    paddingVertical: 4,
  },
  transferRouteItemDestination: {
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  transferRouteLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  transferRouteValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transferRouteValue: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '500',
    flex: 1,
  },
  transferRouteArrowCol: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  transferReasonInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: '#0f172a',
    backgroundColor: '#ffffff',
    textAlignVertical: 'top',
    minHeight: 65,
    marginBottom: 12,
  },
  transferNoticeBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 6,
    padding: 9,
    marginBottom: 6,
  },
  transferNoticeText: {
    fontSize: 11,
    color: '#0369a1',
    flex: 1,
    lineHeight: 15,
  },
  modalFooterActions: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  modalSubmitBtn: {
    flex: 1.6,
    flexDirection: 'row',
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
  },
  modalSubmitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});

