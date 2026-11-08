import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../context/AuthContext';
import { theme } from '../config/theme';
import { DEFAULT_PRODUCTION_API_URL, DEFAULT_LOCAL_API_URL } from '../config/env';
import {
  runFullSync,
  getSyncSummary,
  triggerLiveSync,
  subscribeOutboxChanges,
  isOutboxSyncing,
} from '../services/syncManager';

export const ProfileScreen = () => {
  const { user, isOfflineMode, isOnline, serverUrl, setServerUrl, logout } = useAuth();

  const [isServerModalOpen, setIsServerModalOpen] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState(serverUrl);

  const isProduction = serverUrl === DEFAULT_PRODUCTION_API_URL;
  const isLocal = serverUrl === DEFAULT_LOCAL_API_URL;

  const handleSaveCustomServer = async () => {
    if (customUrlInput.trim()) {
      await setServerUrl(customUrlInput.trim());
      setIsServerModalOpen(false);
      Alert.alert('Server Updated', `Active API endpoint set to:\n${customUrlInput.trim()}`);
    }
  };

  // Sync summary state
  const [syncSummary, setSyncSummary] = useState({
    assetCount: 0,
    locationCount: 0,
    lastSyncTime: null as string | null,
    pendingAuditsCount: 0,
    pendingPhotosCount: 0,
    totalOutboxCount: 0,
  });
  const [isSyncingOutbox, setIsSyncingOutbox] = useState(false);
  const [isDownloadingCatalog, setIsDownloadingCatalog] = useState(false);
  const [catalogProgress, setCatalogProgress] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    try {
      const summary = await getSyncSummary();
      setSyncSummary(summary);
      setIsSyncingOutbox(isOutboxSyncing());
    } catch {}
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSummary();
    }, [loadSummary])
  );

  useEffect(() => {
    loadSummary();
    const unsub = subscribeOutboxChanges(() => {
      loadSummary();
    });
    return () => unsub();
  }, [loadSummary]);

  const handleSyncOutbox = async () => {
    if (isOfflineMode) {
      Alert.alert(
        'Offline Mode Active',
        'Device is currently operating offline. Scans are safely stored in local SQLite storage and will synchronize automatically once reconnected.',
      );
      return;
    }

    if (syncSummary.totalOutboxCount === 0) {
      Alert.alert('Cloud Synced', 'All offline audit records and scans are already synchronized with the server.');
      return;
    }

    setIsSyncingOutbox(true);
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    try {
      const res = await triggerLiveSync({ force: true });
      await loadSummary();
      if (res.success && res.totalUploaded > 0) {
        Alert.alert(
          'Sync Successful',
          `Successfully synchronized ${res.totalUploaded} offline audit records with the cloud database.`,
        );
      } else if (res.success) {
        Alert.alert('Sync Complete', 'All records are up to date.');
      } else {
        Alert.alert('Sync Notice', 'Could not reach server. Data remains securely saved in local SQLite.');
      }
    } catch {
      Alert.alert('Sync Error', 'An error occurred during synchronization.');
    } finally {
      setIsSyncingOutbox(false);
    }
  };

  const handleDownloadCatalog = async () => {
    if (isOfflineMode) {
      Alert.alert('Offline Mode', 'Internet connection required to download full catalog.');
      return;
    }

    if (syncSummary.totalOutboxCount > 0) {
      Alert.alert(
        'Pending Outbox Items',
        `You have ${syncSummary.totalOutboxCount} offline scan${syncSummary.totalOutboxCount > 1 ? 's' : ''} / photo${syncSummary.totalOutboxCount > 1 ? 's' : ''} pending upload.\n\nPlease tap "Sync Offline Outbox" first to synchronize all pending records to the cloud before refreshing the full catalog.`,
      );
      return;
    }

    Alert.alert(
      'Download Full Catalog',
      'This will re-download and index all equipment assets and factory locations into native SQLite for 100% offline auditing.\n\nProceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Download Now',
          onPress: async () => {
            setIsDownloadingCatalog(true);
            setCatalogProgress('Connecting to server...');
            try {
              const res = await runFullSync((p) => {
                setCatalogProgress(p.message);
              });
              await loadSummary();
              Alert.alert(
                'Offline Database Ready',
                `Successfully indexed ${res.assetCount.toLocaleString()} assets and ${res.locationCount.toLocaleString()} locations into native SQLite.\n\nTerminal is ready for offline floor scanning!`,
              );
            } catch (err: any) {
              Alert.alert('Download Failed', err?.message || 'Could not download catalog.');
            } finally {
              setIsDownloadingCatalog(false);
              setCatalogProgress(null);
            }
          },
        },
      ],
    );
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out from this terminal?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>
              {(user?.name || user?.email || 'A').charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.profileName}>{user?.name || 'Operator'}</Text>
          <Text style={styles.profileEmail}>{user?.email || 'admin@assetmgmt.com'}</Text>
          <View style={styles.rolePill}>
            <Text style={styles.rolePillText}>{user?.role || 'AUDITOR'}</Text>
          </View>
        </View>

        {/* Status Card */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Terminal Connectivity</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Mode:</Text>
            <View
              style={[
                styles.statusBadge,
                isOnline ? styles.statusBadgeOnline : styles.statusBadgeOffline,
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  isOnline ? styles.statusDotOnline : styles.statusDotOffline,
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  isOnline ? styles.statusTextOnline : styles.statusTextOffline,
                ]}
              >
                {isOnline ? 'Online Connected' : 'Offline (No Connection)'}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Active Endpoint:</Text>
            <Text style={styles.infoValue} numberOfLines={1} ellipsizeMode="middle">
              {serverUrl}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.switchServerButton}
            onPress={() => {
              setCustomUrlInput(serverUrl);
              setIsServerModalOpen(true);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.switchServerText}>⚙ Configure Server Endpoint</Text>
          </TouchableOpacity>
        </View>

        {/* Offline Sync & Storage Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardHeaderTitle}>Offline Sync & Database</Text>
              <Text style={styles.cardHeaderSub}>Native SQLite floor storage</Text>
            </View>
            <View
              style={[
                styles.syncPill,
                !isOnline
                  ? styles.syncPillOffline
                  : syncSummary.totalOutboxCount > 0
                  ? styles.syncPillPending
                  : styles.syncPillSynced,
              ]}
            >
              <Ionicons
                name={
                  !isOnline
                    ? 'cloud-offline-outline'
                    : syncSummary.totalOutboxCount > 0
                    ? 'cloud-upload-outline'
                    : 'checkmark-circle-outline'
                }
                size={12}
                color={!isOnline ? '#dc2626' : syncSummary.totalOutboxCount > 0 ? '#b45309' : '#15803d'}
                style={{ marginRight: 4 }}
              />
              <Text
                style={[
                  styles.syncPillText,
                  !isOnline
                    ? styles.syncPillTextOffline
                    : syncSummary.totalOutboxCount > 0
                    ? styles.syncPillTextPending
                    : styles.syncPillTextSynced,
                ]}
              >
                {!isOnline
                  ? syncSummary.totalOutboxCount > 0
                    ? `${syncSummary.totalOutboxCount} Offline`
                    : 'Offline'
                  : syncSummary.totalOutboxCount > 0
                  ? `${syncSummary.totalOutboxCount} Pending`
                  : 'Cloud Synced'}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Queued Outbox Scans:</Text>
            <Text style={[styles.infoValue, syncSummary.totalOutboxCount > 0 && { color: '#b45309', fontWeight: '700' }]}>
              {syncSummary.totalOutboxCount} records
              {syncSummary.totalOutboxCount > 0
                ? ` (${syncSummary.pendingAuditsCount} audits, ${syncSummary.pendingPhotosCount} photos)`
                : ' (all synced)'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Cached Local Assets:</Text>
            <Text style={styles.infoValue}>
              {syncSummary.assetCount > 0 ? `${syncSummary.assetCount.toLocaleString()} items` : '0 items'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Cached Locations:</Text>
            <Text style={styles.infoValue}>
              {syncSummary.locationCount > 0 ? `${syncSummary.locationCount.toLocaleString()} stations` : '0 stations'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Last Database Sync:</Text>
            <Text style={styles.infoValue}>
              {syncSummary.lastSyncTime
                ? new Date(syncSummary.lastSyncTime).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    day: '2-digit',
                    month: 'short',
                  })
                : 'Never synced'}
            </Text>
          </View>

          {/* Sync Outbox Button */}
          <TouchableOpacity
            style={[
              styles.primarySyncButton,
              (isSyncingOutbox || isDownloadingCatalog || syncSummary.totalOutboxCount === 0) && styles.primarySyncButtonDisabled,
            ]}
            onPress={handleSyncOutbox}
            disabled={isSyncingOutbox || isDownloadingCatalog || syncSummary.totalOutboxCount === 0}
            activeOpacity={0.8}
          >
            {isSyncingOutbox ? (
              <ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 8 }} />
            ) : (
              <Ionicons name="cloud-upload" size={16} color="#ffffff" style={{ marginRight: 8 }} />
            )}
            <Text style={styles.primarySyncButtonText}>
              {isSyncingOutbox
                ? 'Synchronizing Scans...'
                : syncSummary.totalOutboxCount > 0
                ? `Sync Offline Outbox (${syncSummary.totalOutboxCount} Pending)`
                : 'Offline Outbox Synchronized'}
            </Text>
          </TouchableOpacity>

          {/* Download Full Offline Catalog Button */}
          <TouchableOpacity
            style={[
              styles.secondarySyncButton,
              (isDownloadingCatalog || isSyncingOutbox || syncSummary.totalOutboxCount > 0) && styles.secondarySyncButtonDisabled,
            ]}
            onPress={handleDownloadCatalog}
            disabled={isDownloadingCatalog || isSyncingOutbox || syncSummary.totalOutboxCount > 0}
            activeOpacity={0.8}
          >
            {isDownloadingCatalog ? (
              <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginRight: 8 }} />
            ) : (
              <Ionicons
                name="cloud-download-outline"
                size={16}
                color={syncSummary.totalOutboxCount > 0 ? '#94a3b8' : theme.colors.primary}
                style={{ marginRight: 8 }}
              />
            )}
            <Text
              style={[
                styles.secondarySyncButtonText,
                syncSummary.totalOutboxCount > 0 && styles.secondarySyncButtonTextDisabled,
              ]}
            >
              {isDownloadingCatalog ? 'Downloading Catalog...' : 'Download / Refresh Full Catalog'}
            </Text>
          </TouchableOpacity>

          {syncSummary.totalOutboxCount > 0 && (
            <View style={styles.syncBlockedNotice}>
              <Ionicons name="information-circle-outline" size={14} color="#b45309" style={{ marginRight: 4 }} />
              <Text style={styles.syncBlockedNoticeText}>
                Catalog refresh is disabled until {syncSummary.totalOutboxCount} offline outbox item{syncSummary.totalOutboxCount > 1 ? 's are' : ' is'} synced to cloud.
              </Text>
            </View>
          )}

          {catalogProgress && (
            <Text style={styles.catalogProgressText} numberOfLines={1}>
              {catalogProgress}
            </Text>
          )}
        </View>

        {/* System Info Card */}
        <View style={styles.card}>
          <Text style={styles.cardHeader}>Application Details</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>App Version:</Text>
            <Text style={styles.infoValue}>1.0.0 (Native Expo SDK 58)</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Database Engine:</Text>
            <Text style={styles.infoValue}>SQLite WAL Native C-Core</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Security:</Text>
            <Text style={styles.infoValue}>Hardware Keystore (SecureStore)</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Organization:</Text>
            <Text style={styles.infoValue}>Crystal Martin Bangladesh Ltd.</Text>
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.85}>
          <Text style={styles.logoutButtonText}>Sign Out from Terminal</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Server Switcher Modal */}
      <Modal
        visible={isServerModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsServerModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Server Endpoint</Text>
            <Text style={styles.modalSubtitle}>Choose API environment for this device:</Text>

            <TouchableOpacity
              style={[styles.presetButton, isProduction && styles.presetButtonActive]}
              onPress={() => {
                setServerUrl(DEFAULT_PRODUCTION_API_URL);
                setIsServerModalOpen(false);
              }}
            >
              <Text style={styles.presetTitle}>Production IIS Server</Text>
              <Text style={styles.presetUrl}>{DEFAULT_PRODUCTION_API_URL}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.presetButton, isLocal && styles.presetButtonActive]}
              onPress={() => {
                setServerUrl(DEFAULT_LOCAL_API_URL);
                setIsServerModalOpen(false);
              }}
            >
              <Text style={styles.presetTitle}>Local Development API</Text>
              <Text style={styles.presetUrl}>{DEFAULT_LOCAL_API_URL}</Text>
            </TouchableOpacity>

            <View style={styles.customUrlGroup}>
              <Text style={styles.customUrlLabel}>Custom Host / Wi-Fi IP:</Text>
              <TextInput
                style={styles.customInput}
                placeholder="http://192.168.1.50:3001/api/v1"
                placeholderTextColor={theme.colors.textLight}
                autoCapitalize="none"
                autoCorrect={false}
                value={customUrlInput}
                onChangeText={setCustomUrlInput}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setIsServerModalOpen(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={handleSaveCustomServer}
              >
                <Text style={styles.modalConfirmText}>Save Endpoint</Text>
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
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 10,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    ...theme.shadows.card,
  },
  avatarInitial: {
    fontSize: 26,
    fontWeight: '800',
    color: '#ffffff',
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  profileEmail: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  rolePill: {
    backgroundColor: theme.colors.primaryLight,
    borderWidth: 1,
    borderColor: theme.colors.primaryBorder,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 8,
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    padding: 16,
    marginBottom: 16,
    ...theme.shadows.sm,
  },
  cardHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
    paddingBottom: 8,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
    paddingBottom: 8,
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  cardHeaderSub: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  syncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
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
  primarySyncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingVertical: 11,
    marginTop: 12,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  primarySyncButtonDisabled: {
    backgroundColor: '#94a3b8',
    opacity: 0.8,
  },
  primarySyncButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  secondarySyncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 8,
  },
  secondarySyncButtonText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  secondarySyncButtonDisabled: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
    opacity: 0.65,
  },
  secondarySyncButtonTextDisabled: {
    color: '#94a3b8',
  },
  syncBlockedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fef3c7',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 6,
  },
  syncBlockedNoticeText: {
    fontSize: 11,
    color: '#b45309',
    fontWeight: '500',
    flex: 1,
  },
  catalogProgressText: {
    fontSize: 11,
    color: theme.colors.primary,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 6,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  infoLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.textPrimary,
    maxWidth: '65%',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusBadgeOnline: {
    backgroundColor: theme.colors.successLight,
    borderWidth: 1,
    borderColor: theme.colors.successBorder,
  },
  statusBadgeOffline: {
    backgroundColor: theme.colors.warningLight,
    borderWidth: 1,
    borderColor: theme.colors.warningBorder,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusDotOnline: {
    backgroundColor: theme.colors.success,
  },
  statusDotOffline: {
    backgroundColor: theme.colors.warning,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusTextOnline: {
    color: theme.colors.success,
  },
  statusTextOffline: {
    color: theme.colors.warning,
  },
  switchServerButton: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
    marginTop: 12,
  },
  switchServerText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  logoutButton: {
    backgroundColor: theme.colors.dangerLight,
    borderWidth: 1,
    borderColor: theme.colors.dangerBorder,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  logoutButtonText: {
    color: theme.colors.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    ...theme.shadows.card,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginBottom: 16,
  },
  presetButton: {
    backgroundColor: theme.colors.background,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    marginBottom: 10,
  },
  presetButtonActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  presetTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  presetUrl: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  customUrlGroup: {
    marginTop: 6,
    marginBottom: 16,
  },
  customUrlLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 6,
    fontWeight: '500',
  },
  customInput: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: theme.colors.textPrimary,
    fontSize: 13,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalCancel: {
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  modalCancelText: {
    color: theme.colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  modalConfirm: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalConfirmText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
});

