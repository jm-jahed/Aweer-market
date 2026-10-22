'use client';

/**
 * AweerMarket Frontend Authentication Context
 * Manages in-memory buyer session state strictly in React state.
 * Never stores tokens or sensitive credentials in localStorage or sessionStorage.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { UserSummary } from '@aweermarket/types';
import { getAuthMe, logoutUser, ApiClientError } from './api-client';

export interface AuthContextValue {
  user: UserSummary | null;
  isLoading: boolean;
  error: string | null;
  restoreSession: () => Promise<void>;
  setSessionUser: (user: UserSummary) => void;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export interface AuthProviderProps {
  children: ReactNode;
}

/**
 * AuthProvider wraps application components to supply shared authentication state.
 * Initializes with isLoading: true to prevent premature redirects before session restoration completes.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<UserSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Queries /api/v1/auth/me to restore the authenticated session from the HTTP-only cookie.
   */
  const restoreSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getAuthMe();
      setUser(response.user);
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.statusCode === 401) {
        // Expected unauthenticated state when no session cookie exists
        setUser(null);
      } else {
        const message = err instanceof Error ? err.message : 'Unable to restore session';
        setError(message);
        setUser(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Restore session once on initial mount
  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  /**
   * Synchronizes in-memory user state after successful login or registration.
   */
  const setSessionUser = useCallback((newUser: UserSummary) => {
    setUser(newUser);
    setError(null);
    setIsLoading(false);
  }, []);

  /**
   * Logs out the user.
   * Immediately clears local user state so UI reflects unauthenticated status,
   * even if the network request fails or takes time.
   */
  const logout = useCallback(async () => {
    setError(null);
    setUser(null); // Immediate local cleanup
    try {
      await logoutUser();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Logout request encountered a network error';
      setError(message);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        error,
        restoreSession,
        setSessionUser,
        logout,
        clearError
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access the current authentication state and actions.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
