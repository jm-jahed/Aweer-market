'use client';

/**
 * AweerMarket Super Admin Authentication Context
 * Manages in-memory Super Admin session state in React.
 * Strictly avoids storing tokens or sensitive credentials in localStorage/sessionStorage.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { UserSummary } from '@aweermarket/types';
import { superAdminLogin, getSuperAdminMe, superAdminLogout, ApiClientError } from './api-client';

export interface SuperAdminAuthContextValue {
  user: UserSummary | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  clearError: () => void;
}

const SuperAdminAuthContext = createContext<SuperAdminAuthContextValue | undefined>(undefined);

export function SuperAdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const restoreSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getSuperAdminMe();
      setUser(response.user);
    } catch (err: unknown) {
      if (err instanceof ApiClientError && (err.statusCode === 401 || err.statusCode === 403)) {
        setUser(null);
      } else {
        const msg = err instanceof Error ? err.message : 'Session verification failed';
        setError(msg);
        setUser(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await superAdminLogin(email, password);
      setUser(res.user);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Super admin login failed';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setError(null);
    setUser(null);
    try {
      await superAdminLogout();
    } catch {
      // Ignored for immediate local cleanup
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <SuperAdminAuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        login,
        logout,
        restoreSession,
        clearError
      }}
    >
      {children}
    </SuperAdminAuthContext.Provider>
  );
}

export function useSuperAdminAuth(): SuperAdminAuthContextValue {
  const ctx = useContext(SuperAdminAuthContext);
  if (!ctx) {
    throw new Error('useSuperAdminAuth must be used within a SuperAdminAuthProvider');
  }
  return ctx;
}
