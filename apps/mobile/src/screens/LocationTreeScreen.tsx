import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  getAllCachedLocations,
  getLocationAssetCounts,
  getLocationDirectAssetCounts,
  CachedLocation,
} from '../database/db';
import { apiRequest } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { theme } from '../config/theme';

export interface LocationTreeNode {
  id: string;
  name: string;
  code: string;
  type: string;
  parentId?: string | null;
  qrCode?: string;
  assetCount?: number;
  totalAssetCount?: number;
  directAssetCount?: number;
  children?: LocationTreeNode[];
}

export const LocationTreeScreen = () => {
  const navigation = useNavigation<any>();
  const { isOfflineMode } = useAuth();

  const [treeData, setTreeData] = useState<LocationTreeNode[]>([]);
  const [flatLocations, setFlatLocations] = useState<LocationTreeNode[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Selected station modal
  const [selectedStation, setSelectedStation] = useState<LocationTreeNode | null>(null);

  useEffect(() => {
    loadTree();
  }, []);

  const loadTree = async () => {
    setIsLoading(true);
    try {
      // Helper to ensure all parent nodes recursively rollup child and grandchild quantities without double-counting
      const rollupTree = (node: LocationTreeNode): number => {
        const direct =
          node.directAssetCount !== undefined
            ? node.directAssetCount
            : (node.children && node.children.length > 0 ? 0 : (node.assetCount || 0));
        let sum = direct;
        if (node.children && node.children.length > 0) {
          for (const child of node.children) {
            sum += rollupTree(child);
          }
        }
        node.assetCount = sum;
        node.totalAssetCount = sum;
        return sum;
      };

      // 1. Try online live tree if connected
      if (!isOfflineMode) {
        try {
          const res = await apiRequest<any>('/locations/tree', { timeoutMs: 5000 });
          const liveTree = Array.isArray(res) ? res : res?.data;
          if (Array.isArray(liveTree) && liveTree.length > 0) {
            liveTree.forEach(rollupTree);
            setTreeData(liveTree);
            initializeExpanded(liveTree);
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.warn('[LocationTree] Online tree failed, fallback to local SQLite:', e);
        }
      }

      // 2. Offline / Local SQLite tree construction
      const [cachedLocs, directCounts, rolledUpCounts] = await Promise.all([
        getAllCachedLocations(),
        getLocationDirectAssetCounts(),
        getLocationAssetCounts(),
      ]);

      const nodeMap = new Map<string, LocationTreeNode>();
      cachedLocs.forEach((loc) => {
        nodeMap.set(loc.id, {
          id: loc.id,
          name: loc.name,
          code: loc.code,
          type: loc.type,
          parentId: loc.parentId,
          qrCode: loc.code,
          directAssetCount: directCounts[loc.id] || 0,
          assetCount: rolledUpCounts[loc.id] || 0,
          totalAssetCount: rolledUpCounts[loc.id] || 0,
          children: [],
        });
      });

      const rootNodes: LocationTreeNode[] = [];
      nodeMap.forEach((node) => {
        if (node.parentId && nodeMap.has(node.parentId)) {
          nodeMap.get(node.parentId)!.children!.push(node);
        } else {
          rootNodes.push(node);
        }
      });

      rootNodes.forEach(rollupTree);
      setTreeData(rootNodes);
      initializeExpanded(rootNodes);
    } catch (err) {
      console.warn('[LocationTree] Error loading locations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const initializeExpanded = (nodes: LocationTreeNode[]) => {
    const expanded: Record<string, boolean> = {};
    const traverse = (items: LocationTreeNode[]) => {
      items.forEach((item) => {
        expanded[item.id] = true;
        if (item.children && item.children.length > 0) {
          traverse(item.children);
        }
      });
    };
    traverse(nodes);
    setExpandedNodes(expanded);
  };

  const toggleExpand = (id: string) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleExpandAll = () => {
    const allExpanded: Record<string, boolean> = {};
    const traverse = (items: LocationTreeNode[]) => {
      items.forEach((item) => {
        allExpanded[item.id] = true;
        if (item.children && item.children.length > 0) {
          traverse(item.children);
        }
      });
    };
    traverse(treeData);
    setExpandedNodes(allExpanded);
  };

  const handleCollapseAll = () => {
    setExpandedNodes({});
  };

  const getNodeIcon = (type: string, isExpanded: boolean) => {
    switch (type?.toUpperCase()) {
      case 'COMPANY':
        return { name: 'business', color: '#2563eb', bg: '#eff6ff' };
      case 'UNIT':
        return { name: 'business-outline', color: '#4f46e5', bg: '#eef2ff' };
      case 'BLOCK':
        return { name: 'layers', color: '#d97706', bg: '#fffbeb' };
      case 'LINE':
        return { name: 'git-commit', color: '#16a34a', bg: '#f0fdf4' };
      default:
        return { name: 'location', color: theme.colors.textMuted, bg: '#f8fafc' };
    }
  };

  const renderNode = (node: LocationTreeNode, depth = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = !!expandedNodes[node.id];
    const iconMeta = getNodeIcon(node.type, isExpanded);

    // Search filter match
    const query = searchQuery.trim().toLowerCase();
    const isMatched =
      !query ||
      node.name.toLowerCase().includes(query) ||
      node.code.toLowerCase().includes(query) ||
      node.type.toLowerCase().includes(query);

    return (
      <View key={node.id} style={styles.nodeWrapper}>
        <TouchableOpacity
          style={[
            styles.nodeRow,
            { paddingLeft: depth * 20 + 12 },
            selectedStation?.id === node.id && styles.nodeRowSelected,
          ]}
          onPress={() => setSelectedStation(node)}
          activeOpacity={0.75}
        >
          {/* Expand / Collapse Chevron */}
          {hasChildren ? (
            <TouchableOpacity
              onPress={() => toggleExpand(node.id)}
              style={styles.chevronTouch}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={isExpanded ? 'chevron-down' : 'chevron-forward'}
                size={16}
                color={theme.colors.textMuted}
              />
            </TouchableOpacity>
          ) : (
            <View style={styles.chevronPlaceholder} />
          )}

          {/* Node Level Icon */}
          <View style={[styles.nodeIconBadge, { backgroundColor: iconMeta.bg }]}>
            <Ionicons name={iconMeta.name as any} size={15} color={iconMeta.color} />
          </View>

          {/* Node Info */}
          <View style={styles.nodeInfo}>
            <View style={styles.nodeTitleRow}>
              <Text style={styles.nodeName} numberOfLines={1}>
                {node.name}
              </Text>
              <View style={[styles.typeBadge, { borderColor: `${iconMeta.color}30` }]}>
                <Text style={[styles.typeBadgeText, { color: iconMeta.color }]}>
                  {node.type}
                </Text>
              </View>
            </View>
            <Text style={styles.nodeCode}>Code: {node.code}</Text>
          </View>

          {/* Asset Count Badge */}
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>
              {(node.assetCount || 0).toLocaleString()}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Children Sub-Tree */}
        {hasChildren && isExpanded && (
          <View style={styles.childrenContainer}>
            {node.children!.map((child) => renderNode(child, depth + 1))}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      {/* Top Navbar Header */}
      <View style={styles.navbar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color={theme.colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.navTitles}>
          <Text style={styles.navTitle}>Location Tree</Text>
          <Text style={styles.navSub}>Company &gt; Unit &gt; Block &gt; Line</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={loadTree}>
          <Ionicons name="refresh-outline" size={20} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Search & Tree Controls Toolbar */}
      <View style={styles.toolbar}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={16} color={theme.colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search zones, units, lines..."
            placeholderTextColor={theme.colors.textLight}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="characters"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={theme.colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.expandControls}>
          <TouchableOpacity style={styles.expandActionBtn} onPress={handleExpandAll}>
            <Ionicons name="expand-outline" size={14} color={theme.colors.primary} />
            <Text style={styles.expandActionText}>Expand</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.expandActionBtn} onPress={handleCollapseAll}>
            <Ionicons name="contract-outline" size={14} color={theme.colors.textSecondary} />
            <Text style={styles.expandActionText}>Collapse</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tree Content */}
      {isLoading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loaderText}>Mapping facility hierarchy...</Text>
        </View>
      ) : treeData.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="git-network-outline" size={44} color={theme.colors.textMuted} />
          <Text style={styles.emptyTitle}>No Locations Found</Text>
          <Text style={styles.emptySub}>
            Run database sync on Dashboard to cache factory zones.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollList} keyboardShouldPersistTaps="handled">
          {treeData.map((rootNode) => renderNode(rootNode, 0))}
        </ScrollView>
      )}

      {/* Station Placard & Details Modal */}
      <Modal
        visible={selectedStation !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedStation(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{selectedStation?.name}</Text>
                <Text style={styles.modalSub}>
                  {selectedStation?.type} • Code: {selectedStation?.code}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setSelectedStation(null)}
              >
                <Ionicons name="close" size={20} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* Placard Information Box */}
            <View style={styles.placardInfoCard}>
              <View style={styles.placardRow}>
                <Ionicons name="qr-code-outline" size={24} color={theme.colors.primary} />
                <View style={styles.placardCol}>
                  <Text style={styles.placardCodeText}>{selectedStation?.code}</Text>
                  <Text style={styles.placardHint}>Station check-in QR placard</Text>
                </View>
              </View>

              <View style={styles.metricRow}>
                <View style={styles.metricBox}>
                  <Text style={styles.metricValue}>
                    {(selectedStation?.assetCount || 0).toLocaleString()}
                  </Text>
                  <Text style={styles.metricLabel}>Total Assets</Text>
                </View>
                <View style={styles.metricBox}>
                  <Text style={styles.metricValue}>{selectedStation?.type}</Text>
                  <Text style={styles.metricLabel}>Hierarchy Level</Text>
                </View>
              </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalPrimaryBtn}
                onPress={() => {
                  const station = selectedStation;
                  setSelectedStation(null);
                  navigation.navigate('MainTabs', {
                    screen: 'Audits',
                    params: { initialLocation: station },
                  });
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="clipboard-outline" size={18} color="#ffffff" />
                <Text style={styles.modalPrimaryBtnText}>Start Audit at this Station</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSecondaryBtn}
                onPress={() => {
                  const station = selectedStation;
                  setSelectedStation(null);
                  navigation.navigate('MainTabs', {
                    screen: 'Assets',
                    params: { search: station?.name },
                  });
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="cube-outline" size={18} color={theme.colors.primary} />
                <Text style={styles.modalSecondaryBtnText}>View Equipment at Station</Text>
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
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.cardBorder,
  },
  backButton: {
    paddingRight: 10,
  },
  navTitles: {
    flex: 1,
  },
  navTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  navSub: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 1,
  },
  refreshBtn: {
    padding: 6,
  },
  toolbar: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    borderRadius: 8,
    paddingHorizontal: 8,
    height: 36,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: theme.colors.textPrimary,
    paddingVertical: 0,
  },
  expandControls: {
    flexDirection: 'row',
    gap: 6,
  },
  expandActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.background,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  expandActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  scrollList: {
    paddingVertical: 10,
    paddingBottom: 40,
  },
  nodeWrapper: {
    marginBottom: 2,
  },
  nodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingRight: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  nodeRowSelected: {
    backgroundColor: '#eff6ff',
  },
  chevronTouch: {
    width: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevronPlaceholder: {
    width: 22,
  },
  nodeIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  nodeInfo: {
    flex: 1,
  },
  nodeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nodeName: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  typeBadge: {
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  nodeCode: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  countBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  childrenContainer: {
    borderLeftWidth: 1.5,
    borderLeftColor: '#e2e8f0',
    marginLeft: 22,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loaderText: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  emptySub: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 20,
    paddingBottom: 34,
    ...theme.shadows.card,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  modalSub: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  placardInfoCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  placardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  placardCol: {
    flex: 1,
  },
  placardCodeText: {
    fontSize: 16,
    fontWeight: '800',
    color: theme.colors.primary,
    letterSpacing: 0.5,
  },
  placardHint: {
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricBox: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  metricLabel: {
    fontSize: 10,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  modalActions: {
    gap: 10,
  },
  modalPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary,
    paddingVertical: 13,
    borderRadius: 10,
  },
  modalPrimaryBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  modalSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingVertical: 12,
    borderRadius: 10,
  },
  modalSecondaryBtnText: {
    color: theme.colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
});

