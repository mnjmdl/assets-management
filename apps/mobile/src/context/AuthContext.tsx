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
  DEFAULT_COMPANY_CODE,
  getCompanyPresetForUrl,
  CompanyApiPreset,
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
  companyCode: string;
  activePreset?: CompanyApiPreset;
  setServerUrl: (url: string, newCompanyCode?: string) => Promise<void>;
  setCompanyCode: (code: string) => Promise<void>;
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
  const [companyCode, setCompanyCodeState] = useState(DEFAULT_COMPANY_CODE);

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
      // 1. Restore configured server URL & company code
      const savedServerUrl = await storage.getItem(STORAGE_KEYS.SERVER_URL);
      const activeUrl = savedServerUrl || INITIAL_API_URL;
      setServerUrlState(activeUrl);
      setApiBaseUrl(activeUrl);

      const savedCompanyCode = await storage.getItem(STORAGE_KEYS.COMPANY_CODE);
      if (savedCompanyCode) {
        setCompanyCodeState(savedCompanyCode);
      } else {
        const preset = getCompanyPresetForUrl(activeUrl);
        if (preset) {
          setCompanyCodeState(preset.code);
        }
      }

      // In background, sync live company settings if online
      apiRequest<any>('/settings', { skipAuth: true, timeoutMs: 3500 })
        .then(async (res) => {
          const data = res?.data !== undefined ? res.data : res;
          if (data && typeof data === 'object' && data.company_code) {
            setCompanyCodeState(data.company_code);
            await storage.setItem(STORAGE_KEYS.COMPANY_CODE, data.company_code);
          }
        })
        .catch(() => {});

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

  const setServerUrl = async (url: string, newCompanyCode?: string) => {
    const trimmed = url.trim().replace(/\/+$/, '');
    setServerUrlState(trimmed);
    setApiBaseUrl(trimmed);
    await storage.setItem(STORAGE_KEYS.SERVER_URL, trimmed);

    // If newCompanyCode explicitly passed or url matches a known preset
    let targetCode = newCompanyCode;
    if (!targetCode) {
      const preset = getCompanyPresetForUrl(trimmed);
      if (preset) targetCode = preset.code;
    }

    if (targetCode) {
      setCompanyCodeState(targetCode);
      await storage.setItem(STORAGE_KEYS.COMPANY_CODE, targetCode);
    }

    // Attempt to refresh live settings from newly selected endpoint
    apiRequest<any>('/settings', { skipAuth: true, timeoutMs: 3500 })
      .then(async (res) => {
        const data = res?.data !== undefined ? res.data : res;
        if (data && typeof data === 'object' && data.company_code) {
          setCompanyCodeState(data.company_code);
          await storage.setItem(STORAGE_KEYS.COMPANY_CODE, data.company_code);
        }
      })
      .catch(() => {});

    triggerLiveSync().catch(() => {});
  };

  const setCompanyCode = async (code: string) => {
    const trimmed = code.trim().toUpperCase();
    setCompanyCodeState(trimmed);
    await storage.setItem(STORAGE_KEYS.COMPANY_CODE, trimmed);
  };

  const activePreset = getCompanyPresetForUrl(serverUrl);

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
        companyCode,
        activePreset,
        setServerUrl,
        setCompanyCode,
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

