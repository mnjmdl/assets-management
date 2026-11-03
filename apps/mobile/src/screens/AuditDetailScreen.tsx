import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { apiRequest } from '../services/api';
import { storage } from '../services/storage';
import { useAuth } from '../context/AuthContext';
import { theme } from '../config/theme';

interface AuditSessionItem {
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
  auditor?: { id: string; name: string; email: string };
  location?: { id: string; name: string; code?: string; type?: string } | null;
  _count?: { items: number; discrepancies: number };
}

interface AuditPlanDetail {
  id: string;
  name: string;
  description?: string | null;
  type: string;
  status: string;
  scheduledDate?: string | null;
  scopeType?: string;
  scopeIds?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: { id: string; name: string; email: string };
  sessions: AuditSessionItem[];
  scopedLocations?: Array<{
    id: string;
    name: string;
    code?: string;
    type?: string;
  }>;
}

export const AuditDetailScreen = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { isOfflineMode } = useAuth();

  const planId = route.params?.planId || '';
  const initialPlanName = route.params?.planName || 'Audit Plan Details';

  const [plan, setPlan] = useState<AuditPlanDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'IN_PROGRESS' | 'COMPLETED'>('ALL');

  useEffect(() => {
    loadPlanDetails();
  }, [planId]);

  const loadPlanDetails = async (isRefresh = false) => {
    if (!planId) return;

    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    const cacheKey = `AUDIT_PLAN_${planId}`;

    try {
      if (!isOfflineMode) {
        const data = await apiRequest<AuditPlanDetail>(`/audits/plans/${planId}`, {
          timeoutMs: 8000,
        });
        setPlan(data);
        await storage.setObject(cacheKey, data);
      } else {
        const cached = await storage.getObject<AuditPlanDetail>(cacheKey);
        if (cached) {
          setPlan(cached);
        }
      }
    } catch (error) {
      console.warn('[AuditDetailScreen] Error loading plan details:', error);
      const cached = await storage.getObject<AuditPlanDetail>(cacheKey);
      if (cached) {
        setPlan(cached);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleLaunchStationAudit = (session: AuditSessionItem) => {
    // Navigate to Session Inventory Page (Session Checklist)
    navigation.navigate('SessionInventory', {
      sessionId: session.id,
      session: {
        ...session,
        plan: plan
          ? {
              id: plan.id,
              name: plan.name,
              type: plan.type,
              status: plan.status,
            }
          : undefined,
      },
    });
  };

  const handleStartNewStation = () => {
    navigation.navigate('MainTabs', {
      screen: 'Audits',
      params: {
        planId: plan?.id,
      },
    });
  };

  const sessions = plan?.sessions || [];
  const filteredSessions = sessions.filter((s) => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'IN_PROGRESS') return s.status === 'IN_PROGRESS' || s.status === 'NOT_STARTED';
    if (statusFilter === 'COMPLETED') return s.status === 'COMPLETED';
    return true;
  });

  const inProgressCount = sessions.filter((s) => s.status === 'IN_PROGRESS' || s.status === 'NOT_STARTED').length;
  const completedCount = sessions.filter((s) => s.status === 'COMPLETED').length;
  const totalAuditedItems = sessions.reduce((acc, s) => acc + (s._count?.items ?? 0), 0);
  const totalDiscrepancies = sessions.reduce((acc, s) => acc + (s._count?.discrepancies ?? 0), 0);

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
          <Text style={styles.backButtonText}>Audits</Text>
        </TouchableOpacity>

        <View style={styles.headerTitleCol}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {plan?.name || initialPlanName}
          </Text>
          <Text style={styles.headerSub}>Audit Plan & Sessions</Text>
        </View>

        {plan && (
          <View
            style={[
              styles.statusBadge,
              plan.status === 'IN_PROGRESS' && styles.statusInProgress,
              plan.status === 'COMPLETED' && styles.statusCompleted,
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                plan.status === 'IN_PROGRESS' && styles.statusTextInProgress,
                plan.status === 'COMPLETED' && styles.statusTextCompleted,
              ]}
            >
              {plan.status}
            </Text>
          </View>
        )}
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading audit plan details...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadPlanDetails(true)}
              colors={[theme.colors.primary]}
            />
          }
        >
          {/* Plan Overview Card */}
          <View style={styles.planCard}>
            <View style={styles.planHeaderRow}>
              <View style={styles.planIconCircle}>
                <Ionicons name="clipboard" size={20} color={theme.colors.primary} />
              </View>
              <View style={styles.planTitleCol}>
                <Text style={styles.planName}>{plan?.name}</Text>
                <Text style={styles.planMeta}>
                  Type: {plan?.type || 'PHYSICAL'} • Scope: {plan?.scopeType || 'ALL'}
                </Text>
              </View>
            </View>

            {plan?.description ? (
              <Text style={styles.planDescription}>{plan.description}</Text>
            ) : null}

            {/* Plan Metrics Row */}
            <View style={styles.kpiRow}>
              <View style={styles.kpiBox}>
                <Text style={styles.kpiVal}>{sessions.length}</Text>
                <Text style={styles.kpiLabel}>Sessions</Text>
              </View>
              <View style={styles.kpiBox}>
                <Text style={[styles.kpiVal, { color: theme.colors.success }]}>
                  {inProgressCount}
                </Text>
                <Text style={styles.kpiLabel}>In Progress</Text>
              </View>
              <View style={styles.kpiBox}>
                <Text style={[styles.kpiVal, { color: theme.colors.primary }]}>
                  {totalAuditedItems}
                </Text>
                <Text style={styles.kpiLabel}>Audited Tags</Text>
              </View>
              <View style={styles.kpiBox}>
                <Text style={[styles.kpiVal, { color: totalDiscrepancies > 0 ? theme.colors.danger : theme.colors.textMuted }]}>
                  {totalDiscrepancies}
                </Text>
                <Text style={styles.kpiLabel}>Issues</Text>
              </View>
            </View>
          </View>

          {/* Sessions Section Header */}
          <View style={styles.sectionHeaderRow}>
            <View>
              <Text style={styles.sectionTitle}>Sessions for this Audit</Text>
              <Text style={styles.sectionSubtitle}>
                {filteredSessions.length} factory line stations assigned
              </Text>
            </View>

            <TouchableOpacity
              style={styles.newStationBtn}
              onPress={handleStartNewStation}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle-outline" size={16} color="#ffffff" style={{ marginRight: 4 }} />
              <Text style={styles.newStationBtnText}>+ Check-in</Text>
            </TouchableOpacity>
          </View>

          {/* Filter Pills */}
          <View style={styles.filterRow}>
            {(['ALL', 'IN_PROGRESS', 'COMPLETED'] as const).map((tab) => {
              const active = statusFilter === tab;
              const label =
                tab === 'ALL'
                  ? `All (${sessions.length})`
                  : tab === 'IN_PROGRESS'
                  ? `Active (${inProgressCount})`
                  : `Done (${completedCount})`;
              return (
                <TouchableOpacity
                  key={tab}
                  style={[styles.filterPill, active && styles.filterPillActive]}
                  onPress={() => setStatusFilter(tab)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Sessions List */}
          {filteredSessions.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="cube-outline" size={44} color={theme.colors.textMuted} />
              <Text style={styles.emptyTitle}>No Sessions Found</Text>
              <Text style={styles.emptySub}>
                {statusFilter === 'ALL'
                  ? 'No stations have been audited under this plan yet. Check in to a factory line to create the first session.'
                  : `No sessions with status "${statusFilter}".`}
              </Text>
              <TouchableOpacity
                style={styles.emptyActionBtn}
                onPress={handleStartNewStation}
                activeOpacity={0.85}
              >
                <Text style={styles.emptyActionBtnText}>+ Check-in Station Line</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredSessions.map((session) => {
              const isCompleted = session.status === 'COMPLETED';
              const isInProgress = session.status === 'IN_PROGRESS';
              const locationName = session.location?.name || 'Unassigned Station';
              const locationCode = session.location?.code;
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
                  onPress={() => handleLaunchStationAudit(session)}
                  activeOpacity={0.85}
                >
                  <View style={styles.sessionCardHeader}>
                    <View style={styles.sessionLocationCol}>
                      <View style={styles.locationTitleRow}>
                        <Ionicons name="location" size={16} color={theme.colors.primary} />
                        <Text style={styles.sessionLocationName}>{locationName}</Text>
                      </View>
                      {locationCode && (
                        <Text style={styles.sessionLocationCode}>Line: {locationCode}</Text>
                      )}
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

                    <View style={styles.auditActionBtn}>
                      <Text style={styles.auditActionBtnText}>View Inventory ➔</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
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
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statusInProgress: {
    backgroundColor: theme.colors.successLight,
    borderColor: theme.colors.successBorder,
  },
  statusCompleted: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primaryBorder,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
  },
  statusTextInProgress: {
    color: theme.colors.success,
  },
  statusTextCompleted: {
    color: theme.colors.primary,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
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
  planCard: {
    backgroundColor: '#ffffff',
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    marginBottom: 16,
    ...theme.shadows.sm,
  },
  planHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  planIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: theme.colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planTitleCol: {
    flex: 1,
  },
  planName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  planMeta: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  planDescription: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.divider,
    paddingTop: 12,
  },
  kpiBox: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  kpiVal: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.textPrimary,
  },
  kpiLabel: {
    fontSize: 9,
    color: theme.colors.textMuted,
    marginTop: 2,
    fontWeight: '600',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  newStationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  newStationBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
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
  auditActionBtn: {
    paddingVertical: 2,
  },
  auditActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  emptyBox: {
    backgroundColor: '#ffffff',
    borderRadius: theme.borderRadius.lg,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    marginTop: 10,
    ...theme.shadows.sm,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  emptyActionBtn: {
    marginTop: 14,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
  },
  emptyActionBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});

