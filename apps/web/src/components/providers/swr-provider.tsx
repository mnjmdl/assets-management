'use client';

import React from 'react';
import { SWRConfig } from 'swr';

export const swrFetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    let errorInfo: any = {};
    try {
      errorInfo = await res.json();
    } catch {
      // not json
    }
    const error = new Error(errorInfo.message || `Request failed with status ${res.status}`);
    (error as any).status = res.status;
    (error as any).info = errorInfo;
    throw error;
  }
  return res.json();
};

export interface SWRProviderProps {
  children: React.ReactNode;
}

export function SWRProvider({ children }: SWRProviderProps) {
  return (
    <SWRConfig
      value={{
        fetcher: swrFetcher,
        refreshInterval: 60000, // Revalidate every minute (60 seconds)
        revalidateOnFocus: true, // Revalidate when window / tab becomes active
        revalidateOnReconnect: true, // Revalidate when network reconnects
        revalidateIfStale: true,
        dedupingInterval: 4000, // Dedupe identical requests within 4 seconds
        errorRetryCount: 3,
        errorRetryInterval: 5000,
        keepPreviousData: true,
      }}
    >
      {children}
    </SWRConfig>
  );
}

