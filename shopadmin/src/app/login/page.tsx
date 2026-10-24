'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useShopAdminAuth } from '../../lib/auth-context';
import styles from './Login.module.css';

export default function LoginPage() {
  const router = useRouter();
  const { user, login, isLoading: authLoading } = useShopAdminAuth();

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
      setLocalError('Please enter both Stall ID / Username and password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(trimmedEmail, password);
      router.replace('/');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid vendor credentials or unprivileged account.';
      setLocalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <main className={styles.mainWorkspace}>
        {/* ===================================================================
            LEFT COLUMN / MAIN FORM SECTION
           =================================================================== */}
        <section className={styles.leftCol}>
          {/* Top Bar (Mobile: logo left, language right) */}
          <div className={styles.mobileTopNav}>
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
                <path d="M8 28C6 20 12 10 24 6C24 18 16 26 8 28Z" fill="url(#loginLeaf1)" />
                <path d="M16 34C14 26 22 16 34 10C34 24 24 32 16 34Z" fill="url(#loginLeaf2)" />
                <path d="M6 34C14 28 20 22 30 14" stroke="#bbf7d0" strokeWidth="2" strokeLinecap="round" />
                <defs>
                  <linearGradient id="loginLeaf1" x1="6" y1="6" x2="24" y2="28" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#4ade80" />
                    <stop offset="1" stopColor="#15803d" />
                  </linearGradient>
                  <linearGradient id="loginLeaf2" x1="14" y1="10" x2="34" y2="34" gradientUnits="userSpaceOnUse">
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

            <div className={styles.topRightBar}>
              <button type="button" className={styles.langSelector} aria-label="Change language">
                <span>🌐</span>
                <span>EN</span>
                <span>▾</span>
              </button>
            </div>
          </div>

          {/* Desktop Only Intro Header */}
          <div className={styles.desktopOnlyIntro}>
            <div className={styles.portalBadgeRow}>
              <div className={styles.shieldIconWrap}>
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <rect x="9.5" y="11" width="5" height="4.5" rx="1" fill="#22c55e" stroke="none" />
                  <path d="M10 11V9.5a2 2 0 0 1 4 0V11" />
                </svg>
              </div>
              <div className={styles.portalBadgeText}>
                <span className={styles.shopText}>Shop</span>
                <span className={styles.adminText}>Admin Portal</span>
              </div>
            </div>
            <div className={styles.accentBar} />
            <h1 className={styles.loginTitle}>Al Aweer Stall Login</h1>
            <p className={styles.loginSubtitle}>Access your stall management dashboard</p>
          </div>

          {/* Form Card */}
          <div className={styles.card}>
            {/* Mobile-Only Header Inside Card */}
            <div className={styles.mobileCardHeader}>
              <div className={styles.mobileBigShield}>
                <svg
                  width="42"
                  height="44"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="rgba(34, 197, 94, 0.08)" />
                  <rect x="9" y="11" width="6" height="5" rx="1" fill="#22c55e" stroke="none" />
                  <path d="M10 11V9a2 2 0 0 1 4 0v2" stroke="#22c55e" strokeWidth="2" />
                </svg>
              </div>
              <div className={styles.mobilePortalText}>
                <span className={styles.shopText}>Shop</span>
                <span className={styles.adminText}>Admin Portal</span>
              </div>
              <div className={styles.mobileAccentLine} />
              <h1 className={styles.mobileStallTitle}>Al Aweer Stall Login</h1>
              <p className={styles.mobileStallSub}>Access your stall management dashboard</p>
            </div>

            {localError && (
              <div className={styles.errorBanner} role="alert">
                {localError}
              </div>
            )}

            <form className={styles.form} onSubmit={handleSubmit} noValidate>
              {/* Stall ID / Username Input */}
              <div className={styles.inputGroup}>
                <span className={styles.inputIcon} aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </span>
                <input
                  id="vendor-login-id"
                  type="text"
                  className={styles.input}
                  placeholder="Stall ID / Username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isSubmitting || authLoading}
                  required
                  autoFocus
                  aria-label="Stall ID or Username"
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
                  id="vendor-password"
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

              {/* Remember Me and Forgot Password Row */}
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
                    alert('Please contact Dubai Al Aweer Central Market Administration to verify or reset your stall credentials.');
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
                <span>{isSubmitting ? 'Logging In...' : 'Login'}</span>
              </button>

              {/* Bottom Divider inside Card */}
              <div className={styles.cardDivider}>
                <div className={styles.dividerLine} />
                <div className={styles.dividerBadge}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  <span>Secure Access for Stall Owners</span>
                </div>
                <div className={styles.dividerLine} />
              </div>
            </form>
          </div>

          {/* Registration Link */}
          <div className={styles.registerText}>
            Are you a new Al Aweer wholesale vendor?
            <Link href="/register" className={styles.registerLink}>
              Register your stall
            </Link>
          </div>
        </section>

        {/* ===================================================================
            RIGHT COLUMN: HERO IMAGERY & CALLIGRAPHY (Desktop & Mobile Backdrop)
           =================================================================== */}
        <section className={styles.rightCol} aria-hidden="true">
          <div className={styles.heroGraphicArea}>
            <img
              src="/images/hero-basket.jpg"
              alt="Fresh wholesale produce basket"
              className={styles.heroBasketImage}
            />

            {/* Floating Calligraphy in Top Right */}
            <div className={styles.calligraphyArea}>
              <span className={styles.calligraphyWhite}>Good Food</span>
              <span className={styles.calligraphyGreen}>Better Tomorrow</span>
            </div>
          </div>
        </section>
      </main>

      {/* =====================================================================
          BOTTOM FEATURE HIGHLIGHTS BAR (Desktop)
         ===================================================================== */}
      <footer className={styles.bottomBar}>
        <div className={styles.featureList}>
          {/* Feature 1 */}
          <div className={styles.featureItem}>
            <div className={styles.featureIconBadge}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                <polyline points="9 12 11 14 15 10"></polyline>
              </svg>
            </div>
            <div className={styles.featureTextCol}>
              <span className={styles.featureTitle}>Secure Login</span>
              <span className={styles.featureDesc}>Your data is safe</span>
            </div>
          </div>

          {/* Feature 2 */}
          <div className={styles.featureItem}>
            <div className={styles.featureIconBadge}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
            </div>
            <div className={styles.featureTextCol}>
              <span className={styles.featureTitle}>Stall Management</span>
              <span className={styles.featureDesc}>Control your products &amp; orders</span>
            </div>
          </div>

          {/* Feature 3 */}
          <div className={styles.featureItem}>
            <div className={styles.featureIconBadge}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10"></line>
                <line x1="12" y1="20" x2="12" y2="4"></line>
                <line x1="6" y1="20" x2="6" y2="14"></line>
              </svg>
            </div>
            <div className={styles.featureTextCol}>
              <span className={styles.featureTitle}>Real-time Updates</span>
              <span className={styles.featureDesc}>Stay informed, always</span>
            </div>
          </div>
        </div>

        {/* Brand in Bottom Right */}
        <div className={styles.bottomBrand}>
          <svg width="30" height="30" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 28C6 20 12 10 24 6C24 18 16 26 8 28Z" fill="#22c55e" />
            <path d="M16 34C14 26 22 16 34 10C34 24 24 32 16 34Z" fill="#86efac" />
          </svg>
          <div className={styles.brandTitles}>
            <span className={styles.bottomBrandText}>Aweermarket</span>
            <span className={styles.bottomBrandSub}>FRESH • LOCAL • TOGETHER</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
