import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_PRODUCTION_API_URL, DEFAULT_LOCAL_API_URL } from '../config/env';
import { theme } from '../config/theme';

export const LoginScreen = () => {
  const { login, continueOffline, cachedUser, serverUrl, setServerUrl } = useAuth();

  const [email, setEmail] = useState('admin@assetmgmt.com');
  const [password, setPassword] = useState('Password123!');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Server switcher state
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState(serverUrl);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setErrorMessage('Please enter your email and password');
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
    } catch (error: any) {
      console.warn('[LoginScreen] Error:', error);
      setErrorMessage(error?.message || 'Login failed. Please check credentials or connectivity.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveCustomServer = async () => {
    if (customUrlInput.trim()) {
      await setServerUrl(customUrlInput.trim());
      setIsServerModalOpen(false);
    }
  };

  const isProduction = serverUrl === DEFAULT_PRODUCTION_API_URL;
  const isLocal = serverUrl === DEFAULT_LOCAL_API_URL;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Brand Header */}
        <View style={styles.header}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logoBadge}
            resizeMode="cover"
          />
          <Text style={styles.brandTitle}>Crystal Martin</Text>
          <Text style={styles.brandSubtitle}>Asset Lifecycle Management & Auditing</Text>
        </View>

        {/* Server Target Selector */}
        <TouchableOpacity
          style={styles.serverCard}
          onPress={() => {
            setCustomUrlInput(serverUrl);
            setIsServerModalOpen(true);
          }}
          activeOpacity={0.8}
        >
          <View style={styles.serverRow}>
            <View style={styles.serverIndicator} />
            <Text style={styles.serverLabel}>Connected Server:</Text>
            <Text style={styles.serverBadge}>
              {isProduction ? 'PROD' : isLocal ? 'LOCAL' : 'CUSTOM'}
            </Text>
          </View>
          <Text style={styles.serverUrlText} numberOfLines={1} ellipsizeMode="middle">
            {serverUrl}
          </Text>
        </TouchableOpacity>

        {/* Login Form Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sign In</Text>
          <Text style={styles.cardSubtitle}>Access mobile floor audit terminal</Text>

          {errorMessage && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Email Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="admin@assetmgmt.com"
              placeholderTextColor={theme.colors.textLight}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
            />
          </View>

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.inputLabel}>Password</Text>
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Text style={styles.showToggle}>{showPassword ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.input}
              placeholder="••••••••••••"
              placeholderTextColor={theme.colors.textLight}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.buttonPrimary, isSubmitting && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonPrimaryText}>Sign In to Terminal</Text>
            )}
          </TouchableOpacity>

          {/* Offline Mode Option */}
          {cachedUser && (
            <View style={styles.offlineSection}>
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.buttonOffline}
                onPress={continueOffline}
                activeOpacity={0.85}
              >
                <Text style={styles.buttonOfflineText}>
                  Continue Offline as {cachedUser.name || cachedUser.email}
                </Text>
                <Text style={styles.offlineHint}>
                  (Operate inside dead factory zones with cached session)
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Internal Factory Auditing Terminal v1.0.0</Text>
          <Text style={styles.footerSubtext}>Crystal Martin Bangladesh Ltd.</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>

      {/* Server Configuration Modal */}
      <Modal
        visible={isServerModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsServerModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Server Endpoint</Text>
            <Text style={styles.modalSubtitle}>
              Choose the API environment for this device:
            </Text>

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
    padding: 24,
    justifyContent: 'center',
    minHeight: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    ...theme.shadows.card,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 3,
  },
  serverCard: {
    backgroundColor: '#ffffff',
    borderRadius: theme.borderRadius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    marginBottom: 16,
    ...theme.shadows.sm,
  },
  serverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  serverIndicator: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.success,
    marginRight: 6,
  },
  serverLabel: {
    fontSize: 11,
    color: theme.colors.textMuted,
    flex: 1,
  },
  serverBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  serverUrlText: {
    fontSize: 11,
    color: theme.colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: theme.borderRadius.lg,
    padding: 22,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    ...theme.shadows.card,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  cardSubtitle: {
    fontSize: 12,
    color: theme.colors.textMuted,
    marginTop: 2,
    marginBottom: 16,
  },
  errorBanner: {
    backgroundColor: theme.colors.dangerLight,
    borderWidth: 1,
    borderColor: theme.colors.dangerBorder,
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
  },
  errorText: {
    color: theme.colors.danger,
    fontSize: 12,
    lineHeight: 16,
  },
  inputGroup: {
    marginBottom: 14,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '600',
    marginBottom: 6,
  },
  showToggle: {
    fontSize: 11,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  input: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.textPrimary,
    fontSize: 14,
  },
  buttonPrimary: {
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonPrimaryText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  offlineSection: {
    marginTop: 16,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.divider,
    marginBottom: 14,
  },
  buttonOffline: {
    backgroundColor: theme.colors.warningLight,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.warningBorder,
  },
  buttonOfflineText: {
    color: theme.colors.warning,
    fontSize: 12,
    fontWeight: '700',
  },
  offlineHint: {
    color: theme.colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    fontSize: 11,
    color: theme.colors.textLight,
  },
  footerSubtext: {
    fontSize: 10,
    color: theme.colors.textLight,
    marginTop: 2,
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
