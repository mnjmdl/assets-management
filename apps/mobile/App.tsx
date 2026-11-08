import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { AnimatedSplashScreen } from './src/components/AnimatedSplashScreen';

function AppContent() {
  const { isLoading } = useAuth();
  const [isSplashComplete, setIsSplashComplete] = useState(false);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <RootNavigator />
      {!isSplashComplete && (
        <AnimatedSplashScreen
          isReady={!isLoading}
          onFinish={() => setIsSplashComplete(true)}
          minDisplayTimeMs={1800}
        />
      )}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
