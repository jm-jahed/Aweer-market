'use client';

/**
 * AweerMarket Buyer Login Page
 * Enforces client-side validation using shared LoginSchema.
 * Strictly scopes session to Buyer role via backend Set-Cookie.
 * State-of-the-art dark emerald aesthetic matching Shop and Super Admin portals.
 */

import React, { useState, FormEvent, ChangeEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LoginSchema } from '@aweermarket/validation';
import { loginBuyer, ApiClientError } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import styles from './Login.module.css';

interface FormState {
  email: string;
  password: string;
}

interface FormErrors {
  email?: string;
  password?: string;
}

const initialFormState: FormState = {
  email: '',
  password: ''
};

export default function LoginPage() {
  const router = useRouter();
  const { setSessionUser } = useAuth();
  const [formData, setFormData] = useState<FormState>(initialFormState);
  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
    if (serverError) {
      setServerError(null);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setServerError(null);

    // 1. Client-Side Validation against shared LoginSchema
    const parseResult = LoginSchema.safeParse({
      email: formData.email,
      password: formData.password
    });

    if (!parseResult.success) {
      const fieldErrors: FormErrors = {};
      for (const issue of parseResult.error.issues) {
        const fieldName = issue.path[0] as keyof FormErrors;
        if (fieldName && !fieldErrors[fieldName]) {
          fieldErrors[fieldName] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    // 2. Submit credentials to Backend API
    try {
      const res = await loginBuyer(parseResult.data);
      setSessionUser(res.user);
      setIsSuccess(true);
      // Redirect to buyer account dashboard
      setTimeout(() => {
        router.push('/account');
      }, 1000);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.statusCode === 401) {
          setServerError('Invalid email or password');
        } else if (err.statusCode === 403) {
          setServerError('Account has been deactivated. Please contact support.');
        } else if (err.statusCode === 503) {
          setServerError('Service temporarily unavailable. Please try again later.');
        } else {
          setServerError(err.message || 'Login failed. Please check your credentials.');
        }
      } else {
        setServerError('Unable to connect to the marketplace server. Please check your connection.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <main className={styles.mainWorkspace}>
        {/* ===================================================================
            LEFT COLUMN: BRAND & BUYER LOGIN FORM
           =================================================================== */}
        <section className={styles.leftCol}>
          {/* Back Navigation Button */}
          <div className={styles.backNavRow}>
            <Link href="/" className={styles.backBtn} aria-label="Back to Marketplace">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
              <span>Back to Marketplace</span>
            </Link>
          </div>

          {/* Form Card */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.badgeWrap}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <span>Buyer Portal</span>
              </div>
              <h1 className={styles.cardTitle}>
                Buyer <span className={styles.greenAccent}>Log In</span>
              </h1>
              <p className={styles.cardSubtitle}>
                Sign in to your wholesale buyer account to place and track produce orders.
              </p>
            </div>

            <form onSubmit={handleSubmit} className={styles.form} noValidate>
              {serverError && (
                <div className={styles.bannerError} role="alert">
                  <span>{serverError}</span>
                </div>
              )}

              {isSuccess && (
                <div className={styles.bannerSuccess} role="status">
                  Login successful! Redirecting to marketplace...
                </div>
              )}

              {/* Email Address */}
              <div className={styles.fieldGroup}>
                <label htmlFor="email" className={styles.label}>
                  Email Address
                </label>
                <div className={styles.inputGroup}>
                  <span className={styles.inputIcon}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1-0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                      <polyline points="22,6 12,13 2,6"></polyline>
                    </svg>
                  </span>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="buyer@aweermarket.ae"
                    value={formData.email}
                    onChange={handleChange}
                    className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? 'email-error' : undefined}
                    disabled={isSubmitting}
                  />
                </div>
                {errors.email && (
                  <span id="email-error" className={styles.inputErrorText} role="alert">
                    {errors.email}
                  </span>
                )}
              </div>

              {/* Password */}
              <div className={styles.fieldGroup}>
                <label htmlFor="password" className={styles.label}>
                  Password
                </label>
                <div className={styles.inputGroup}>
                  <span className={styles.inputIcon}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                  </span>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    className={`${styles.input} ${errors.password ? styles.inputError : ''}`}
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? 'password-error' : undefined}
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    className={styles.togglePassBtn}
                    onClick={() => setShowPassword(!showPassword)}
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
                {errors.password && (
                  <span id="password-error" className={styles.inputErrorText} role="alert">
                    {errors.password}
                  </span>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className={styles.signInBtn}
                disabled={isSubmitting}
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
                <span>{isSubmitting ? 'Signing In...' : 'Sign In'}</span>
              </button>

              <div className={styles.cardDivider} />

              <div className={styles.cardFooter}>
                <div>
                  Don&apos;t have an account yet?
                  <Link href="/register" className={styles.registerLink}>
                    Register here
                  </Link>
                </div>
                <Link href="/" className={styles.homeLink}>
                  ← Back to Marketplace
                </Link>
              </div>
            </form>
          </div>
        </section>

        {/* ===================================================================
            RIGHT COLUMN: HERO IMAGERY & CALLIGRAPHY (Desktop)
           =================================================================== */}
        <section className={styles.rightCol} aria-hidden="true">
          <div className={styles.heroGraphicArea}>
            <img
              src="/images/hero-basket.jpg"
              alt="Fresh wholesale produce basket"
              className={styles.heroBasketImage}
            />

            <div className={styles.calligraphyArea}>
              <span className={styles.calligraphyWhite}>Fresh Local</span>
              <span className={styles.calligraphyGreen}>Together</span>
            </div>
          </div>
        </section>
      </main>

      {/* =====================================================================
          BOTTOM TRUST BAR (Desktop)
         ===================================================================== */}
      <footer className={styles.bottomBar}>
        <div className={styles.featureList}>
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

          <div className={styles.featureItem}>
            <div className={styles.featureIconBadge}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <path d="M16 10a4 4 0 0 1-8 0"></path>
              </svg>
            </div>
            <div className={styles.featureTextCol}>
              <span className={styles.featureTitle}>Fresh Products</span>
              <span className={styles.featureDesc}>Direct from trusted vendors</span>
            </div>
          </div>

          <div className={styles.featureItem}>
            <div className={styles.featureIconBadge}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="3" width="15" height="13"></rect>
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                <circle cx="5.5" cy="18.5" r="2.5"></circle>
                <circle cx="18.5" cy="18.5" r="2.5"></circle>
              </svg>
            </div>
            <div className={styles.featureTextCol}>
              <span className={styles.featureTitle}>Reliable Delivery</span>
              <span className={styles.featureDesc}>On time, every time</span>
            </div>
          </div>
        </div>

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
