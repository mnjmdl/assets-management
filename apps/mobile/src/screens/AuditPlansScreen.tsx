import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { apiRequest } from '../services/api';
import { storage } from '../services/storage';
import { useAuth } from '../context/AuthContext';
import { getAllCachedLocations, CachedLocation } from '../database/db';
import {
  triggerLiveSync,
  getSyncSummary,
  isOutboxSyncing,
  subscribeOutboxChanges,
} from '../services/syncManager';
import { theme } from '../config/theme';

export interface AuditPlan {
  id: string;
  name: string;
  description?: string | null;
  type: 'SCHEDULED' | 'AD_HOC' | 'SURPRISE' | 'ANNUAL' | string;
  status: 'DRAFT' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | string;
  scheduledDate?: string | null;
  scopeType?: 'ALL' | 'LOCATION' | string;
  scopeIds?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    sessions?: number;
  };
  createdBy?: {
    id: string;
    name: string;
    email: string;
  };
}

export const AuditPlansScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { isOfflineMode, isOnline, user } = useAuth();

  const [plans, setPlans] = useState<AuditPlan[]>([]);
  const [locations, setLocations] = useState<CachedLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN_PROGRESS' | 'SCHEDULED' | 'COMPLETED'>('ALL');

  const isScanMode = Boolean(route.params?.isScanMode || route.name === 'Scan');

  // Outbox live sync status
  const [outboxCount, setOutboxCount] = useState<number>(0);
  const [isSyncingOutbox, setIsSyncingOutbox] = useState<boolean>(false);

  // Create Audit Plan Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanType, setNewPlanType] = useState<'SCHEDULED' | 'AD_HOC' | 'SURPRISE' | 'ANNUAL'>('SCHEDULED');
  const [newPlanScopeType, setNewPlanScopeType] = useState<'ALL' | 'LOCATION'>('ALL');
  const [newPlanLocationId, setNewPlanLocationId] = useState<string>('');
  const [newPlanDescription, setNewPlanDescription] = useState('');

  // Handle incoming route params (e.g. from LocationTree or SessionInventory to start Station Audit)
  useEffect(() => {
    if (route.params?.initialLocation || route.params?.initialSession) {
      navigation.navigate('AuditStation', {
        initialLocation: route.params.initialLocation,
        initialSession: route.params.initialSession,
        planId: route.params.planId,
      });
    }
  }, [route.params]);

  const refreshOutboxStatus = useCallback(async () => {
    try {
      const summary = await getSyncSummary();
      setOutboxCount(summary.totalOutboxCount);
      setIsSyncingOutbox(isOutboxSyncing());
    } catch {}
  }, []);

  useEffect(() => {
    refreshOutboxStatus();
    const unsub = subscribeOutboxChanges(() => {
      refreshOutboxStatus();
    });
    return () => unsub();
  }, [refreshOutboxStatus]);

  useFocusEffect(
    useCallback(() => {
      loadCachedData();
      fetchAuditPlans();
      refreshOutboxStatus();
    }, [isOfflineMode, refreshOutboxStatus])
  );

  const loadCachedData = async () => {
    try {
      const [cachedPlans, cachedLocs] = await Promise.all([
        storage.getObject<AuditPlan[]>('CACHED_AUDIT_PLANS'),
        getAllCachedLocations(),
      ]);

      if (cachedLocs && cachedLocs.length > 0) {
        setLocations(cachedLocs);
        if (!newPlanLocationId) {
          setNewPlanLocationId(cachedLocs[0].id);
        }
      }

      if (cachedPlans && cachedPlans.length > 0) {
        setPlans(cachedPlans);
        setIsLoading(false);
      }
    } catch (e) {
      console.warn('[AuditPlansScreen] Cache read error:', e);
    }
  };

  const fetchAuditPlans = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    }

    try {
      if (!isOfflineMode) {
        const res = await apiRequest<{ data: AuditPlan[] } | AuditPlan[]>('/audits/plans?limit=50', {
          timeoutMs: 6000,
        });
        const planList = Array.isArray(res) ? res : res?.data || [];
        setPlans(planList);
        await storage.setObject('CACHED_AUDIT_PLANS', planList);
      } else {
        const cached = await storage.getObject<AuditPlan[]>('CACHED_AUDIT_PLANS');
        if (cached) {
          setPlans(cached);
        }
      }
    } catch (err) {
      console.warn('[AuditPlansScreen] Error fetching plans:', err);
      // Fallback to local cache
      const cached = await storage.getObject<AuditPlan[]>('CACHED_AUDIT_PLANS');
      if (cached) {
        setPlans(cached);
      }
    } finally {
      setIsLoading(false);
      if (isManualRefresh) {
        setIsRefreshing(false);
      }
    }
  };

  const handleManualSyncPress = async () => {
    if (isOfflineMode) {
      Alert.alert(
        'Offline Mode Active',
        'Device is currently operating offline. Scans are saved in local SQLite storage and will synchronize automatically once reconnected.'
      );
      return;
    }

    if (outboxCount === 0) {
      Alert.alert('Cloud Synced', 'All audit data and equipment records are fully synchronized.');
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
        Alert.alert('Sync Successful', `Synchronized ${res.totalUploaded} records with the cloud server.`);
        fetchAuditPlans();
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

  const handleCreatePlan = async () => {
    if (!newPlanName.trim()) {
      Alert.alert('Validation Error', 'Please enter a name for the audit plan.');
      return;
    }

    if (isOfflineMode) {
      Alert.alert(
        'Offline Mode',
        'Creating new audit plans requires cloud connectivity. Please connect to a network to register a new plan.'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const scopeIds =
        newPlanScopeType === 'LOCATION' && newPlanLocationId ? [newPlanLocationId] : [];

      const payload = {
        name: newPlanName.trim(),
        type: newPlanType,
        scopeType: newPlanScopeType,
        scopeIds,
        description: newPlanDescription.trim() || undefined,
        scheduledDate: new Date(Date.now() + 7 * 86400000).toISOString(),
      };

      const res = await apiRequest<{ data?: AuditPlan; id?: string }>('/audits/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const createdId = (res as any)?.data?.id || (res as any)?.id;

      setIsCreateModalOpen(false);
      setNewPlanName('');
      setNewPlanDescription('');
      setNewPlanType('SCHEDULED');
      setNewPlanScopeType('ALL');

      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }

      await fetchAuditPlans();

      if (createdId) {
        navigation.navigate('AuditDetail', {
          planId: createdId,
          planName: payload.name,
        });
      }
    } catch (err: any) {
      Alert.alert('Failed to Create Plan', err?.message || 'Server error occurred while creating audit plan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to resolve location scope names
  const getLocationScopeText = (plan: AuditPlan) => {
    if (plan.scopeType === 'ALL' || !plan.scopeType) {
      return 'All Equipment';
    }

    if (!plan.scopeIds) return 'Specific Location';

    let ids: string[] = [];
    try {
      const parsed = JSON.parse(plan.scopeIds);
      ids = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      ids = [plan.scopeIds];
    }

    const matched = ids
      .map((id) => locations.find((l) => l.id === id))
      .filter(Boolean);

    if (matched.length === 0) return 'Specific Location';
    return matched.map((l) => l!.name + (l!.code ? ` (${l!.code})` : '')).join(', ');
  };

  // KPI Calculations
  const openAuditsCount = plans.filter(
    (p) => p.status === 'IN_PROGRESS' || p.status === 'SCHEDULED' || p.status === 'DRAFT'
  ).length;
  const inProgressCount = plans.filter((p) => p.status === 'IN_PROGRESS').length;
  const scheduledCount = plans.filter((p) => p.status === 'SCHEDULED').length;
  const completedCount = plans.filter((p) => p.status === 'COMPLETED').length;
  const totalSessions = plans.reduce((acc, p) => acc + (p._count?.sessions || 0), 0);

  // Filtered Plans
  const filteredPlans = plans.filter((p) => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'IN_PROGRESS') return p.status === 'IN_PROGRESS';
    if (statusFilter === 'SCHEDULED') return p.status === 'SCHEDULED' || p.status === 'DRAFT';
    if (statusFilter === 'COMPLETED') return p.status === 'COMPLETED';
    return true;
  });

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return {
          bg: '#dcfce7',
          border: '#bbf7d0',
          text: '#15803d',
        };
      case 'IN_PROGRESS':
        return {
          bg: '#fef3c7',
          border: '#fde68a',
          text: '#b45309',
        };
      case 'SCHEDULED':
        return {
          bg: '#e0f2fe',
          border: '#bae6fd',
          text: '#0369a1',
        };
      case 'CANCELLED':
        return {
          bg: '#fee2e2',
          border: '#fecaca',
          text: '#dc2626',
        };
      default:
        return {
          bg: '#f1f5f9',
          border: '#e2e8f0',
          text: '#64748b',
        };
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => fetchAuditPlans(true)}
            colors={[theme.colors.primary]}
          />
        }
      >
        {/* Top Navbar Header */}
        <View style={styles.navbarHeader}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.title}>{isScanMode ? 'Audit Scanner' : 'Audit Plans'}</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {isScanMode
                ? 'Step 1: Select plan ➔ select session ➔ scan'
                : 'Physical inventory verification & compliance'}
            </Text>
          </View>

          <View style={styles.headerRightActions}>
            {/* Sync Pill */}
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

            {/* Create Plan Button */}
            <TouchableOpacity
              style={styles.createPlanBtn}
              onPress={() => setIsCreateModalOpen(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={16} color="#ffffff" />
              <Text style={styles.createPlanBtnText}>New Plan</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Step 1 Workflow Banner in Scan Mode */}
        {isScanMode && (
          <View style={styles.workflowStepCard}>
            <View style={styles.workflowStepHeader}>
              <View style={styles.workflowStepBadge}>
                <Ionicons name="qr-code" size={13} color="#ffffff" style={{ marginRight: 4 }} />
                <Text style={styles.workflowStepBadgeText}>STEP 1 OF 3</Text>
              </View>
              <TouchableOpacity
                onPress={() => navigation.navigate('StandaloneScan')}
                style={styles.workflowStandaloneLink}
                activeOpacity={0.7}
              >
                <Text style={styles.workflowStandaloneText}>Quick Tag Lookup ➔</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.workflowStepTitle}>Select an Audit Plan</Text>
            <Text style={styles.workflowStepDesc}>
              Tap any audit plan below to view its stations and launch the equipment barcode scanner.
            </Text>
          </View>
        )}

        {/* Quick Nav Shortcut to Floor Sessions */}
        <TouchableOpacity
          style={styles.floorSessionsShortcut}
          onPress={() => navigation.navigate('AuditStation')}
          activeOpacity={0.85}
        >
          <View style={styles.floorSessionsLeft}>
            <View style={styles.floorSessionsIconBg}>
              <Ionicons name="scan-outline" size={18} color={theme.colors.primary} />
            </View>
            <View>
              <Text style={styles.floorSessionsTitle}>Station Floor Audit & Scanner</Text>
              <Text style={styles.floorSessionsSub}>
                Scan workstation placards, audit tags & record floor sessions
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.colors.primary} />
        </TouchableOpacity>

        {/* Audit Stats Banner (Matching Web App) */}
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>OPEN AUDITS</Text>
            <Text style={[styles.kpiValue, { color: theme.colors.primary }]}>
              {isLoading ? '-' : `${openAuditsCount} Active`}
            </Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>COMPLETED</Text>
            <Text style={[styles.kpiValue, { color: '#16a34a' }]}>
              {isLoading ? '-' : `${completedCount} Total`}
            </Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>TOTAL SESSIONS</Text>
            <Text style={[styles.kpiValue, { color: theme.colors.textSecondary }]}>
              {isLoading ? '-' : totalSessions}
            </Text>
          </View>
        </View>

        {/* Filter Pills */}
        <View style={styles.filterRow}>
          {(['ALL', 'IN_PROGRESS', 'SCHEDULED', 'COMPLETED'] as const).map((tab) => {
            const active = statusFilter === tab;
            const label =
              tab === 'ALL'
                ? `All (${plans.length})`
                : tab === 'IN_PROGRESS'
                ? `Active (${inProgressCount})`
                : tab === 'SCHEDULED'
                ? `Scheduled (${scheduledCount})`
                : `Done (${completedCount})`;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.filterPill, active && styles.filterPillActive]}
                onPress={() => {
                  setStatusFilter(tab);
                  if (Platform.OS !== 'web') {
                    Haptics.selectionAsync().catch(() => {});
                  }
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Loading State */}
        {isLoading && (
          <View style={styles.stateCard}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.stateText}>Loading audit plans from database...</Text>
          </View>
        )}

        {/* Empty State */}
        {!isLoading && filteredPlans.length === 0 && (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="clipboard-outline" size={32} color={theme.colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No Audit Plans Found</Text>
            <Text style={styles.emptySubtitle}>
              {statusFilter !== 'ALL'
                ? `No audit plans matching "${statusFilter}" status.`
                : 'Create your first audit plan to initiate physical equipment verification, tag reconciliation, and condition assessment.'}
            </Text>
            <TouchableOpacity
              style={styles.emptyActionBtn}
              onPress={() => setIsCreateModalOpen(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={16} color="#ffffff" style={{ marginRight: 6 }} />
              <Text style={styles.emptyActionBtnText}>Create Audit Plan</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Audit Plans List */}
        {!isLoading &&
          filteredPlans.map((plan) => {
            const badgeStyle = getStatusBadgeStyle(plan.status);
            const dateStr = plan.scheduledDate
              ? new Date(plan.scheduledDate).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : plan.createdAt
              ? new Date(plan.createdAt).toLocaleDateString([], {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'Unscheduled';

            const sessionCount = plan._count?.sessions || 0;
            const scopeText = getLocationScopeText(plan);

            return (
              <TouchableOpacity
                key={plan.id}
                style={styles.planCard}
                onPress={() =>
                  navigation.navigate('AuditDetail', {
                    planId: plan.id,
                    planName: plan.name,
                    isScanMode,
                  })
                }
                activeOpacity={0.85}
              >
                {/* Plan Card Header */}
                <View style={styles.planHeader}>
                  <View style={styles.planTitleContainer}>
                    <Text style={styles.planName} numberOfLines={2}>
                      {plan.name}
                    </Text>
                    <View style={styles.planMetaRow}>
                      <View style={styles.typeBadge}>
                        <Text style={styles.typeBadgeText}>{plan.type || 'SCHEDULED'}</Text>
                      </View>
                      <View style={styles.dateRow}>
                        <Ionicons name="calendar-outline" size={12} color={theme.colors.textMuted} />
                        <Text style={styles.dateText}>{dateStr}</Text>
                      </View>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor: badgeStyle.bg,
                        borderColor: badgeStyle.border,
                      },
                    ]}
                  >
                    <Text style={[styles.statusBadgeText, { color: badgeStyle.text }]}>
                      {plan.status.replace('_', ' ')}
                    </Text>
                  </View>
                </View>

                {/* Scope & Description Box */}
                <View style={styles.scopeBox}>
                  <View style={styles.scopeHeaderRow}>
                    <Ionicons name="business-outline" size={13} color={theme.colors.primary} />
                    <Text style={styles.scopeLabel}>
                      AUDIT SCOPE ({plan.scopeType || 'ALL'})
                    </Text>
                  </View>
                  <Text style={styles.scopeValueText} numberOfLines={2}>
                    {scopeText}
                  </Text>
                  {plan.description ? (
                    <Text style={styles.descText} numberOfLines={2}>
                      {plan.description}
                    </Text>
                  ) : null}
                </View>

                {/* Footer Row */}
                <View style={styles.planFooter}>
                  <View style={styles.sessionsBadge}>
                    <Ionicons name="document-text-outline" size={14} color={theme.colors.primary} />
                    <Text style={styles.sessionsBadgeCount}>{sessionCount}</Text>
                    <Text style={styles.sessionsBadgeLabel}>
                      {sessionCount === 1 ? 'Session' : 'Sessions'}
                    </Text>
                  </View>

                  <View style={[styles.viewPlanAction, isScanMode && styles.viewPlanActionScan]}>
                    <Text style={[styles.viewPlanActionText, isScanMode && styles.viewPlanActionScanText]}>
                      {isScanMode ? 'Select Plan & Choose Station ➔' : 'View Plan & Sessions'}
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={14}
                      color={isScanMode ? theme.colors.success : theme.colors.primary}
                    />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
      </ScrollView>

      {/* Create Audit Plan Modal */}
      <Modal
        visible={isCreateModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsCreateModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Create New Audit Plan</Text>
                <Text style={styles.modalSub}>Configure inventory verification scope and type</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsCreateModalOpen(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              {/* Plan Name */}
              <Text style={styles.inputLabel}>Plan Name *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g. Q4 Hardware & Machinery Audit"
                placeholderTextColor={theme.colors.textMuted}
                value={newPlanName}
                onChangeText={setNewPlanName}
              />

              {/* Audit Type */}
              <Text style={styles.inputLabel}>Audit Type</Text>
              <View style={styles.typeSelectorRow}>
                {(['SCHEDULED', 'AD_HOC', 'ANNUAL', 'SURPRISE'] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.typeSelectorBtn,
                      newPlanType === t && styles.typeSelectorBtnActive,
                    ]}
                    onPress={() => setNewPlanType(t)}
                  >
                    <Text
                      style={[
                        styles.typeSelectorBtnText,
                        newPlanType === t && styles.typeSelectorBtnTextActive,
                      ]}
                    >
                      {t.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Scope Type */}
              <Text style={styles.inputLabel}>Scope Coverage</Text>
              <View style={styles.scopeSelectorRow}>
                <TouchableOpacity
                  style={[
                    styles.scopeSelectorBtn,
                    newPlanScopeType === 'ALL' && styles.scopeSelectorBtnActive,
                  ]}
                  onPress={() => setNewPlanScopeType('ALL')}
                >
                  <Ionicons
                    name="globe-outline"
                    size={16}
                    color={newPlanScopeType === 'ALL' ? theme.colors.primary : theme.colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.scopeSelectorBtnText,
                      newPlanScopeType === 'ALL' && styles.scopeSelectorBtnTextActive,
                    ]}
                  >
                    All Equipment
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.scopeSelectorBtn,
                    newPlanScopeType === 'LOCATION' && styles.scopeSelectorBtnActive,
                  ]}
                  onPress={() => setNewPlanScopeType('LOCATION')}
                >
                  <Ionicons
                    name="location-outline"
                    size={16}
                    color={newPlanScopeType === 'LOCATION' ? theme.colors.primary : theme.colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.scopeSelectorBtnText,
                      newPlanScopeType === 'LOCATION' && styles.scopeSelectorBtnTextActive,
                    ]}
                  >
                    Specific Location
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Location Picker (if scope is LOCATION) */}
              {newPlanScopeType === 'LOCATION' && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={styles.inputLabel}>Target Station / Line</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 6, paddingVertical: 4 }}
                  >
                    {locations.map((loc) => {
                      const isSel = newPlanLocationId === loc.id;
                      return (
                        <TouchableOpacity
                          key={loc.id}
                          style={[styles.locPill, isSel && styles.locPillActive]}
                          onPress={() => setNewPlanLocationId(loc.id)}
                        >
                          <Text style={[styles.locPillText, isSel && styles.locPillTextActive]}>
                            {loc.name} {loc.code ? `(${loc.code})` : ''}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* Description */}
              <Text style={styles.inputLabel}>Description / Notes (Optional)</Text>
              <TextInput
                style={[styles.textInput, { height: 72, textAlignVertical: 'top' }]}
                placeholder="Objectives, guidelines or specific instructions..."
                placeholderTextColor={theme.colors.textMuted}
                value={newPlanDescription}
                onChangeText={setNewPlanDescription}
                multiline
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsCreateModalOpen(false)}
                disabled={isSubmitting}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleCreatePlan}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.submitBtnText}>Create Plan</Text>
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
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  navbarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  createPlanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.md,
    gap: 3,
    ...theme.shadows.sm,
  },
  createPlanBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  floorSessionsShortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: theme.borderRadius.lg,
    padding: 12,
    borderWidth: 1,
    borderColor: '#dbeafe',
    marginBottom: 12,
    ...theme.shadows.sm,
  },
  floorSessionsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 6,
  },
  floorSessionsIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floorSessionsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  floorSessionsSub: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: theme.borderRadius.md,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    ...theme.shadows.sm,
  },
  kpiLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  kpiValue: {
    fontSize: 15,
    fontWeight: '800',
    marginTop: 4,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  filterPill: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  filterPillActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  filterPillTextActive: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  stateCard: {
    backgroundColor: '#ffffff',
    borderRadius: theme.borderRadius.lg,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    gap: 10,
  },
  stateText: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: theme.borderRadius.lg,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    gap: 8,
    marginTop: 8,
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.md,
    marginTop: 8,
  },
  emptyActionBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  planCard: {
    backgroundColor: '#ffffff',
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    marginBottom: 12,
    ...theme.shadows.sm,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  planTitleContainer: {
    flex: 1,
    marginRight: 8,
  },
  planName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    lineHeight: 20,
  },
  planMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  typeBadge: {
    backgroundColor: '#f1f5f9',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  scopeBox: {
    backgroundColor: '#f8fafc',
    borderRadius: theme.borderRadius.md,
    padding: 9,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    marginBottom: 10,
  },
  scopeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  scopeLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: theme.colors.textMuted,
    letterSpacing: 0.5,
  },
  scopeValueText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  descText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    marginTop: 3,
    lineHeight: 15,
  },
  planFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
  },
  sessionsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sessionsBadgeCount: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  sessionsBadgeLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  viewPlanAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  viewPlanActionText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  viewPlanActionScan: {
    backgroundColor: '#f0fdf4',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  viewPlanActionScanText: {
    color: theme.colors.success,
  },
  // Workflow Step Card
  workflowStepCard: {
    backgroundColor: '#ffffff',
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#3b82f6',
    ...theme.shadows.card,
  },
  workflowStepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  workflowStepBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  workflowStepBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  workflowStandaloneLink: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  workflowStandaloneText: {
    fontSize: 11,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  workflowStepTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    marginBottom: 3,
  },
  workflowStepDesc: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 17,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 12,
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  modalSub: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  modalBody: {
    maxHeight: 400,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textSecondary,
    marginBottom: 6,
    marginTop: 8,
  },
  textInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: theme.colors.textPrimary,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  typeSelectorBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  typeSelectorBtnActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  typeSelectorBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  typeSelectorBtnTextActive: {
    color: theme.colors.primary,
  },
  scopeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  scopeSelectorBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: theme.borderRadius.md,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  scopeSelectorBtnActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  scopeSelectorBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  scopeSelectorBtnTextActive: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  locPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  locPillActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
  },
  locPillText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
  },
  locPillTextActive: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 14,
    marginTop: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: theme.borderRadius.md,
    backgroundColor: '#f1f5f9',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  submitBtn: {
    flex: 2,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.primary,
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
});

