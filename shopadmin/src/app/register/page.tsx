'use client';

import React, { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import styles from './Register.module.css';

export default function VendorRegisterPage() {
  const router = useRouter();
  const { user, register, isLoading: authLoading } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [stallName, setStallName] = useState('');
  const [stallNumber, setStallNumber] = useState('');
  const [tradeLicenseNumber, setTradeLicenseNumber] = useState('');
  const [phone, setPhone] = useState('');

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

    if (!fullName || !email || !password || !stallName || !stallNumber || !tradeLicenseNumber || !phone) {
      setLocalError('Please complete all required stall and vendor registration fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      await register({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
        stallName: stallName.trim(),
        stallNumber: stallNumber.trim(),
        tradeLicenseNumber: tradeLicenseNumber.trim(),
        phone: phone.trim()
      });
      router.replace('/');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed. Please check your details.';
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
                <path d="M8 28C6 20 12 10 24 6C24 18 16 26 8 28Z" fill="url(#regLeaf1)" />
                <path d="M16 34C14 26 22 16 34 10C34 24 24 32 16 34Z" fill="url(#regLeaf2)" />
                <path d="M6 34C14 28 20 22 30 14" stroke="#bbf7d0" strokeWidth="2" strokeLinecap="round" />
                <defs>
                  <linearGradient id="regLeaf1" x1="6" y1="6" x2="24" y2="28" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#4ade80" />
                    <stop offset="1" stopColor="#15803d" />
                  </linearGradient>
                  <linearGradient id="regLeaf2" x1="14" y1="10" x2="34" y2="34" gradientUnits="userSpaceOnUse">
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
            <h1 className={styles.registerTitle}>Register Wholesale Stall</h1>
            <p className={styles.registerSubtitle}>
              Join Dubai Al Aweer Central Fruits &amp; Vegetables Marketplace
            </p>
          </div>

          {/* Form Card */}
          <div className={styles.card}>
            {/* Mobile-Only Header Inside Card */}
            <div className={styles.mobileCardHeader}>
              <div className={styles.mobileBigShield}>
                <svg
                  width="28"
                  height="28"
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
              <div className={styles.mobilePortalText}>
                <span className={styles.shopText}>Shop</span>
                <span className={styles.adminText}>Admin Portal</span>
              </div>
              <div className={styles.mobileAccentLine} />
              <h1 className={styles.mobileStallTitle}>Register Wholesale Stall</h1>
              <p className={styles.mobileStallSub}>
                Join Dubai Al Aweer Central Fruits &amp; Vegetables Marketplace
              </p>
            </div>

            {localError && (
              <div className={styles.errorBanner} role="alert">
                {localError}
              </div>
            )}

            <div className={styles.infoNotice}>
              <span>ℹ️</span>
              <span>
                Newly registered stalls require <strong>Super Admin Approval</strong> before wholesale produce listings go live.
              </span>
            </div>

            <form className={styles.form} onSubmit={handleSubmit} noValidate>
              {/* Full Name */}
              <div className={styles.inputGroup}>
                <span className={styles.inputIcon} aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </span>
                <input
                  id="reg-fullname"
                  type="text"
                  className={styles.input}
                  placeholder="Primary Contact / Manager Full Name *"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={isSubmitting || authLoading}
                  required
                  aria-label="Primary Contact Full Name"
                />
              </div>

              {/* Email and Password Row */}
              <div className={styles.formRow}>
                <div className={styles.inputGroup}>
                  <span className={styles.inputIcon} aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                      <polyline points="22,6 12,13 2,6"></polyline>
                    </svg>
                  </span>
                  <input
                    id="reg-email"
                    type="email"
                    className={styles.input}
                    placeholder="Vendor Email Address *"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSubmitting || authLoading}
                    required
                    aria-label="Vendor Email Address"
                  />
                </div>

                <div className={styles.inputGroup}>
                  <span className={styles.inputIcon} aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                  </span>
                  <input
                    id="reg-password"
                    type={showPassword ? 'text' : 'password'}
                    className={`${styles.input} ${styles.inputWithToggle}`}
                    placeholder="Password (min. 8 chars) *"
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
              </div>

              {/* Wholesale Stall Name */}
              <div className={styles.inputGroup}>
                <span className={styles.inputIcon} aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                    <polyline points="9 22 9 12 15 12 15 22"></polyline>
                  </svg>
                </span>
                <input
                  id="reg-stallname"
                  type="text"
                  className={styles.input}
                  placeholder="Wholesale Stall / Trade Name (e.g. Al Aweer LLC) *"
                  value={stallName}
                  onChange={(e) => setStallName(e.target.value)}
                  disabled={isSubmitting || authLoading}
                  required
                  aria-label="Wholesale Stall Trade Name"
                />
              </div>

              {/* Stall Number and Phone Row */}
              <div className={styles.formRow}>
                <div className={styles.inputGroup}>
                  <span className={styles.inputIcon} aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                      <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                  </span>
                  <input
                    id="reg-stallnumber"
                    type="text"
                    className={styles.input}
                    placeholder="Stall No. (e.g. ST-42, Block C) *"
                    value={stallNumber}
                    onChange={(e) => setStallNumber(e.target.value)}
                    disabled={isSubmitting || authLoading}
                    required
                    aria-label="Al Aweer Stall Number"
                  />
                </div>

                <div className={styles.inputGroup}>
                  <span className={styles.inputIcon} aria-hidden="true">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                    </svg>
                  </span>
                  <input
                    id="reg-phone"
                    type="tel"
                    className={styles.input}
                    placeholder="Phone (e.g. +971501234567) *"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={isSubmitting || authLoading}
                    required
                    aria-label="Contact Phone"
                  />
                </div>
              </div>

              {/* Trade License */}
              <div className={styles.inputGroup}>
                <span className={styles.inputIcon} aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                  </svg>
                </span>
                <input
                  id="reg-tradelicense"
                  type="text"
                  className={styles.input}
                  placeholder="Dubai Trade License No. (e.g. TL-DXB-987654) *"
                  value={tradeLicenseNumber}
                  onChange={(e) => setTradeLicenseNumber(e.target.value)}
                  disabled={isSubmitting || authLoading}
                  required
                  aria-label="Dubai Trade License Number"
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className={styles.submitBtn}
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
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="8.5" cy="7" r="4"></circle>
                  <line x1="20" y1="8" x2="20" y2="14"></line>
                  <line x1="23" y1="11" x2="17" y2="11"></line>
                </svg>
                <span>{isSubmitting ? 'Registering Stall...' : 'Submit Vendor Registration'}</span>
              </button>

              {/* Security Divider inside Card */}
              <div className={styles.cardDivider}>
                <div className={styles.dividerLine} />
                <div className={styles.dividerBadge}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  <span>Verified Al Aweer B2B Registration</span>
                </div>
                <div className={styles.dividerLine} />
              </div>
            </form>
          </div>

          {/* Sign In Link */}
          <div className={styles.loginPromptText}>
            Already registered as an Al Aweer vendor?
            <Link href="/login" className={styles.loginLink}>
              Sign In here
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
              <span className={styles.featureTitle}>Verified Vendor Access</span>
              <span className={styles.featureDesc}>Direct wholesale market trading</span>
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
              <span className={styles.featureDesc}>Control produce offers &amp; orders</span>
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
              <span className={styles.featureTitle}>Real-time Invoicing</span>
              <span className={styles.featureDesc}>Automated UAE VAT compliance</span>
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
