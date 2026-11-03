import { storage } from './storage';
import { STORAGE_KEYS, INITIAL_API_URL } from '../config/env';

export interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
  timeoutMs?: number;
}

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

let activeBaseUrl = INITIAL_API_URL;
let onUnauthorizedCallback: (() => void) | null = null;
let onNetworkStatusChangeCallback: ((isOnline: boolean) => void) | null = null;
let isRefreshing = false;
let refreshSubscribers: ((token: string | null) => void)[] = [];

export function setOnNetworkStatusChangeCallback(cb: (isOnline: boolean) => void) {
  onNetworkStatusChangeCallback = cb;
}

export function setApiBaseUrl(url: string) {
  // Normalize trailing slash
  activeBaseUrl = url.replace(/\/+$/, '');
}

export function getApiBaseUrl(): string {
  return activeBaseUrl;
}

export function setOnUnauthorizedCallback(cb: () => void) {
  onUnauthorizedCallback = cb;
}

function subscribeTokenRefresh(cb: (token: string | null) => void) {
  refreshSubscribers.push(cb);
}

function onRefreshed(token: string | null) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

async function refreshAuthToken(): Promise<string | null> {
  const refreshToken = await storage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
  if (!refreshToken) {
    return null;
  }

  try {
    const response = await fetch(`${activeBaseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) {
      throw new Error('Refresh token invalid or expired');
    }

    const payload = await response.json();
    const data = payload?.data !== undefined ? payload.data : payload;
    const newAccessToken = data.accessToken;
    const newRefreshToken = data.refreshToken;

    if (newAccessToken) {
      await storage.setItem(STORAGE_KEYS.ACCESS_TOKEN, newAccessToken);
    }
    if (newRefreshToken) {
      await storage.setItem(STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken);
    }

    return newAccessToken;
  } catch (error) {
    console.warn('[API] Token refresh failed:', error);
    await storage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
    await storage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
    if (onUnauthorizedCallback) {
      onUnauthorizedCallback();
    }
    return null;
  }
}

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { skipAuth = false, timeoutMs = 12000, ...fetchOptions } = options;
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const fullUrl = `${activeBaseUrl}${cleanEndpoint}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (!skipAuth) {
    const token = await storage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(fullUrl, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Handle 401 Unauthorized (attempt refresh once)
    if (response.status === 401 && !skipAuth && !endpoint.includes('/auth/')) {
      if (!isRefreshing) {
        isRefreshing = true;
        const newToken = await refreshAuthToken();
        isRefreshing = false;
        onRefreshed(newToken);

        if (newToken) {
          return apiRequest<T>(endpoint, options);
        } else {
          throw new ApiError('Session expired. Please log in again.', 401);
        }
      } else {
        // Wait for ongoing refresh
        return new Promise<T>((resolve, reject) => {
          subscribeTokenRefresh((newToken) => {
            if (newToken) {
              resolve(apiRequest<T>(endpoint, options));
            } else {
              reject(new ApiError('Session expired. Please log in again.', 401));
            }
          });
        });
      }
    }

    const contentType = response.headers.get('content-type') || '';
    let body: any = null;

    if (contentType.includes('application/json')) {
      body = await response.json();
    } else {
      body = await response.text();
    }

    if (!response.ok) {
      const errorMsg =
        (Array.isArray(body?.message) ? body.message.join(', ') : body?.message) ||
        body?.error ||
        `Request failed with status ${response.status}`;
      throw new ApiError(errorMsg, response.status, body);
    }

    // Successfully connected to backend
    onNetworkStatusChangeCallback?.(true);

    // Unwrap NestJS TransformInterceptor structure { success: true, data: ... }
    if (body && typeof body === 'object' && body.data !== undefined) {
      return body.data as T;
    }

    return body as T;
  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      onNetworkStatusChangeCallback?.(false);
      throw new ApiError('Network request timed out. Please check your connectivity.', 408);
    }
    if (error instanceof ApiError) {
      throw error;
    }
    onNetworkStatusChangeCallback?.(false);
    throw new ApiError(error?.message || 'Network request failed', 0);
  }
}

