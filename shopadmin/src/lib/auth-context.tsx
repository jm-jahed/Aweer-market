'use client';

/**
 * AweerMarket Shop Admin Authentication Context
 * Manages in-memory Vendor/Shop Admin session state in React.
 * Strictly avoids storing tokens or sensitive credentials in localStorage/sessionStorage.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { UserSummary } from '@aweermarket/types';
import type { RegisterVendorInput } from '@aweermarket/validation';
import {
  vendorLogin,
  vendorRegister,
  getVendorMe,
  vendorLogout,
  getVendorShop,
  VendorShopSummary,
  ApiClientError
} from './api-client';

export interface ShopAdminAuthContextValue {
  user: UserSummary | null;
  shop: VendorShopSummary | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterVendorInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshShop: () => Promise<void>;
  clearError: () => void;
}

const ShopAdminAuthContext = createContext<ShopAdminAuthContextValue | undefined>(undefined);

export function ShopAdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserSummary | null>(null);
  const [shop, setShop] = useState<VendorShopSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const restoreSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getVendorMe();
      setUser(response.user);
      setShop(response.shop);
    } catch (err: unknown) {
      if (err instanceof ApiClientError && (err.statusCode === 401 || err.statusCode === 403)) {
        setUser(null);
        setShop(null);
      } else {
        const msg = err instanceof Error ? err.message : 'Session verification failed';
        setError(msg);
        setUser(null);
        setShop(null);
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
      const res = await vendorLogin(email, password);
      setUser(res.user);
      setShop(res.shop);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Vendor login failed';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(async (data: RegisterVendorInput) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await vendorRegister(data);
      setUser(res.user);
      setShop(res.shop);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Vendor registration failed';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshShop = useCallback(async () => {
    try {
      const res = await getVendorShop();
      setShop(res.shop);
    } catch {
      // Ignored
    }
  }, []);

  const logout = useCallback(async () => {
    setError(null);
    setUser(null);
    setShop(null);
    try {
      await vendorLogout();
    } catch {
      // Ignored for immediate local cleanup
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <ShopAdminAuthContext.Provider
      value={{
        user,
        shop,
        isLoading,
        error,
        login,
        register,
        logout,
        refreshShop,
        clearError
      }}
    >
      {children}
    </ShopAdminAuthContext.Provider>
  );
}

export function useShopAdminAuth(): ShopAdminAuthContextValue {
  const ctx = useContext(ShopAdminAuthContext);
  if (!ctx) {
    throw new Error('useShopAdminAuth must be used within a ShopAdminAuthProvider');
  }
  return ctx;
}
