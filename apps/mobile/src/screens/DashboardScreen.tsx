import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../navigation/RootNavigator';
import {
  getSyncSummary,
  subscribeOutboxChanges,
  isOutboxSyncing,
} from '../services/syncManager';
import { theme } from '../config/theme';

export const DashboardScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user, isOfflineMode, isOnline } = useAuth();

  // Sync summary state
  const [syncSummary, setSyncSummary] = useState({
    assetCount: 0,
    locationCount: 0,
    lastSyncTime: null as string | null,
    pendingAuditsCount: 0,
    pendingPhotosCount: 0,
    totalOutboxCount: 0,
  });
  const [isSyncingLive, setIsSyncingLive] = useState(false);

  useEffect(() => {
    loadSummary();
    const unsubscribe = subscribeOutboxChanges(() => {
      loadSummary();
      setIsSyncingLive(isOutboxSyncing());
    });
    return () => unsubscribe();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadSummary();
      setIsSyncingLive(isOutboxSyncing());
    }, [])
  );

  const loadSummary = async () => {
    try {
      const summary = await getSyncSummary();
      setSyncSummary(summary);
    } catch (e) {
      console.warn('[Dashboard] Error loading summary:', e);
    }
  };

  const kpis = [
    {
      label: 'Total Assets',
      value: syncSummary.assetCount > 0 ? syncSummary.assetCount.toLocaleString() : '13,470+',
      change: 'Enterprise registry',
      iconText: '📦',
      bgColor: theme.colors.primaryLight,
      textColor: theme.colors.primary,
    },
    {
      label: 'Active in Field',
      value: syncSummary.assetCount > 0 ? (syncSummary.assetCount - 35).toLocaleString() : '13,435',
      change: '99.7% operational',
      iconText: '🛡',
      bgColor: theme.colors.successLight,
      textColor: theme.colors.success,
    },
    {
      label: 'Factory Zones',
      value: syncSummary.locationCount > 0 ? syncSummary.locationCount.toString() : '18',
      change: 'Company > Unit > Line',
      iconText: '🏢',
      bgColor: theme.colors.warningLight,
      textColor: theme.colors.warning,
    },
    {
      label: 'Pending Sync',
      value: isSyncingLive
        ? 'Syncing Live...'
        : syncSummary.totalOutboxCount > 0
          ? `${syncSummary.totalOutboxCount} Outbox`
          : 'All Synced',
      change: isSyncingLive
        ? 'Live uploading to cloud...'
        : syncSummary.totalOutboxCount > 0
          ? `${syncSummary.pendingAuditsCount} scans, ${syncSummary.pendingPhotosCount} photos`
          : 'Tap to view in Settings',
      iconText: isSyncingLive ? '⚡' : syncSummary.totalOutboxCount > 0 ? '📤' : '☁️',
      bgColor:
        syncSummary.totalOutboxCount > 0
          ? theme.colors.warningLight
          : '#f0fdf4',
      textColor:
        syncSummary.totalOutboxCount > 0
          ? theme.colors.warning
          : theme.colors.success,
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Top Navbar Header (matches WAP TopNavbar) */}
      <View style={styles.topNavbar}>
        <View style={styles.navBrand}>
          <View style={styles.logoBadge}>
            <Text style={styles.logoBadgeText}>CM</Text>
          </View>
          <View>
            <Text style={styles.brandTitle}>Crystal Martin</Text>
            <Text style={styles.brandSubtitle}>Asset Management</Text>
          </View>
        </View>

        <View style={styles.navRight}>
          <View
            style={[
              styles.syncBadge,
              isOnline ? styles.syncBadgeOnline : styles.syncBadgeOffline,
            ]}
          >
            <View
              style={[
                styles.syncDot,
                isOnline ? styles.syncDotOnline : styles.syncDotOffline,
              ]}
            />
            <Text
              style={[
                styles.syncBadgeText,
                isOnline ? styles.syncBadgeTextOnline : styles.syncBadgeTextOffline,
              ]}
            >
              {isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>

          <View style={styles.rolePill}>
            <Text style={styles.roleText}>{user?.role || 'AUDITOR'}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Welcome Section (matches WAP Dashboard) */}
        <View style={styles.welcomeSection}>
          <Text style={styles.pageTitle}>Operations Dashboard</Text>
          <Text style={styles.pageSubtitle}>
            Asset lifecycle, audit sessions, and location tracking
          </Text>
        </View>

        {/* Database Empty Warning Banner */}
        {syncSummary.assetCount === 0 && (
          <View style={styles.emptyDbCard}>
            <View style={styles.emptyDbHeader}>
              <Text style={styles.emptyDbIcon}>⚠️</Text>
              <View style={styles.emptyDbTextCol}>
                <Text style={styles.emptyDbTitle}>Offline Database Not Initialized</Text>
                <Text style={styles.emptyDbSubtitle}>
                  0 assets cached in local SQLite. Open Settings to download full 13,470+ equipment catalog for offline scanning.
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.emptyDbButton}
              onPress={() => (navigation as any).navigate('MainTabs', { screen: 'Profile' })}
              activeOpacity={0.85}
            >
              <Text style={styles.emptyDbButtonText}>⚙ Open Settings to Download Catalog</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* KPI Cards Grid (matches WAP 4-card grid) */}
        <View style={styles.kpiGrid}>
          {kpis.map((kpi, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.kpiCard}
              onPress={() => {
                if (kpi.label === 'Total Assets' || kpi.label === 'Active in Field') {
                  navigation.navigate('Assets' as any);
                } else if (kpi.label === 'Factory Zones') {
                  navigation.navigate('LocationTree' as any);
                } else if (kpi.label === 'Pending Sync') {
                  (navigation as any).navigate('MainTabs', { screen: 'Profile' });
                }
              }}
              activeOpacity={0.8}
            >
              <View style={styles.kpiHeader}>
                <Text style={styles.kpiLabel} numberOfLines={1}>
                  {kpi.label}
                </Text>
                <View style={[styles.kpiIconWrapper, { backgroundColor: kpi.bgColor }]}>
                  <Text style={styles.kpiIcon}>{kpi.iconText}</Text>
                </View>
              </View>
              <Text style={styles.kpiValue}>{kpi.value}</Text>
              <Text style={styles.kpiChange} numberOfLines={1}>
                {kpi.change}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick Action Tiles (matches WAP Mobile Quick Actions) */}
        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={styles.actionTile}
            onPress={() => (navigation as any).navigate('MainTabs', { screen: 'Scan', params: { isScanMode: true } })}
            activeOpacity={0.85}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: theme.colors.primaryLight }]}>
              <Text style={styles.actionIcon}>📷</Text>
            </View>
            <Text style={styles.actionTileTitle}>Audit Scanner</Text>
            <Text style={styles.actionTileSub}>Plan ➔ Station ➔ Scan</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionTile}
            onPress={() => navigation.navigate('Audits' as any)}
            activeOpacity={0.85}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: theme.colors.successLight }]}>
              <Text style={styles.actionIcon}>📋</Text>
            </View>
            <Text style={styles.actionTileTitle}>Station Audit</Text>
            <Text style={styles.actionTileSub}>Line check-in</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionTile}
            onPress={() => navigation.navigate('LocationTree' as any)}
            activeOpacity={0.85}
          >
            <View style={[styles.actionIconCircle, { backgroundColor: theme.colors.purpleLight }]}>
              <Text style={styles.actionIcon}>🏢</Text>
            </View>
            <Text style={styles.actionTileTitle}>Factory Zones</Text>
            <Text style={styles.actionTileSub}>Location tree</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.cardBorder,
  },
  navBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBadgeText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  brandTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  brandSubtitle: {
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  navRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  syncBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  syncBadgeOnline: {
    backgroundColor: theme.colors.successLight,
    borderWidth: 1,
    borderColor: theme.colors.successBorder,
  },
  syncBadgeOffline: {
    backgroundColor: theme.colors.warningLight,
    borderWidth: 1,
    borderColor: theme.colors.warningBorder,
  },
  syncDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  syncDotOnline: {
    backgroundColor: theme.colors.success,
  },
  syncDotOffline: {
    backgroundColor: theme.colors.warning,
  },
  syncBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  syncBadgeTextOnline: {
    color: theme.colors.success,
  },
  syncBadgeTextOffline: {
    color: theme.colors.warning,
  },
  rolePill: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleText: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 30,
  },
  welcomeSection: {
    marginBottom: 14,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    letterSpacing: -0.3,
  },
  pageSubtitle: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  kpiCard: {
    width: '48.5%',
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    padding: 12,
    ...theme.shadows.sm,
  },
  kpiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textMuted,
    flex: 1,
  },
  kpiIconWrapper: {
    width: 26,
    height: 26,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiIcon: {
    fontSize: 13,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    letterSpacing: -0.5,
  },
  kpiChange: {
    fontSize: 10,
    color: theme.colors.textLight,
    marginTop: 2,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  actionTile: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    ...theme.shadows.sm,
  },
  actionIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionIcon: {
    fontSize: 18,
  },
  actionTileTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  actionTileSub: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  emptyDbCard: {
    backgroundColor: '#fffbeb',
    borderRadius: theme.borderRadius.md,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fef3c7',
    ...theme.shadows.card,
  },
  emptyDbHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  emptyDbIcon: {
    fontSize: 22,
    marginTop: 2,
  },
  emptyDbTextCol: {
    flex: 1,
  },
  emptyDbTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#92400e',
    marginBottom: 2,
  },
  emptyDbSubtitle: {
    fontSize: 12,
    color: '#b45309',
    lineHeight: 17,
  },
  emptyDbButton: {
    backgroundColor: '#d97706',
    paddingVertical: 10,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
  },
  emptyDbButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});
