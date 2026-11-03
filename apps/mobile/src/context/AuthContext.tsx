import React, { createContext, useContext, useState, useEffect } from 'react';
import { storage } from '../services/storage';
import {
  apiRequest,
  setApiBaseUrl,
  getApiBaseUrl,
  setOnUnauthorizedCallback,
} from '../services/api';
import {
  STORAGE_KEYS,
  INITIAL_API_URL,
} from '../config/env';
import {
  startLiveSyncWorker,
  triggerLiveSync,
  subscribeNetworkStatus,
  getIsNetworkOnline,
  checkServerOnline,
} from '../services/syncManager';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  departmentId?: string | null;
  lastLoginAt?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  isLoading: boolean;
  isOfflineMode: boolean;
  isServerReachable: boolean;
  isOnline: boolean;
  cachedUser: UserProfile | null;
  serverUrl: string;
  setServerUrl: (url: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  continueOffline: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [cachedUser, setCachedUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isServerReachable, setIsServerReachable] = useState<boolean>(getIsNetworkOnline());
  const [serverUrl, setServerUrlState] = useState(INITIAL_API_URL);

  useEffect(() => {
    bootstrapAuth();
    checkServerOnline().then((online) => setIsServerReachable(online));
    const unsubNet = subscribeNetworkStatus((online) => {
      setIsServerReachable(online);
    });
    setOnUnauthorizedCallback(() => {
      setUser(null);
      setToken(null);
    });
    return () => unsubNet();
  }, []);

  const isOnline = !isOfflineMode && isServerReachable;

  useEffect(() => {
    if (!isOfflineMode) {
      const stopWorker = startLiveSyncWorker();
      return () => stopWorker();
    }
  }, [isOfflineMode]);

  const bootstrapAuth = async () => {
    try {
      // 1. Restore configured server URL
      const savedServerUrl = await storage.getItem(STORAGE_KEYS.SERVER_URL);
      if (savedServerUrl) {
        setServerUrlState(savedServerUrl);
        setApiBaseUrl(savedServerUrl);
      } else {
        setServerUrlState(INITIAL_API_URL);
        setApiBaseUrl(INITIAL_API_URL);
      }

      // 2. Restore cached user profile
      const storedUser = await storage.getObject<UserProfile>(STORAGE_KEYS.CACHED_USER);
      if (storedUser) {
        setCachedUser(storedUser);
      }

      // 3. Restore token
      const storedToken = await storage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(storedUser);
      }
    } catch (error) {
      console.warn('[AuthProvider] Bootstrap error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setServerUrl = async (url: string) => {
    const trimmed = url.trim().replace(/\/+$/, '');
    setServerUrlState(trimmed);
    setApiBaseUrl(trimmed);
    await storage.setItem(STORAGE_KEYS.SERVER_URL, trimmed);
    triggerLiveSync().catch(() => {});
  };

  const login = async (email: string, password: string) => {
    const response = await apiRequest<{
      accessToken: string;
      refreshToken: string;
      user: UserProfile;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: email.trim(), password }),
      skipAuth: true,
    });

    const { accessToken, refreshToken, user: profile } = response;

    await storage.setItem(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    await storage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
    await storage.setObject(STORAGE_KEYS.CACHED_USER, profile);

    setToken(accessToken);
    setUser(profile);
    setCachedUser(profile);
    setIsOfflineMode(false);
  };

  const continueOffline = () => {
    if (cachedUser) {
      setUser(cachedUser);
      setIsOfflineMode(true);
    }
  };

  const logout = async () => {
    try {
      const refreshToken = await storage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
      if (refreshToken && !isOfflineMode) {
        await apiRequest('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
          timeoutMs: 3000,
        }).catch(() => {});
      }
    } catch {
      // Ignore network errors on logout
    } finally {
      await storage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      await storage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      setUser(null);
      setToken(null);
      setIsOfflineMode(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isOfflineMode,
        isServerReachable,
        isOnline,
        cachedUser,
        serverUrl,
        setServerUrl,
        login,
        continueOffline,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

