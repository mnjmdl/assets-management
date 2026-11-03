import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useAudioPlayer } from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../config/theme';

const beepSound = require('../../assets/beep.wav');

interface ScannerViewProps {
  onScan: (code: string) => void;
  isScanningLocked?: boolean;
  onCameraActiveChange?: (isActive: boolean) => void;
  defaultCompact?: boolean;
}

export const ScannerView: React.FC<ScannerViewProps> = ({
  onScan,
  isScanningLocked = false,
  onCameraActiveChange,
  defaultCompact = true,
}) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCompact, setIsCompact] = useState(defaultCompact);
  const [enableTorch, setEnableTorch] = useState(false);
  const [hardwareInput, setHardwareInput] = useState('');
  const lastScannedTimeRef = useRef<number>(0);
  const audioPlayer = useAudioPlayer(beepSound);

  useEffect(() => {
    return () => {
      onCameraActiveChange?.(false);
    };
  }, []);

  const handleStartCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        alert('Camera permission is required to scan asset tags.');
        return;
      }
    }
    setIsCameraActive(true);
    onCameraActiveChange?.(true);
  };

  const handleStopCamera = () => {
    setIsCameraActive(false);
    setEnableTorch(false);
    onCameraActiveChange?.(false);
  };

  const handleBarcodeScanned = (scanningResult: { data: string }) => {
    if (isScanningLocked) return;

    const now = Date.now();
    // Debounce duplicate scans within 1.5 seconds
    if (now - lastScannedTimeRef.current < 1500) {
      return;
    }
    lastScannedTimeRef.current = now;

    const scannedText = scanningResult.data?.trim();
    if (scannedText) {
      triggerScanFeedback();
      onScan(scannedText);
    }
  };

  const handleHardwareSubmit = () => {
    const code = hardwareInput.trim();
    if (code) {
      triggerScanFeedback();
      onScan(code);
      setHardwareInput('');
    }
  };

  const triggerScanFeedback = async () => {
    // 1. Play audible scanner confirmation chirp
    try {
      audioPlayer.seekTo(0);
      audioPlayer.play();
    } catch (e) {
      // Audio playback fails gracefully if muted or unsupported
    }

    // 2. Trigger tactile haptic pulse
    try {
      if (Platform.OS !== 'web') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      // Ignore vibration error on unsupported platforms
    }
  };

  return (
    <View style={styles.container}>
      {/* Hardware Scanner & Manual Input Wedge (hidden when camera is active) */}
      {!isCameraActive && (
        <View style={styles.hardwareWedgeContainer}>
          <View style={styles.wedgeHeader}>
            <View style={styles.wedgeHeaderTitleRow}>
              <View style={styles.laserDot} />
              <Text style={styles.wedgeLabel}>Laser Gun / Manual Input</Text>
            </View>
            <TouchableOpacity
              style={styles.headerCameraBtn}
              onPress={handleStartCamera}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Start camera viewfinder"
            >
              <Ionicons name="camera-outline" size={16} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.wedgeInputRow}>
            <TextInput
              style={styles.wedgeInput}
              placeholder="Scan barcode gun or type code..."
              placeholderTextColor={theme.colors.textLight}
              autoCapitalize="characters"
              autoCorrect={false}
              value={hardwareInput}
              onChangeText={setHardwareInput}
              onSubmitEditing={handleHardwareSubmit}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={styles.wedgeSubmitBtn}
              onPress={handleHardwareSubmit}
              activeOpacity={0.85}
            >
              <Text style={styles.wedgeSubmitBtnText}>Enter</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Camera Viewfinder (activated via camera button) */}
      {isCameraActive && (
        <View style={styles.cameraWrapper}>
          <CameraView
            style={[styles.camera, isCompact ? styles.cameraCompact : styles.cameraExpanded]}
            facing="back"
            enableTorch={enableTorch}
            barcodeScannerSettings={{
              barcodeTypes: [
                'qr',
                'code128',
                'code39',
                'ean13',
                'ean8',
                'upc_a',
                'upc_e',
              ],
            }}
            onBarcodeScanned={handleBarcodeScanned}
          >
            {/* Viewfinder Reticle Overlay */}
            <View style={styles.overlayContainer}>
              <View style={[styles.reticleBox, isCompact ? styles.reticleBoxCompact : styles.reticleBoxExpanded]}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
                <View style={styles.laserGuide} />
              </View>
              <Text style={[styles.reticleHint, isCompact && styles.reticleHintCompact]}>
                {isCompact ? 'Scan QR / barcode' : 'Align asset tag inside target box'}
              </Text>
            </View>
          </CameraView>

          {/* Camera Controls Bar */}
          <View style={styles.cameraControls}>
            <TouchableOpacity
              style={[styles.controlBtn, enableTorch && styles.controlBtnActive]}
              onPress={() => setEnableTorch(!enableTorch)}
              activeOpacity={0.8}
            >
              <Text style={styles.controlBtnText}>
                {enableTorch ? '🔦 Torch On' : '🔦 Torch Off'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlBtn}
              onPress={() => setIsCompact((prev) => !prev)}
              activeOpacity={0.8}
            >
              <View style={styles.controlBtnContent}>
                <Ionicons
                  name={isCompact ? 'expand-outline' : 'contract-outline'}
                  size={14}
                  color="#ffffff"
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.controlBtnText}>
                  {isCompact ? 'Expand' : 'Compact'}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.stopCameraBtn}
              onPress={handleStopCamera}
              activeOpacity={0.8}
            >
              <Text style={styles.stopCameraBtnText}>✕ Stop</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  hardwareWedgeContainer: {
    backgroundColor: '#ffffff',
    borderRadius: theme.borderRadius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    marginBottom: 10,
    ...theme.shadows.sm,
  },
  wedgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  wedgeHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerCameraBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: theme.colors.primaryLight,
    borderWidth: 1,
    borderColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  laserDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.danger,
    marginRight: 6,
  },
  wedgeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  wedgeInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  wedgeInput: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: theme.colors.textPrimary,
    fontSize: 13,
  },
  wedgeSubmitBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  wedgeSubmitBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  cameraWrapper: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: theme.colors.primary,
    backgroundColor: '#000000',
  },
  camera: {
    width: '100%',
  },
  cameraCompact: {
    height: 190,
  },
  cameraExpanded: {
    height: 330,
  },
  overlayContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reticleBox: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reticleBoxCompact: {
    width: 200,
    height: 120,
  },
  reticleBoxExpanded: {
    width: 240,
    height: 200,
  },
  corner: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderColor: '#38bdf8',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 6,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 6,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 6,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 6,
  },
  laserGuide: {
    width: '90%',
    height: 2,
    backgroundColor: '#ef4444',
  },
  reticleHint: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  reticleHintCompact: {
    marginTop: 6,
    fontSize: 10,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  cameraControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 10,
    gap: 8,
  },
  controlBtn: {
    backgroundColor: '#1e293b',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  controlBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlBtnActive: {
    backgroundColor: '#2563eb',
  },
  controlBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  stopCameraBtn: {
    backgroundColor: '#dc2626',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  stopCameraBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
});
