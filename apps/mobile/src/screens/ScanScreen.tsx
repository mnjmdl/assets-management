import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/RootNavigator';
import { ScannerView } from '../components/ScannerView';
import {
  findCachedAsset,
  findCachedLocation,
  CachedAsset,
  CachedLocation,
  recordOfflineAudit,
  getAssetCount,
} from '../database/db';
import { flushAllOutbox, runFullSync, triggerLiveSync } from '../services/syncManager';
import { theme } from '../config/theme';

export const ScanScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [asset, setAsset] = useState<CachedAsset | null>(null);
  const [matchedLocation, setMatchedLocation] = useState<CachedLocation | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isDbEmpty, setIsDbEmpty] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [recentScans, setRecentScans] = useState<
    Array<{ code: string; name: string; status: string; time: string }>
  >([]);

  useEffect(() => {
    return () => {
      (navigation as any).setOptions({ tabBarStyle: undefined });
      navigation.getParent()?.setOptions({ tabBarStyle: undefined });
    };
  }, [navigation]);

  const handleCameraActiveChange = (isActive: boolean) => {
    const tabStyle = isActive ? { display: 'none' } : undefined;
    (navigation as any).setOptions({ tabBarStyle: tabStyle });
    navigation.getParent()?.setOptions({ tabBarStyle: tabStyle });
  };

  const handleScan = async (code: string) => {
    setScannedCode(code);
    setNotFound(false);
    setSyncStatus(null);
    setMatchedLocation(null);

    // 1. Fast indexed SQLite query for equipment asset
    const found = await findCachedAsset(code);

    if (found) {
      setAsset(found);
      setMatchedLocation(null);
      setNotFound(false);
      setIsDbEmpty(false);
      return;
    }

    // 2. Check if code is a Location QR Placard (e.g. LOC:B1MF or B1MF)
    const foundLoc = await findCachedLocation(code);
    if (foundLoc) {
      setMatchedLocation(foundLoc);
      setAsset(null);
      setNotFound(false);
      setIsDbEmpty(false);
      return;
    }

    setAsset(null);
    setMatchedLocation(null);
    setNotFound(true);
    const count = await getAssetCount();
    setIsDbEmpty(count === 0);
  };

  const handleDirectSync = async () => {
    setIsSyncing(true);
    setSyncStatus('Downloading catalog...');
    try {
      await runFullSync((p) => {
        setSyncStatus(p.message);
      });
      setNotFound(false);
      setIsDbEmpty(false);
      Alert.alert('Sync Complete', '13,470+ equipment records cached. Ready to scan!');
      // Re-evaluate previously scanned code if present
      if (scannedCode) {
        handleScan(scannedCode);
      }
    } catch (err: any) {
      Alert.alert('Sync Failed', err?.message || 'Could not connect to server.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConfirmAudit = async (status: 'FOUND' | 'DAMAGED' | 'LOCATION_MISMATCH') => {
    if (!asset) return;

    if (recentScans.some((s) => s.code === asset.assetCode)) {
      Alert.alert(
        'Duplicate Asset Scanned',
        `⚠️ Equipment ${asset.assetCode} (${asset.name}) has already been recorded in this scanning batch.\n\nDuplicate scanning is not allowed and this record was NOT saved.`,
      );
      return;
    }

    try {
      const now = new Date().toISOString();

      await recordOfflineAudit({
        id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        assetId: asset.id,
        assetCode: asset.assetCode,
        scannedCode: scannedCode || asset.assetCode,
        status,
        verifiedLocationId: asset.locationId,
        notes: `Scanned on terminal (${status})`,
        auditedAt: now,
      });

      // Live synchronized in background if online
      triggerLiveSync().catch(() => {});

      // Append to recent scan log
      setRecentScans((prev) => [
        {
          code: asset.assetCode,
          name: asset.name,
          status,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
        ...prev.slice(0, 9),
      ]);

      Alert.alert('Scan Recorded', `Asset ${asset.assetCode} recorded as ${status}.`);
      setAsset(null);
      setScannedCode(null);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to record audit');
    }
  };

  const handleClear = () => {
    setAsset(null);
    setMatchedLocation(null);
    setScannedCode(null);
    setNotFound(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Top Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Asset Barcode Scanner</Text>
          <Text style={styles.subtitle}>
            Continuous camera & laser gun scanner with 0ms SQLite matching
          </Text>
        </View>

        {/* Scanner Component (Hardware wedge & on-demand camera) */}
        <ScannerView
          onScan={handleScan}
          isScanningLocked={asset !== null || matchedLocation !== null}
          onCameraActiveChange={handleCameraActiveChange}
        />

        {/* Scanned Location Placard Card */}
        {matchedLocation && (
          <View style={styles.locationCard}>
            <View style={styles.locationHeaderRow}>
              <View style={styles.locationIconBadge}>
                <Ionicons name="location" size={24} color={theme.colors.primary} />
              </View>
              <View style={styles.locationHeaderInfo}>
                <Text style={styles.locationCardTitle}>{matchedLocation.name}</Text>
                <Text style={styles.locationCardSub}>
                  {matchedLocation.type} • Code: {matchedLocation.code}
                </Text>
              </View>
            </View>

            {matchedLocation.fullPath && (
              <View style={styles.pathRow}>
                <Ionicons name="git-branch-outline" size={14} color={theme.colors.textMuted} />
                <Text style={styles.pathText} numberOfLines={1}>
                  {matchedLocation.fullPath}
                </Text>
              </View>
            )}

            <View style={styles.locationActionButtons}>
              <TouchableOpacity
                style={styles.locationAuditBtn}
                onPress={() => {
                  const loc = matchedLocation;
                  handleClear();
                  (navigation as any).navigate('MainTabs', {
                    screen: 'Audits',
                    params: { initialLocation: loc },
                  });
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="clipboard-outline" size={17} color="#ffffff" style={{ marginRight: 6 }} />
                <Text style={styles.locationAuditBtnText}>Start Station Audit Here</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.locationViewBtn}
                onPress={() => {
                  const loc = matchedLocation;
                  handleClear();
                  (navigation as any).navigate('MainTabs', {
                    screen: 'Assets',
                    params: { search: loc.name },
                  });
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="cube-outline" size={17} color={theme.colors.primary} style={{ marginRight: 6 }} />
                <Text style={styles.locationViewBtnText}>View Equipment at Station</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.clearBtn} onPress={handleClear} activeOpacity={0.8}>
                <Text style={styles.clearBtnText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Scanned Result Card */}
        {asset && (
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <View style={styles.resultTitleCol}>
                <Text style={styles.assetCodeText}>{asset.assetCode}</Text>
                <Text style={styles.assetNameText}>{asset.name}</Text>
              </View>
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>{asset.status}</Text>
              </View>
            </View>

            <View style={styles.detailsGrid}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>SAP Asset Code:</Text>
                <Text style={styles.detailValue}>{asset.sapAssetCode || '—'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Model / Serial:</Text>
                <Text style={styles.detailValue}>
                  {asset.model || '—'} {asset.serialNumber ? `(${asset.serialNumber})` : ''}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Current Location:</Text>
                <Text style={styles.detailValueHighlight}>
                  {asset.locationName || 'Unassigned Line'}
                </Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Condition:</Text>
                <Text style={styles.detailValue}>{asset.condition || 'GOOD'}</Text>
              </View>
            </View>

            {/* Audit Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.detailLinkBtn}
                onPress={() =>
                  navigation.navigate('AssetDetail', {
                    assetCode: asset.assetCode,
                    assetId: asset.id,
                  })
                }
                activeOpacity={0.85}
              >
                <Text style={styles.detailLinkText}>🔍 Full Asset Profile & Condition Photos</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={() => handleConfirmAudit('FOUND')}
                activeOpacity={0.85}
              >
                <Text style={styles.confirmBtnText}>✓ Verify Location (Found)</Text>
              </TouchableOpacity>

              <View style={styles.subActionRow}>
                <TouchableOpacity
                  style={styles.flagBtn}
                  onPress={() => handleConfirmAudit('DAMAGED')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.flagBtnText}>⚠ Flag Damaged</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.clearBtn}
                  onPress={handleClear}
                  activeOpacity={0.8}
                >
                  <Text style={styles.clearBtnText}>Dismiss</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Not Found Banner */}
        {notFound && (
          <View style={[styles.notFoundCard, isDbEmpty && styles.notFoundEmptyCard]}>
            <Text style={[styles.notFoundTitle, isDbEmpty && styles.notFoundEmptyTitle]}>
              {isDbEmpty ? 'Offline Database is Empty' : 'Tag Not Found'}
            </Text>
            <Text style={[styles.notFoundText, isDbEmpty && styles.notFoundEmptyText]}>
              {isDbEmpty
                ? 'Your device has 0 cached assets in local SQLite. Download the 13,470+ equipment catalog to enable instant recognition.'
                : `No cached equipment matching code "${scannedCode}" was found in local database.`}
            </Text>

            {isDbEmpty && (
              <TouchableOpacity
                style={styles.directSyncBtn}
                onPress={handleDirectSync}
                disabled={isSyncing}
                activeOpacity={0.85}
              >
                {isSyncing ? (
                  <View style={styles.syncRow}>
                    <ActivityIndicator size="small" color="#ffffff" />
                    <Text style={styles.directSyncBtnText}>{syncStatus || 'Syncing...'}</Text>
                  </View>
                ) : (
                  <Text style={styles.directSyncBtnText}>🔄 Download 13k+ Asset Catalog Now</Text>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.clearNotFoundBtn} onPress={handleClear}>
              <Text style={styles.clearNotFoundText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Recent Session Scans Log */}
        {recentScans.length > 0 && (
          <View style={styles.logCard}>
            <Text style={styles.logTitle}>Recent Scans in This Session</Text>
            {recentScans.map((item, idx) => (
              <View key={idx} style={styles.logItem}>
                <View style={styles.logInfo}>
                  <Text style={styles.logCode}>{item.code}</Text>
                  <Text style={styles.logName} numberOfLines={1}>
                    {item.name}
                  </Text>
                </View>
                <View style={styles.logMeta}>
                  <Text
                    style={[
                      styles.logStatus,
                      item.status === 'FOUND' ? styles.logStatusFound : styles.logStatusFlag,
                    ]}
                  >
                    {item.status}
                  </Text>
                  <Text style={styles.logTime}>{item.time}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
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
  header: {
    marginBottom: 8,
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
  resultCard: {
    backgroundColor: '#ffffff',
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.primaryBorder,
    marginTop: 12,
    ...theme.shadows.card,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
    paddingBottom: 10,
    marginBottom: 12,
  },
  resultTitleCol: {
    flex: 1,
    marginRight: 10,
  },
  assetCodeText: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  assetNameText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    marginTop: 2,
  },
  statusBadge: {
    backgroundColor: theme.colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.successBorder,
  },
  statusBadgeText: {
    color: theme.colors.success,
    fontSize: 11,
    fontWeight: '700',
  },
  detailsGrid: {
    marginBottom: 14,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  detailLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  detailValue: {
    fontSize: 12,
    color: theme.colors.textPrimary,
    fontWeight: '500',
  },
  detailValueHighlight: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  actionButtons: {
    gap: 8,
  },
  detailLinkBtn: {
    backgroundColor: theme.colors.primaryLight,
    borderWidth: 1,
    borderColor: theme.colors.primaryBorder,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
  },
  detailLinkText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  confirmBtn: {
    backgroundColor: theme.colors.success,
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
  },
  confirmBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  subActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  flagBtn: {
    flex: 1,
    backgroundColor: theme.colors.warningLight,
    borderWidth: 1,
    borderColor: theme.colors.warningBorder,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
  },
  flagBtnText: {
    color: theme.colors.warning,
    fontSize: 12,
    fontWeight: '600',
  },
  clearBtn: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
  },
  clearBtnText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  locationCard: {
    backgroundColor: '#ffffff',
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.primaryBorder,
    marginTop: 12,
    ...theme.shadows.card,
  },
  locationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  locationIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  locationHeaderInfo: {
    flex: 1,
  },
  locationCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  locationCardSub: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
    fontWeight: '600',
  },
  pathRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 14,
    gap: 6,
  },
  pathText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    flex: 1,
  },
  locationActionButtons: {
    gap: 8,
  },
  locationAuditBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingVertical: 11,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationAuditBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  locationViewBtn: {
    backgroundColor: theme.colors.primaryLight,
    borderWidth: 1,
    borderColor: theme.colors.primaryBorder,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationViewBtnText: {
    color: theme.colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  notFoundCard: {
    backgroundColor: theme.colors.dangerLight,
    borderRadius: theme.borderRadius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.dangerBorder,
    marginTop: 12,
  },
  notFoundTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.danger,
    marginBottom: 2,
  },
  notFoundText: {
    fontSize: 12,
    color: theme.colors.danger,
    marginBottom: 10,
  },
  notFoundEmptyCard: {
    backgroundColor: '#fffbeb',
    borderColor: '#fef3c7',
  },
  notFoundEmptyTitle: {
    color: '#92400e',
  },
  notFoundEmptyText: {
    color: '#b45309',
  },
  directSyncBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    marginBottom: 10,
  },
  directSyncBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  clearNotFoundBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: theme.colors.dangerBorder,
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  clearNotFoundText: {
    color: theme.colors.danger,
    fontSize: 11,
    fontWeight: '600',
  },
  logCard: {
    backgroundColor: '#ffffff',
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    marginTop: 16,
    ...theme.shadows.sm,
  },
  logTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 8,
  },
  logItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  logInfo: {
    flex: 1,
    marginRight: 10,
  },
  logCode: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  logName: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  logMeta: {
    alignItems: 'flex-end',
  },
  logStatus: {
    fontSize: 10,
    fontWeight: '700',
  },
  logStatusFound: {
    color: theme.colors.success,
  },
  logStatusFlag: {
    color: theme.colors.warning,
  },
  logTime: {
    fontSize: 9,
    color: theme.colors.textLight,
    marginTop: 1,
  },
});
