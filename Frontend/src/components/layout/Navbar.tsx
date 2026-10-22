'use client';

/**
 * AweerMarket Central Navigation Bar
 * Integrates with AuthContext to display live authentication status.
 * Dynamically presents Login/Register when unauthenticated, or user greeting + Logout button when authenticated.
 */

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import styles from './Navbar.module.css';

export function Navbar() {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      router.push('/');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <header className={styles.header}>
      <div className={styles.navContainer}>
        {/* Brand / Logo */}
        <Link href="/" className={styles.brandLink}>
          <div className={styles.logoIcon}>A</div>
          <div className={styles.brandText}>
            <span className={styles.brandName}>AweerMarket</span>
            <span className={styles.brandTagline}>Dubai Wholesale Produce</span>
          </div>
        </Link>

        {/* Right Navigation & Auth Status */}
        <div className={styles.navRight}>
          <nav className={styles.navLinks}>
            <Link href="/" className={styles.navLink}>
              Marketplace
            </Link>
            {user && (
              <Link href="/account" className={styles.navLink}>
                Account
              </Link>
            )}
          </nav>

          {isLoading ? (
            <div className={styles.loadingPlaceholder} aria-label="Checking session..." />
          ) : user ? (
            <div className={styles.userMenu}>
              <Link href="/account" className={styles.userGreetingLink} title="View Buyer Account">
                <span className={styles.userBadge}>Buyer</span>
                <span className={styles.userName}>{user.fullName}</span>
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className={styles.logoutBtn}
                disabled={isLoggingOut}
                aria-label="Log out of buyer account"
              >
                {isLoggingOut ? 'Logging out...' : 'Log Out'}
              </button>
            </div>
          ) : (
            <div className={styles.authGroup}>
              <Link href="/login" className={styles.loginBtn}>
                Log In
              </Link>
              <Link href="/register" className={styles.registerBtn}>
                Register as Buyer
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
