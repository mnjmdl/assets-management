import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useAudioPlayer } from 'expo-audio';
import {
  getCachedAssetsPaginated,
  CachedAsset,
  getAssetCount,
} from '../database/db';
import { theme } from '../config/theme';

const beepSound = require('../../assets/beep.wav');

const STATUS_FILTERS = [
  { label: 'All', value: 'ALL' },
  { label: 'In Use', value: 'IN_USE' },
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Maintenance', value: 'MAINTENANCE' },
  { label: 'Damaged', value: 'DAMAGED' },
  { label: 'Disposed', value: 'DISPOSED' },
];

const PAGE_SIZE = 30;

export const AssetsScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const [assets, setAssets] = useState<CachedAsset[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [globalCount, setGlobalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [searchQuery, setSearchQuery] = useState(route.params?.search || '');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  // Camera scanner overlay state
  const [permission, requestPermission] = useCameraPermissions();
  const [isScanningOpen, setIsScanningOpen] = useState(false);
  const [enableTorch, setEnableTorch] = useState(false);
  const lastScannedTimeRef = useRef<number>(0);
  const audioPlayer = useAudioPlayer(beepSound);

  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadInitialCount();
    fetchPage(0, true);
  }, []);

  useEffect(() => {
    if (route.params?.search !== undefined && route.params?.search !== searchQuery) {
      setSearchQuery(route.params.search);
      getCachedAssetsPaginated({
        limit: PAGE_SIZE,
        offset: 0,
        search: route.params.search,
        status: selectedStatus,
      }).then((res) => {
        setAssets(res.items);
        setTotalCount(res.totalCount);
      });
    }
  }, [route.params?.search]);

  const loadInitialCount = async () => {
    try {
      const count = await getAssetCount();
      setGlobalCount(count);
    } catch (e) {
      console.warn('[AssetsScreen] Error fetching count:', e);
    }
  };

  const fetchPage = async (offset: number, isInitial = false) => {
    if (isInitial) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const result = await getCachedAssetsPaginated({
        limit: PAGE_SIZE,
        offset,
        search: searchQuery,
        status: selectedStatus,
      });

      if (isInitial) {
        setAssets(result.items);
      } else {
        setAssets((prev) => [...prev, ...result.items]);
      }
      setTotalCount(result.totalCount);
    } catch (error) {
      console.warn('[AssetsScreen] Fetch error:', error);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
      setIsRefreshing(false);
    }
  };

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);

    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = setTimeout(() => {
      fetchPage(0, true);
    }, 250);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    // Re-query immediately
    getCachedAssetsPaginated({
      limit: PAGE_SIZE,
      offset: 0,
      search: '',
      status: selectedStatus,
    }).then((res) => {
      setAssets(res.items);
      setTotalCount(res.totalCount);
    });
  };

  const handleStatusFilterChange = (status: string) => {
    setSelectedStatus(status);
    setIsLoading(true);
    getCachedAssetsPaginated({
      limit: PAGE_SIZE,
      offset: 0,
      search: searchQuery,
      status,
    }).then((res) => {
      setAssets(res.items);
      setTotalCount(res.totalCount);
      setIsLoading(false);
    });
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

  const handleBarcodeScanned = (scanningResult: { data: string }) => {
    const now = Date.now();
    // Debounce rapid duplicate reads
    if (now - lastScannedTimeRef.current < 1500) return;
    lastScannedTimeRef.current = now;

    const scannedCode = scanningResult.data?.trim();
    if (scannedCode) {
      // Audio confirmation chirp
      try {
        audioPlayer.seekTo(0);
        audioPlayer.play();
      } catch {
        // Audio playback fallback
      }

      // Haptic confirmation
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }

      handleApplyScannedCode(scannedCode);
    }
  };

  const handleApplyScannedCode = async (code: string) => {
    setSearchQuery(code);
    setIsScanningOpen(false);
    setEnableTorch(false);
    setIsLoading(true);

    try {
      const res = await getCachedAssetsPaginated({
        limit: PAGE_SIZE,
        offset: 0,
        search: code,
        status: selectedStatus,
      });
      setAssets(res.items);
      setTotalCount(res.totalCount);
    } catch (err) {
      console.warn('[AssetsScreen] Error applying scanned code:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadInitialCount();
    await fetchPage(0, true);
  };

  const handleLoadMore = () => {
    if (isLoading || isLoadingMore || assets.length >= totalCount) return;
    fetchPage(assets.length, false);
  };

  const renderStatusBadge = (status: string) => {
    let bg = '#eff6ff';
    let text = '#2563eb';
    let border = '#dbeafe';

    switch (status) {
      case 'IN_USE':
      case 'ACTIVE':
        bg = theme.colors.successLight;
        text = theme.colors.success;
        border = theme.colors.successBorder;
        break;
      case 'MAINTENANCE':
        bg = theme.colors.warningLight;
        text = theme.colors.warning;
        border = theme.colors.warningBorder;
        break;
      case 'DAMAGED':
        bg = theme.colors.dangerLight;
        text = theme.colors.danger;
        border = theme.colors.dangerBorder;
        break;
      case 'DISPOSED':
        bg = '#f1f5f9';
        text = '#64748b';
        border = '#e2e8f0';
        break;
    }

    return (
      <View style={[styles.statusBadge, { backgroundColor: bg, borderColor: border }]}>
        <Text style={[styles.statusBadgeText, { color: text }]}>{status}</Text>
      </View>
    );
  };

  const renderAssetItem = ({ item }: { item: CachedAsset }) => (
    <TouchableOpacity
      style={styles.assetCard}
      onPress={() =>
        navigation.navigate('AssetDetail', {
          assetCode: item.assetCode,
          assetId: item.id,
        })
      }
      activeOpacity={0.8}
    >
      <View style={styles.cardHeader}>
        <View style={styles.codeRow}>
          <Text style={styles.assetCodeText}>{item.assetCode}</Text>
          {item.sapAssetCode ? (
            <View style={styles.sapBadge}>
              <Text style={styles.sapBadgeText}>SAP: {item.sapAssetCode}</Text>
            </View>
          ) : null}
        </View>
        {renderStatusBadge(item.status)}
      </View>

      <Text style={styles.assetNameText} numberOfLines={2}>
        {item.name}
      </Text>

      <View style={styles.metaRow}>
        <View style={styles.locationCol}>
          <Ionicons name="location-outline" size={13} color={theme.colors.textMuted} />
          <Text style={styles.locationText} numberOfLines={1}>
            {item.locationName || 'Unassigned Line'}
          </Text>
        </View>

        {item.condition && (
          <View style={styles.conditionPill}>
            <Text style={styles.conditionText}>{item.condition}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Navbar Header */}
      <View style={styles.topNavbar}>
        <View>
          <Text style={styles.pageTitle}>Total Assets</Text>
          <Text style={styles.pageSubtitle}>
            {totalCount.toLocaleString()} equipment records
            {globalCount > 0 && totalCount !== globalCount ? ` of ${globalCount.toLocaleString()}` : ''}
          </Text>
        </View>
        <View style={styles.cachedBadge}>
          <Ionicons name="server-outline" size={12} color={theme.colors.primary} />
          <Text style={styles.cachedBadgeText}>
            {globalCount > 0 ? `${globalCount.toLocaleString()} Local` : 'SQLite WAL'}
          </Text>
        </View>
      </View>

      {/* Search Input Bar with Camera Scan Button */}
      <View style={styles.searchSection}>
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color={theme.colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by code, SAP, serial, name..."
              placeholderTextColor={theme.colors.textLight}
              value={searchQuery}
              onChangeText={handleSearchChange}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={handleClearSearch} style={styles.clearBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={styles.cameraBtn}
            onPress={handleOpenScanner}
            activeOpacity={0.8}
            accessibilityLabel="Scan QR code with camera"
          >
            <Ionicons name="camera-outline" size={20} color={theme.colors.primary} />
          </TouchableOpacity>
        </View>

        {/* Filter Pills */}
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={STATUS_FILTERS}
          keyExtractor={(item) => item.value}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => {
            const isActive = selectedStatus === item.value;
            return (
              <TouchableOpacity
                style={[styles.filterPill, isActive && styles.filterPillActive]}
                onPress={() => handleStatusFilterChange(item.value)}
                activeOpacity={0.8}
              >
                <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* Main Asset List */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Loading equipment registry...</Text>
        </View>
      ) : assets.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="file-tray-outline" size={44} color={theme.colors.textMuted} />
          <Text style={styles.emptyTitle}>No Equipment Found</Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery
              ? `No assets matching "${searchQuery}" in ${selectedStatus} status.`
              : 'The local database is currently empty. Run sync from Dashboard.'}
          </Text>
          {searchQuery ? (
            <TouchableOpacity style={styles.emptyActionBtn} onPress={handleClearSearch}>
              <Text style={styles.emptyActionBtnText}>Clear Search Filter</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={assets}
          keyExtractor={(item) => item.id}
          renderItem={renderAssetItem}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[theme.colors.primary]}
            />
          }
          ListFooterComponent={
            isLoadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
                <Text style={styles.footerLoaderText}>Loading more records...</Text>
              </View>
            ) : undefined
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
            {/* Camera Overlay Container */}
            <View style={styles.cameraOverlay}>
              {/* Top Controls Header */}
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
                  <Text style={styles.cameraHeaderTitle}>Scan Asset QR Code</Text>
                  <Text style={styles.cameraHeaderSub}>Position QR inside viewfinder</Text>
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

              {/* Viewfinder Target Frame */}
              <View style={styles.viewfinderWrapper}>
                <View style={styles.viewfinderBox}>
                  <View style={[styles.corner, styles.cornerTL]} />
                  <View style={[styles.corner, styles.cornerTR]} />
                  <View style={[styles.corner, styles.cornerBL]} />
                  <View style={[styles.corner, styles.cornerBR]} />
                </View>

                <View style={styles.tipPill}>
                  <Ionicons name="scan-outline" size={16} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={styles.tipPillText}>Auto-populates search on detect</Text>
                </View>
              </View>

              {/* Bottom Cancel Button */}
              <View style={styles.cameraBottomBar}>
                <TouchableOpacity
                  style={styles.cameraCancelButton}
                  onPress={handleCloseScanner}
                  activeOpacity={0.85}
                >
                  <Text style={styles.cameraCancelButtonText}>Cancel</Text>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.cardBorder,
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
  cachedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  cachedBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  searchSection: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.cardBorder,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: theme.colors.textPrimary,
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 4,
  },
  cameraBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: theme.colors.primaryLight,
    borderWidth: 1,
    borderColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterList: {
    gap: 6,
    paddingBottom: 2,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  filterPillActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  filterPillTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  listContent: {
    padding: 14,
    paddingBottom: 30,
    gap: 10,
  },
  assetCard: {
    backgroundColor: '#ffffff',
    borderRadius: theme.borderRadius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    ...theme.shadows.card,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  assetCodeText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.primary,
    letterSpacing: -0.2,
  },
  sapBadge: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sapBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  assetNameText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    lineHeight: 18,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  locationCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  locationText: {
    fontSize: 11,
    color: theme.colors.textMuted,
    fontWeight: '500',
  },
  conditionPill: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  conditionText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.colors.textSecondary,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
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
    marginTop: 6,
  },
  emptySubtitle: {
    fontSize: 12,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyActionBtn: {
    marginTop: 8,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  emptyActionBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  footerLoader: {
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  footerLoaderText: {
    fontSize: 12,
    color: theme.colors.textMuted,
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
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  cameraCancelButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
});
