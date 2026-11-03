import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { theme } from '../config/theme';
import { DEFAULT_PRODUCTION_API_URL, DEFAULT_LOCAL_API_URL } from '../config/env';

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

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out from this terminal?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
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

