'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSuperAdminAuth } from '../../lib/auth-context';
import styles from './Login.module.css';

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const { user, login, isLoading: authLoading } = useSuperAdminAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/');
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setLocalError('Please enter both Admin ID / Username and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(trimmedEmail, password);
      router.replace('/');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid credentials or unprivileged account.';
      setLocalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <main className={styles.mainWorkspace}>
        {/* ===================================================================
            LEFT SECTION (Desktop): Platform Title, Badges & Hero Imagery
           =================================================================== */}
        <section className={styles.leftSection}>
          <div>
            {/* Top Brand Logo */}
            <div className={styles.brandHeader}>
              <svg
                className={styles.leafIcon}
                width="44"
                height="44"
                viewBox="0 0 40 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path d="M8 28C6 20 12 10 24 6C24 18 16 26 8 28Z" fill="url(#adminLeaf1)" />
                <path d="M16 34C14 26 22 16 34 10C34 24 24 32 16 34Z" fill="url(#adminLeaf2)" />
                <path d="M6 34C14 28 20 22 30 14" stroke="#bbf7d0" strokeWidth="2" strokeLinecap="round" />
                <defs>
                  <linearGradient id="adminLeaf1" x1="6" y1="6" x2="24" y2="28" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#4ade80" />
                    <stop offset="1" stopColor="#15803d" />
                  </linearGradient>
                  <linearGradient id="adminLeaf2" x1="14" y1="10" x2="34" y2="34" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#86efac" />
                    <stop offset="1" stopColor="#22c55e" />
                  </linearGradient>
                </defs>
              </svg>
              <div className={styles.brandTitles}>
                <span className={styles.brandLogoText}>Aweermarket</span>
                <span className={styles.brandLogoSub}>FRESH • LOCAL • TOGETHER</span>
              </div>
            </div>

            {/* Platform Super Admin Intro */}
            <div className={styles.introSection}>
              <div className={styles.adminBadgeRow}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <polyline points="9 12 11 14 15 10" />
                </svg>
                <span>Platform Super Admin</span>
              </div>
              <h1 className={styles.mainHeadline}>
                AweerMarket<span className={styles.centralAccent}>Central</span>
              </h1>
              <p className={styles.subHeadline}>
                Complete marketplace management from one central dashboard.
              </p>
            </div>

            {/* 4 Quick Actions Row (Desktop) */}
            <div className={styles.quickActionsRow}>
              <div className={styles.quickActionPill}>
                <span className={styles.quickActionIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="M9 12h6" />
                  </svg>
                </span>
                <span>Manage Vendors</span>
              </div>

              <div className={styles.quickActionPill}>
                <span className={styles.quickActionIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="21" r="1"></circle>
                    <circle cx="20" cy="21" r="1"></circle>
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                  </svg>
                </span>
                <span>Monitor Orders</span>
              </div>

              <div className={styles.quickActionPill}>
                <span className={styles.quickActionIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                    <line x1="1" y1="10" x2="23" y2="10"></line>
                  </svg>
                </span>
                <span>Manage Payments</span>
              </div>

              <div className={styles.quickActionPill}>
                <span className={styles.quickActionIcon}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                  </svg>
                </span>
                <span>System Settings</span>
              </div>
            </div>
          </div>

          {/* Produce Basket Imagery with Chalkboard Sign (Desktop) */}
          <div className={styles.heroVisualArea}>
            <img
              src="/images/hero-basket.jpg"
              alt="Al Aweer Central Wholesale Fresh Produce"
              className={styles.heroProduceImg}
            />
            {/* Chalkboard Sign */}
            <div className={styles.chalkboardSign}>
              <span className={styles.chalkTextTop}>Fresh</span>
              <span className={styles.chalkTextBottom}>
                Local Quality <span style={{ color: '#4ade80' }}>🍃</span>
              </span>
            </div>
          </div>
        </section>

        {/* ===================================================================
            RIGHT SECTION: LANGUAGE SELECTOR & LOGIN CARD (Desktop & Mobile)
           =================================================================== */}
        <section className={styles.rightSection}>
          {/* Top Right Language Pill (Desktop) */}
          <div className={styles.topRightLang}>
            <button type="button" className={styles.langPill} aria-label="Change language">
              <span>🌐</span>
              <span>English</span>
              <span>▾</span>
            </button>
          </div>

          {/* Super Admin Login Card */}
          <div className={styles.card}>
            {/* Card Header (Shown on Desktop) */}
            <div className={styles.cardHeader}>
              <div className={styles.cardLogo}>
                <svg width="34" height="34" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 28C6 20 12 10 24 6C24 18 16 26 8 28Z" fill="#22c55e" />
                  <path d="M16 34C14 26 22 16 34 10C34 24 24 32 16 34Z" fill="#86efac" />
                </svg>
                <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', lineHeight: 1 }}>Aweermarket</span>
                  <span style={{ fontSize: '0.55rem', fontWeight: 800, color: '#22c55e', letterSpacing: '0.14em' }}>FRESH • LOCAL • TOGETHER</span>
                </div>
              </div>

              <div className={styles.cardBadgeRow}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <polyline points="9 12 11 14 15 10" />
                </svg>
                <span>Platform Super Admin</span>
              </div>

              <h2 className={styles.cardTitle}>
                AweerMarket<span style={{ color: '#22c55e' }}> Central</span>
              </h2>
              <p className={styles.cardSubtitle}>Sign in to your super admin account</p>
            </div>

            {localError && (
              <div className={styles.errorBanner} role="alert">
                {localError}
              </div>
            )}

            <form className={styles.form} onSubmit={handleSubmit} noValidate>
              {/* Admin ID / Username Input */}
              <div className={styles.inputGroup}>
                <span className={styles.inputIcon} aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </span>
                <input
                  id="admin-id"
                  type="text"
                  className={styles.input}
                  placeholder="Admin ID / Username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting || authLoading}
                  required
                  autoFocus
                  aria-label="Admin ID or Username"
                />
              </div>

              {/* Password Input */}
              <div className={styles.inputGroup}>
                <span className={styles.inputIcon} aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </span>
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  className={styles.input}
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting || authLoading}
                  required
                  aria-label="Password"
                />
                <button
                  type="button"
                  className={styles.togglePassBtn}
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                </button>
              </div>

              {/* Options Row: Remember Me & Forgot Password */}
              <div className={styles.optionsRow}>
                <label className={styles.rememberLabel}>
                  <input
                    type="checkbox"
                    className={styles.checkbox}
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>Remember me</span>
                </label>
                <Link
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    alert('Please contact the Platform Master Administrator / Infrastructure Owner to rotate platform credentials.');
                  }}
                  className={styles.forgotLink}
                >
                  Forgot password?
                </Link>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className={styles.loginBtn}
                disabled={isSubmitting || authLoading}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                  <polyline points="10 17 15 12 10 7"></polyline>
                  <line x1="15" y1="12" x2="3" y2="12"></line>
                </svg>
                <span>{isSubmitting ? 'Authenticating...' : 'Login'}</span>
              </button>

              {/* Security Badge Under Button */}
              <div className={styles.secureBadgeRow}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                <span>Secure Access • Super Admin Only</span>
              </div>
            </form>
          </div>

          {/* 4 Quick Actions (Displayed on Mobile) */}
          <div className={styles.mobileQuickActions}>
            <div className={styles.mobileActionItem}>
              <div className={styles.mobileActionIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
              </div>
              <span className={styles.mobileActionLabel}>Manage Vendors</span>
            </div>

            <div className={styles.mobileActionItem}>
              <div className={styles.mobileActionIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="21" r="1"></circle>
                  <circle cx="20" cy="21" r="1"></circle>
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                </svg>
              </div>
              <span className={styles.mobileActionLabel}>Monitor Orders</span>
            </div>

            <div className={styles.mobileActionItem}>
              <div className={styles.mobileActionIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                  <line x1="1" y1="10" x2="23" y2="10"></line>
                </svg>
              </div>
              <span className={styles.mobileActionLabel}>Manage Payments</span>
            </div>

            <div className={styles.mobileActionItem}>
              <div className={styles.mobileActionIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"></circle>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
              </div>
              <span className={styles.mobileActionLabel}>System Settings</span>
            </div>
          </div>
        </section>
      </main>

      {/* Mobile Bottom Produce Backdrop */}
      <div className={styles.mobileProduceBackdrop} aria-hidden="true">
        <img
          src="/images/hero-basket.jpg"
          alt="Wholesale fresh produce backdrop"
          className={styles.mobileProduceImg}
        />
      </div>
    </div>
  );
}
