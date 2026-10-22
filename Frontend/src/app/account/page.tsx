'use client';

/**
 * AweerMarket Buyer Account Foundation
 * Displays verified buyer profile data from UserSummary.
 * Client-side route guard: redirects unauthenticated visitors to /login.
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import styles from './Account.module.css';

export default function BuyerAccountPage() {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Client-side route protection: redirect to /login when not authenticated
  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [isLoading, user, router]);

  // Loading state during initial session probe
  if (isLoading) {
    return (
      <main className={styles.container}>
        <div className={styles.loadingContainer} role="status" aria-live="polite">
          <div className={styles.spinner} />
          <h2 className={styles.loadingTitle}>Loading Account Details</h2>
          <p className={styles.loadingText}>Verifying authenticated session...</p>
        </div>
      </main>
    );
  }

  // Guard against render before redirect completes
  if (!user) {
    return (
      <main className={styles.container}>
        <div className={styles.loadingContainer} role="status">
          <h2 className={styles.loadingTitle}>Redirecting to Login</h2>
          <p className={styles.loadingText}>You must be logged in to view your account.</p>
        </div>
      </main>
    );
  }

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      router.replace('/login');
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Safe formatting for registration date
  let formattedDate = 'Recently';
  try {
    if (user.createdAt) {
      formattedDate = new Date(user.createdAt).toLocaleDateString('en-AE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
  } catch {
    formattedDate = user.createdAt || 'Recently';
  }

  const isProvisional = !user.isEmailVerified;

  return (
    <main className={styles.container}>
      {/* Header Banner */}
      <header className={styles.headerCard}>
        <div className={styles.headerInfo}>
          <h1>{user.fullName}</h1>
          <p className={styles.headerSubtitle}>{user.email}</p>
        </div>
        <div className={styles.badgeGroup}>
          <span className={styles.roleBadge}>{user.role || 'BUYER'}</span>
          {isProvisional ? (
            <span className={styles.provisionalBadge}>Provisional Account</span>
          ) : (
            <span className={styles.verifiedBadge}>Verified Buyer</span>
          )}
        </div>
      </header>

      {/* Provisional Notice */}
      {isProvisional && (
        <section className={styles.provisionalAlert} aria-label="Account status notice">
          <span className={styles.alertIcon} aria-hidden="true">&#9888;</span>
          <div className={styles.alertContent}>
            <h3>Provisional Account Active</h3>
            <p>
              Your account has provisional access enabled. You can browse the Al Aweer wholesale marketplace
              and place orders. Full email verification will be available in an upcoming release.
            </p>
          </div>
        </section>
      )}

      {/* Main Account Details Grid */}
      <div className={styles.grid}>
        {/* Profile Card */}
        <section className={styles.card} aria-labelledby="profile-heading">
          <h2 id="profile-heading" className={styles.cardTitle}>Buyer Profile Details</h2>
          <dl className={styles.dataList}>
            <div className={styles.dataRow}>
              <dt className={styles.dataLabel}>Full Name</dt>
              <dd className={styles.dataValue}>{user.fullName}</dd>
            </div>

            <div className={styles.dataRow}>
              <dt className={styles.dataLabel}>Email Address</dt>
              <dd className={styles.dataValue}>{user.email}</dd>
            </div>

            <div className={styles.dataRow}>
              <dt className={styles.dataLabel}>Business Name</dt>
              <dd className={styles.dataValue}>
                {user.businessName && user.businessName.trim() ? (
                  user.businessName
                ) : (
                  <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Individual Buyer / Not Specified</span>
                )}
              </dd>
            </div>

            <div className={styles.dataRow}>
              <dt className={styles.dataLabel}>Account Status</dt>
              <dd className={styles.dataValue}>
                {user.isActive ? (
                  <span className={styles.activeStatus}>
                    <span className={styles.statusDot} aria-hidden="true" />
                    Active
                  </span>
                ) : (
                  <span style={{ color: '#dc2626', fontWeight: 600 }}>Suspended</span>
                )}
              </dd>
            </div>

            <div className={styles.dataRow}>
              <dt className={styles.dataLabel}>Email Status</dt>
              <dd className={styles.dataValue}>
                {user.isEmailVerified ? 'Verified' : 'Provisional (Unverified)'}
              </dd>
            </div>

            <div className={styles.dataRow}>
              <dt className={styles.dataLabel}>Member Since</dt>
              <dd className={styles.dataValue}>{formattedDate}</dd>
            </div>

            <div className={styles.dataRow}>
              <dt className={styles.dataLabel}>Account ID</dt>
              <dd className={styles.dataValue}>
                <code className={styles.monoValue}>{user.id}</code>
              </dd>
            </div>
          </dl>
        </section>

        {/* Side Actions Column */}
        <aside>
          {/* Marketplace Discovery */}
          <section className={styles.sideCard} aria-labelledby="marketplace-heading">
            <h3 id="marketplace-heading" className={styles.sideCardTitle}>Wholesale Produce</h3>
            <p className={styles.sideCardText}>
              Discover fresh fruits and vegetables with real-time price comparison across Al Aweer Central Market stalls.
            </p>
            <Link href="/" className={styles.primaryActionBtn}>
              Browse Marketplace
            </Link>
          </section>

          {/* Orders Roadmap Notice */}
          <section className={styles.sideCard} aria-labelledby="orders-heading">
            <h3 id="orders-heading" className={styles.sideCardTitle}>Orders &amp; Cart</h3>
            <div className={styles.placeholderNotice}>
              Single-vendor carts, scheduled delivery, and live order tracking will appear here once ordering is active.
            </div>
          </section>
        </aside>
      </div>

      {/* Security & Session Management */}
      <section className={styles.logoutSection} aria-label="Session management">
        <div className={styles.logoutInfo}>
          <h4>Active Session</h4>
          <p>Logged in via secure HTTP-only session cookie. End your session securely anytime.</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className={styles.accountLogoutBtn}
          aria-label="Log out of buyer account"
        >
          {isLoggingOut ? 'Logging out...' : 'Log Out of Account'}
        </button>
      </section>
    </main>
  );
}
