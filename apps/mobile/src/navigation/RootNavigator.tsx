import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../screens/LoginScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { AssetsScreen } from '../screens/AssetsScreen';
import { ScanScreen } from '../screens/ScanScreen';
import { AuditScreen } from '../screens/AuditScreen';
import { AuditPlansScreen } from '../screens/AuditPlansScreen';
import { AssetDetailScreen } from '../screens/AssetDetailScreen';
import { AuditDetailScreen } from '../screens/AuditDetailScreen';
import { SessionInventoryScreen } from '../screens/SessionInventoryScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { LocationTreeScreen } from '../screens/LocationTreeScreen';
import { theme } from '../config/theme';

export type RootStackParamList = {
  Login: undefined;
  MainTabs: { screen?: string; params?: any } | undefined;
  AssetDetail: { assetCode?: string; assetId?: string };
  AuditDetail: { planId: string; planName?: string; initialSessionId?: string; isScanMode?: boolean };
  SessionInventory: { sessionId: string; session?: any; autoScan?: boolean };
  LocationTree: undefined;
  AuditStation?: { initialLocation?: any; initialSession?: any; planId?: string };
  StandaloneScan?: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Assets: undefined;
  Scan: { isScanMode?: boolean } | undefined;
  Audits: { isScanMode?: boolean } | undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// Clean WAP light theme
const wapNavigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: theme.colors.background,
    card: '#ffffff',
    text: theme.colors.textPrimary,
    border: theme.colors.cardBorder,
    primary: theme.colors.primary,
  },
};

const MainTabs = () => {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 8);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#f1f5f9',
          height: 56 + bottomInset,
          paddingBottom: bottomInset,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'grid' : 'grid-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />

      <Tab.Screen
        name="Assets"
        component={AssetsScreen}
        options={{
          tabBarLabel: 'Assets',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'cube' : 'cube-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />

      <Tab.Screen
        name="Scan"
        component={AuditPlansScreen}
        initialParams={{ isScanMode: true }}
        options={{
          tabBarLabel: 'Scan',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'qr-code' : 'qr-code-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />

      <Tab.Screen
        name="Audits"
        component={AuditPlansScreen}
        options={{
          tabBarLabel: 'Audits',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'clipboard' : 'clipboard-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />

      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={22}
              color={color}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export const RootNavigator = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={wapNavigationTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        {user ? (
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} />
            <Stack.Screen name="AssetDetail" component={AssetDetailScreen} />
            <Stack.Screen name="AuditDetail" component={AuditDetailScreen} />
            <Stack.Screen name="SessionInventory" component={SessionInventoryScreen} />
            <Stack.Screen name="LocationTree" component={LocationTreeScreen} />
            <Stack.Screen name="AuditStation" component={AuditScreen} />
            <Stack.Screen name="StandaloneScan" component={ScanScreen} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
