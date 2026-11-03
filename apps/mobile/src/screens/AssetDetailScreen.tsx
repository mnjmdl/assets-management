import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRoute, useNavigation } from '@react-navigation/native';
import {
  findCachedAsset,
  CachedAsset,
  saveOfflinePhoto,
  getOfflinePhotosForAsset,
  OfflinePhotoRecord,
  recordOfflineAudit,
  markOfflinePhotoSynced,
} from '../database/db';
import { apiRequest, getApiBaseUrl } from '../services/api';
import { storage } from '../services/storage';
import { STORAGE_KEYS } from '../config/env';
import { useAuth } from '../context/AuthContext';
import { theme } from '../config/theme';
import { flushAllOutbox, triggerLiveSync } from '../services/syncManager';

export const AssetDetailScreen = () => {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const { isOfflineMode } = useAuth();

  const assetCodeParam = route.params?.assetCode || '';
  const assetIdParam = route.params?.assetId || '';

  const [asset, setAsset] = useState<CachedAsset | null>(null);
  const [photos, setPhotos] = useState<OfflinePhotoRecord[]>([]);
  const [serverPhotos, setServerPhotos] = useState<Array<{ id: string; url: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [currentCondition, setCurrentCondition] = useState('GOOD');

  useEffect(() => {
    loadAssetData();
  }, [assetCodeParam, assetIdParam]);

  const loadAssetData = async () => {
    setIsLoading(true);
    try {
      const codeOrId = assetCodeParam || assetIdParam;
      if (!codeOrId) return;

      // 1. Fast local SQLite query
      const cached = await findCachedAsset(codeOrId);
      if (cached) {
        setAsset(cached);
        setCurrentCondition(cached.condition || 'GOOD');

        // Load offline photos for this asset
        const localPhotos = await getOfflinePhotosForAsset(cached.id);
        setPhotos(localPhotos);
      }

      // 2. If online, fetch live server record with uploaded photos
      if (!isOfflineMode && (cached?.id || assetIdParam)) {
        try {
          const targetId = cached?.id || assetIdParam;
          const liveData = await apiRequest<any>(`/assets/${targetId}`, { timeoutMs: 5000 });
          if (liveData) {
            if (liveData.photos && Array.isArray(liveData.photos)) {
              setServerPhotos(
                liveData.photos.map((p: any) => ({
                  id: p.id,
                  url: p.filePath?.startsWith('http')
                    ? p.filePath
                    : `${getApiBaseUrl().replace('/api/v1', '')}/${p.filePath.replace(/^\.?\//, '')}`,
                })),
              );
            }
          }
        } catch (e) {
          console.warn('[AssetDetail] Online fetch failed, using local SQLite:', e);
        }
      }
    } catch (err) {
      console.warn('[AssetDetail] Error loading asset:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCapturePhoto = async (useCamera: boolean) => {
    if (!asset) return;

    try {
      let result;
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Camera permission is required to capture photos.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.8,
          allowsEditing: false,
        });
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Gallery permission is required to select photos.');
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.8,
        });
      }

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const photoUri = result.assets[0].uri;
      const photoId = `photo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const now = new Date().toISOString();

      // Save locally in SQLite
      await saveOfflinePhoto({
        id: photoId,
        assetId: asset.id,
        assetCode: asset.assetCode,
        uri: photoUri,
        capturedAt: now,
      });

      const updatedLocal = await getOfflinePhotosForAsset(asset.id);
      setPhotos(updatedLocal);

      // Attempt online upload if connected
      if (!isOfflineMode) {
        uploadPhotoToServer(photoUri, asset.id, photoId);
      } else {
        Alert.alert('Saved Offline', 'Photo saved to device. Will upload automatically when online.');
      }
    } catch (e: any) {
      Alert.alert('Photo Error', e?.message || 'Failed to capture photo.');
    }
  };

  const uploadPhotoToServer = async (uri: string, assetId: string, photoId?: string) => {
    setIsUploadingPhoto(true);
    try {
      const token = await storage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      const formData = new FormData();

      const filename = uri.split('/').pop() || 'equipment_photo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('photos', {
        uri,
        name: filename,
        type,
      } as any);

      const response = await fetch(`${getApiBaseUrl()}/assets/${assetId}/photos`, {
        method: 'POST',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: formData,
      });

      if (response.ok) {
        if (photoId) {
          await markOfflinePhotoSynced(photoId);
        }
        Alert.alert('Upload Complete', 'Equipment photo uploaded to server successfully.');
        loadAssetData();
      } else {
        throw new Error(`Upload failed with status ${response.status}`);
      }
    } catch (err: any) {
      console.warn('[AssetDetail] Photo upload error:', err);
      Alert.alert(
        'Upload Pending',
        'Could not reach server. Photo is safely stored locally and will sync later.',
      );
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleUpdateCondition = async (cond: string) => {
    if (!asset) return;
    setCurrentCondition(cond);

    // Record audit status change in SQLite
    await recordOfflineAudit({
      id: `cond_${Date.now()}`,
      assetId: asset.id,
      assetCode: asset.assetCode,
      scannedCode: asset.assetCode,
      status: cond === 'DAMAGED' ? 'DAMAGED' : 'FOUND',
      verifiedLocationId: asset.locationId,
      notes: `Condition set to ${cond}`,
      auditedAt: new Date().toISOString(),
    });

    if (!isOfflineMode) {
      triggerLiveSync().catch((e) => console.warn('[AssetDetail] Background outbox flush error:', e));
    }

    Alert.alert('Condition Recorded', `Equipment condition updated to ${cond}.`);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (!asset) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.notFoundContainer}>
          <Text style={styles.notFoundTitle}>Equipment Not Found</Text>
          <Text style={styles.notFoundSub}>
            No asset matching "{assetCodeParam || assetIdParam}" in local catalog.
          </Text>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backButtonText}>← Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Navigation Bar */}
        <View style={styles.navBar}>
          <TouchableOpacity style={styles.navBackBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.navBackText}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{asset.status}</Text>
          </View>
        </View>

        {/* Hero Card */}
        <View style={styles.heroCard}>
          <Text style={styles.heroCode}>{asset.assetCode}</Text>
          <Text style={styles.heroName}>{asset.name}</Text>
          {asset.sapAssetCode && (
            <View style={styles.sapPill}>
              <Text style={styles.sapPillLabel}>SAP Asset Code:</Text>
              <Text style={styles.sapPillValue}>{asset.sapAssetCode}</Text>
            </View>
          )}
        </View>

        {/* Technical Specs Card */}
        <View style={styles.specsCard}>
          <Text style={styles.cardTitle}>Equipment Specifications</Text>

          <View style={styles.specRow}>
            <Text style={styles.specLabel}>Category:</Text>
            <Text style={styles.specValue}>{asset.categoryName || 'General Machine'}</Text>
          </View>

          <View style={styles.specRow}>
            <Text style={styles.specLabel}>Model / Type:</Text>
            <Text style={styles.specValue}>{asset.model || '—'}</Text>
          </View>

          <View style={styles.specRow}>
            <Text style={styles.specLabel}>Serial Number:</Text>
            <Text style={styles.specValue}>{asset.serialNumber || '—'}</Text>
          </View>

          <View style={styles.specRow}>
            <Text style={styles.specLabel}>Barcode / QR:</Text>
            <Text style={styles.specValue}>{asset.qrCode || asset.barcode || asset.assetCode}</Text>
          </View>

          <View style={styles.specRow}>
            <Text style={styles.specLabel}>Current Line:</Text>
            <Text style={styles.specValueHighlight}>
              {asset.locationName || 'Unassigned Station'}
            </Text>
          </View>
        </View>

        {/* Condition Rating Selector */}
        <View style={styles.conditionCard}>
          <Text style={styles.cardTitle}>Physical Condition</Text>
          <View style={styles.conditionRow}>
            {['GOOD', 'FAIR', 'DAMAGED'].map((cond) => {
              const isSelected = currentCondition === cond;
              return (
                <TouchableOpacity
                  key={cond}
                  style={[
                    styles.condButton,
                    isSelected &&
                      (cond === 'GOOD'
                        ? styles.condGood
                        : cond === 'FAIR'
                        ? styles.condFair
                        : styles.condDamaged),
                  ]}
                  onPress={() => handleUpdateCondition(cond)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.condText, isSelected && styles.condTextActive]}>
                    {cond === 'GOOD' ? '✓ Good' : cond === 'FAIR' ? '⚠ Fair' : '✕ Damaged'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Equipment Condition Photo Gallery */}
        <View style={styles.photoCard}>
          <View style={styles.photoHeader}>
            <Text style={styles.cardTitle}>
              Inspection Photos ({photos.length + serverPhotos.length})
            </Text>
            {isUploadingPhoto && <ActivityIndicator size="small" color={theme.colors.primary} />}
          </View>

          {/* Capture Actions */}
          <View style={styles.photoActionRow}>
            <TouchableOpacity
              style={styles.photoBtnPrimary}
              onPress={() => handleCapturePhoto(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.photoBtnText}>📷 Take Photo</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.photoBtnSecondary}
              onPress={() => handleCapturePhoto(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.photoBtnSecText}>🖼 Gallery</Text>
            </TouchableOpacity>
          </View>

          {/* Photo Previews */}
          {photos.length > 0 || serverPhotos.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
              {photos.map((p) => (
                <View key={p.id} style={styles.photoThumbWrapper}>
                  <Image source={{ uri: p.uri }} style={styles.photoThumb} />
                  <View style={styles.photoOfflineBadge}>
                    <Text style={styles.photoOfflineText}>Local</Text>
                  </View>
                </View>
              ))}
              {serverPhotos.map((p) => (
                <View key={p.id} style={styles.photoThumbWrapper}>
                  <Image source={{ uri: p.url }} style={styles.photoThumb} />
                  <View style={styles.photoOnlineBadge}>
                    <Text style={styles.photoOnlineText}>Cloud</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.noPhotosText}>
              No inspection photos attached. Tap "Take Photo" to capture equipment tag or condition.
            </Text>
          )}
        </View>
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
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notFoundContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  notFoundTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.danger,
  },
  notFoundSub: {
    fontSize: 13,
    color: theme.colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
    marginBottom: 16,
  },
  backButton: {
    backgroundColor: theme.colors.primaryLight,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  backButtonText: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  navBackBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  navBackText: {
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  headerBadge: {
    backgroundColor: theme.colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: theme.colors.successBorder,
  },
  headerBadgeText: {
    color: theme.colors.success,
    fontSize: 11,
    fontWeight: '700',
  },
  heroCard: {
    backgroundColor: '#ffffff',
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.primaryBorder,
    marginBottom: 14,
    ...theme.shadows.sm,
  },
  heroCode: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.primary,
  },
  heroName: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginTop: 2,
  },
  sapPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primaryLight,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 8,
    borderWidth: 1,
    borderColor: theme.colors.primaryBorder,
  },
  sapPillLabel: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginRight: 4,
  },
  sapPillValue: {
    fontSize: 11,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  specsCard: {
    backgroundColor: '#ffffff',
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    marginBottom: 14,
    ...theme.shadows.sm,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.textPrimary,
    marginBottom: 10,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  specLabel: {
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  specValue: {
    fontSize: 12,
    color: theme.colors.textPrimary,
    fontWeight: '500',
  },
  specValueHighlight: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  conditionCard: {
    backgroundColor: '#ffffff',
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    marginBottom: 14,
    ...theme.shadows.sm,
  },
  conditionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  condButton: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  condGood: {
    backgroundColor: theme.colors.successLight,
    borderColor: theme.colors.successBorder,
  },
  condFair: {
    backgroundColor: theme.colors.warningLight,
    borderColor: theme.colors.warningBorder,
  },
  condDamaged: {
    backgroundColor: theme.colors.dangerLight,
    borderColor: theme.colors.dangerBorder,
  },
  condText: {
    fontSize: 12,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  condTextActive: {
    color: theme.colors.textPrimary,
    fontWeight: '700',
  },
  photoCard: {
    backgroundColor: '#ffffff',
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    marginBottom: 14,
    ...theme.shadows.sm,
  },
  photoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  photoActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 10,
  },
  photoBtnPrimary: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
  },
  photoBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  photoBtnSecondary: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  photoBtnSecText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  photoScroll: {
    flexDirection: 'row',
    marginTop: 6,
  },
  photoThumbWrapper: {
    position: 'relative',
    marginRight: 10,
  },
  photoThumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  photoOfflineBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(217, 119, 6, 0.9)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  photoOfflineText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '700',
  },
  photoOnlineBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(5, 150, 105, 0.9)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  photoOnlineText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: '700',
  },
  noPhotosText: {
    fontSize: 11,
    color: theme.colors.textLight,
    fontStyle: 'italic',
    paddingVertical: 6,
  },
});
